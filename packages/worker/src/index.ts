import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import execa from 'execa';
import path from 'path';
import fs from 'fs';
import { io as ioClient, Socket } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10)
});

const prisma = new PrismaClient();

const socket: Socket = ioClient(`http://api:${process.env.PORT || 4000}`);

interface PassiveReconJobData {
  executionId: string;
  targetRoot: string;
  threads: number;
}

interface ActiveReconJobData {
  executionId: string;
  targetRoot: string;
  liveHostsPath: string;
  threads: number;
}

interface VulnDiscoveryJobData {
  executionId: string;
  targetRoot: string;
  liveHostsPath: string;
  threads: number;
}

type JobData = PassiveReconJobData | ActiveReconJobData | VulnDiscoveryJobData;

const worker = new Worker<JobData>(
  'afw-jobs',
  async (job: Job<JobData>) => {
    if (job.name === 'passive-recon') {
      const { executionId, targetRoot, threads } = job.data as PassiveReconJobData;
      await handlePassiveRecon(executionId, targetRoot, threads);
    } else if (job.name === 'active-recon') {
      const { executionId, targetRoot, liveHostsPath, threads } = job.data as ActiveReconJobData;
      await handleActiveRecon(executionId, targetRoot, liveHostsPath, threads);
    } else if (job.name === 'vuln-discovery') {
      const { executionId, targetRoot, liveHostsPath, threads } = job.data as VulnDiscoveryJobData;
      await handleVulnDiscovery(executionId, targetRoot, liveHostsPath, threads);
    }
  },
  { connection: redisConnection, concurrency: 1 }
);

worker.on('completed', (job) => console.log(`Job ${job.id} completed`));

async function handlePassiveRecon(executionId: string, targetRoot: string, threads: number) {
  await prisma.execution.update({ where: { id: executionId }, data: { status: 'running', startedAt: new Date() } });

  const workDir = path.resolve(`/workspace/storage/${targetRoot}/${Date.now()}`);
  fs.mkdirSync(workDir, { recursive: true });

  const subDomainsPath = path.join(workDir, 'subdomains.txt');

  try {
    // Subfinder
    await sendStatus(executionId, 'subfinder', 'running');
    await execa('docker', ['run', '--rm', 'projectdiscovery/subfinder:latest', '-d', targetRoot, '-o', subDomainsPath]);
    // Deduplicate
    await dedupFile(subDomainsPath);
    await sendStatus(executionId, 'subfinder', 'completed');

    // dnsx
    const resolvedHostsPath = path.join(workDir, 'resolved_hosts.txt');
    await sendStatus(executionId, 'dnsx', 'running');
    await execa('docker', ['run', '--rm', 'projectdiscovery/dnsx:latest', '-l', subDomainsPath, '-o', resolvedHostsPath]);
    await dedupFile(resolvedHostsPath);
    await sendStatus(executionId, 'dnsx', 'completed');

    // httpx
    const liveHostsPath = path.join(workDir, 'live_hosts.txt');
    await sendStatus(executionId, 'httpx', 'running');
    await execa('docker', ['run', '--rm', 'projectdiscovery/httpx:latest', '-l', resolvedHostsPath, '-threads', String(threads), '-o', liveHostsPath]);
    await dedupFile(liveHostsPath);
    await sendStatus(executionId, 'httpx', 'completed');

    await prisma.artifact.createMany({
      data: [
        { executionId, path: subDomainsPath, type: 'subdomains' },
        { executionId, path: resolvedHostsPath, type: 'resolved-hosts' },
        { executionId, path: liveHostsPath, type: 'live-hosts' }
      ]
    });

    await prisma.execution.update({ where: { id: executionId }, data: { status: 'completed', finishedAt: new Date() } });
    socket.emit('execution-completed', { executionId });
  } catch (err: any) {
    console.error(err);
    await prisma.execution.update({ where: { id: executionId }, data: { status: 'failed', finishedAt: new Date() } });
    socket.emit('execution-failed', { executionId, error: err.message || 'error' });
    throw err;
  }
}

