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

const passiveReconWorker = new Worker<PassiveReconJobData>(
  'afw-jobs',
  async (job: Job<PassiveReconJobData>) => {
    const { executionId, targetRoot, threads } = job.data;

    await prisma.execution.update({ where: { id: executionId }, data: { status: 'running', startedAt: new Date() } });

    const workDir = path.resolve(`/workspace/storage/${targetRoot}/${Date.now()}`);
    fs.mkdirSync(workDir, { recursive: true });

    const subDomainsPath = path.join(workDir, 'subdomains.txt');

    try {
      // Subfinder
      await sendStatus('subfinder', 'running');
      await execa('docker', ['run', '--rm', 'projectdiscovery/subfinder:latest', '-d', targetRoot, '-o', subDomainsPath]);
      await sendStatus('subfinder', 'completed');

      // dnsx
      const resolvedHostsPath = path.join(workDir, 'resolved_hosts.txt');
      await sendStatus('dnsx', 'running');
      await execa('docker', ['run', '--rm', 'projectdiscovery/dnsx:latest', '-l', subDomainsPath, '-o', resolvedHostsPath]);
      await sendStatus('dnsx', 'completed');

      // httpx
      const liveHostsPath = path.join(workDir, 'live_hosts.txt');
      await sendStatus('httpx', 'running');
      await execa('docker', ['run', '--rm', 'projectdiscovery/httpx:latest', '-l', resolvedHostsPath, '-threads', String(threads), '-o', liveHostsPath]);
      await sendStatus('httpx', 'completed');

      await prisma.artifact.createMany({
        data: [
          { executionId, path: subDomainsPath, type: 'subdomains' },
          { executionId, path: resolvedHostsPath, type: 'resolved-hosts' },
          { executionId, path: liveHostsPath, type: 'live-hosts' }
        ]
      });

      await prisma.execution.update({ where: { id: executionId }, data: { status: 'completed', finishedAt: new Date() } });
      socket.emit('execution-completed', { executionId });
    } catch (err) {
      console.error(err);
      await prisma.execution.update({ where: { id: executionId }, data: { status: 'failed', finishedAt: new Date() } });
      socket.emit('execution-failed', { executionId, error: err.message || 'error' });
      throw err;
    }
  },
  { connection: redisConnection, concurrency: 1 }
);

passiveReconWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

async function sendStatus(stage: string, status: string) {
  socket.emit('stage-status', { stage, status });
}