import { Worker, Job } from 'bullmq';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import execa from 'execa';
import path from 'path';
import fs from 'fs';
import { io as ioClient, Socket } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const redisConnection = createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
});
redisConnection.on('error', console.error);
redisConnection.connect();

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

type JobData = PassiveReconJobData | ActiveReconJobData;

const worker = new Worker<JobData>(
  'afw-jobs',
  async (job: Job<JobData>) => {
    if (job.name === 'passive-recon') {
      const { executionId, targetRoot, threads } = job.data as PassiveReconJobData;
      await handlePassiveRecon(executionId, targetRoot, threads);
    } else if (job.name === 'active-recon') {
      const { executionId, targetRoot, liveHostsPath, threads } = job.data as ActiveReconJobData;
      await handleActiveRecon(executionId, targetRoot, liveHostsPath, threads);
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
    await sendStatus(executionId, 'subfinder', 'completed');

    // dnsx
    const resolvedHostsPath = path.join(workDir, 'resolved_hosts.txt');
    await sendStatus(executionId, 'dnsx', 'running');
    await execa('docker', ['run', '--rm', 'projectdiscovery/dnsx:latest', '-l', subDomainsPath, '-o', resolvedHostsPath]);
    await sendStatus(executionId, 'dnsx', 'completed');

    // httpx
    const liveHostsPath = path.join(workDir, 'live_hosts.txt');
    await sendStatus(executionId, 'httpx', 'running');
    await execa('docker', ['run', '--rm', 'projectdiscovery/httpx:latest', '-l', resolvedHostsPath, '-threads', String(threads), '-o', liveHostsPath]);
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

async function sendStatus(executionId: string, stage: string, status: string) {
  socket.emit('stage-status', { executionId, stage, status });
}