async function handleActiveRecon(executionId: string, targetRoot: string, liveHostsPath: string, threads: number) {
  await prisma.execution.update({ where: { id: executionId }, data: { status: 'running', startedAt: new Date() } });

  const workDir = path.resolve(`/workspace/storage/${targetRoot}/${Date.now()}-active`);
  fs.mkdirSync(workDir, { recursive: true });

  try {
    // Copy liveHostsPath into workDir for container mounts
    const localLiveHosts = path.join(workDir, 'live_hosts.txt');
    fs.copyFileSync(liveHostsPath, localLiveHosts);

    // Aquatone screenshots
    await sendStatus(executionId, 'aquatone', 'running');
    await execa.command(`cat ${localLiveHosts} | docker run --rm -i -v ${workDir}:/data michenriksen/aquatone -threads 4 -out /data/aquatone_report`);
    await sendStatus(executionId, 'aquatone', 'completed');

    // wafw00f
    const wafReport = path.join(workDir, 'waf_report.txt');
    await sendStatus(executionId, 'wafw00f', 'running');
    await execa('docker', ['run', '--rm', '-v', `${workDir}:/data`, 'owasp/wafw00f', '-i', '/data/live_hosts.txt', '-o', '/data/waf_report.txt']);
    await sendStatus(executionId, 'wafw00f', 'completed');

    // naabu port scan
    const naabuPorts = path.join(workDir, 'naabu_all_ports.txt');
    await sendStatus(executionId, 'naabu', 'running');
    await execa('docker', ['run', '--rm', '-v', `${workDir}:/data`, 'projectdiscovery/naabu:latest', '-iL', '/data/live_hosts.txt', '-p', '-', '-rate', '1000', '-o', '/data/naabu_all_ports.txt']);
    await dedupFile(naabuPorts);
    await sendStatus(executionId, 'naabu', 'completed');

    // nmap service scan
    const nmapReport = path.join(workDir, 'nmap_service_scan.txt');
    await sendStatus(executionId, 'nmap', 'running');
    await execa('docker', ['run', '--rm', '-v', `${workDir}:/data`, 'instrumentisto/nmap', '-iL', '/data/naabu_all_ports.txt', '-sV', '-T4', '-oN', '/data/nmap_service_scan.txt']);
    await sendStatus(executionId, 'nmap', 'completed');

    await prisma.artifact.createMany({
      data: [
        { executionId, path: path.join(workDir, 'aquatone_report'), type: 'aquatone-report' },
        { executionId, path: wafReport, type: 'waf-report' },
        { executionId, path: naabuPorts, type: 'naabu-ports' },
        { executionId, path: nmapReport, type: 'nmap-report' }
      ]
    });

    await prisma.execution.update({ where: { id: executionId }, data: { status: 'completed', finishedAt: new Date() } });
    socket.emit('execution-completed', { executionId });
  } catch (err: any) {
    console.error(err);
    await prisma.execution.update({ where: { id: executionId }, data: { status: 'failed', finishedAt: new Date() } });
    socket.emit('execution-failed', { executionId, error: err.message || 'error' });
    throw err;
  }
}

async function handleVulnDiscovery(executionId: string, targetRoot: string, liveHostsPath: string, threads: number) {
  await prisma.execution.update({ where: { id: executionId }, data: { status: 'running', startedAt: new Date() } });

  const workDir = path.resolve(`/workspace/storage/${targetRoot}/${Date.now()}-vuln`);
  fs.mkdirSync(workDir, { recursive: true });

  try {
    const localLiveHosts = path.join(workDir, 'live_hosts.txt');
    fs.copyFileSync(liveHostsPath, localLiveHosts);

    // dirsearch - brute force directories (save HTML and text)
    const dirsearchReport = path.join(workDir, 'dirsearch_report.txt');
    await sendStatus(executionId, 'dirsearch', 'running');
    await execa('docker', ['run', '--rm', '-v', `${workDir}:/data`, 'maurossi/dirsearch', '-l', '/data/live_hosts.txt', '-e', '*', '-o', '/data/dirsearch_report.txt', '--plain-text-report']);
    await sendStatus(executionId, 'dirsearch', 'completed');
    await dedupFile(dirsearchReport);

    // gf pattern hunt (within dirsearch report as demonstration)
    const gfReport = path.join(workDir, 'gf_patterns.txt');
    await sendStatus(executionId, 'gf', 'running');
    await execa.command(`cat ${dirsearchReport} | docker run --rm -i trufflesecurity/gf redirect,xss,lfi -o ${gfReport}`);
    await sendStatus(executionId, 'gf', 'completed');

    // nuclei scan
    const nucleiReport = path.join(workDir, 'nuclei_report.txt');
    await sendStatus(executionId, 'nuclei', 'running');
    await execa('docker', ['run', '--rm', '-v', `${workDir}:/data`, 'projectdiscovery/nuclei:latest', '-l', '/data/live_hosts.txt', '-o', '/data/nuclei_report.txt', '-nc', '-retries', '1']);
    await sendStatus(executionId, 'nuclei', 'completed');

    await prisma.artifact.createMany({
      data: [
        { executionId, path: dirsearchReport, type: 'dirsearch-report' },
        { executionId, path: gfReport, type: 'gf-report' },
        { executionId, path: nucleiReport, type: 'nuclei-report' }
      ]
    });

    await prisma.execution.update({ where: { id: executionId }, data: { status: 'completed', finishedAt: new Date() } });
    socket.emit('execution-completed', { executionId });
  } catch (err: any) {
    console.error(err);
    await prisma.execution.update({ where: { id: executionId }, data: { status: 'failed', finishedAt: new Date() } });
    socket.emit('execution-failed', { executionId, error: err.message || 'error' });
    throw err;
  }
}

async function sendStatus(executionId: string, stage: string, status: string) {
  socket.emit('stage-status', { executionId, stage, status });
}

async function dedupFile(filePath: string) {
  try {
    const contents = fs.readFileSync(filePath, 'utf-8');
    const unique = Array.from(new Set(contents.split(/\r?\n/).filter(Boolean))).sort();
    fs.writeFileSync(filePath, unique.join('\n'));
  } catch (e) {
    console.error('dedup error', filePath, e);
  }
}