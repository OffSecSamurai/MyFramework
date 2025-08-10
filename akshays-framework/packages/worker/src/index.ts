import 'dotenv/config';
import { Worker, Queue, Job } from 'bullmq';
import path from 'node:path';
import fs from 'fs-extra';
import { execa } from 'execa';
import { PrismaClient } from '@prisma/client';
import { io as clientIo } from 'socket.io-client';

const prisma = new PrismaClient();

const redisConnection = { url: process.env.REDIS_URL } as const;
const runsQueue = new Queue('runs', { connection: redisConnection });

const apiUrl = process.env.VITE_API_URL || `http://api:${process.env.API_PORT || 4000}`;
const socket = clientIo(apiUrl, { path: process.env.SOCKET_PATH || '/socket.io' });

function emitProgress(executionId: string, payload: any) {
  socket.emit('progress', { executionId, ...payload });
}

function clampThreads(threads?: number) {
  const max = Number(process.env.MAX_THREADS || 50);
  const t = Number(threads || max);
  return Math.min(t, max);
}

async function ensureDir(dir: string) {
  await fs.mkdirp(dir);
}

async function runCmd(cmd: string, args: string[], cwd: string, logFile: string) {
  const proc = execa(cmd, args, { cwd, all: true, shell: false });
  const outStream = fs.createWriteStream(logFile, { flags: 'a' });
  proc.all?.pipe(outStream);
  await proc;
}

async function writeFile(filePath: string, content: string) {
  await fs.outputFile(filePath, content);
}

async function stagePassiveRecon(executionId: string) {
  const exec = await prisma.execution.findUnique({ where: { id: executionId }, include: { target: true } });
  if (!exec) throw new Error('execution not found');
  const baseDir = exec.storagePath;
  await ensureDir(baseDir);

  // Create roots.txt
  const rootsPath = path.join(baseDir, 'roots.txt');
  await writeFile(rootsPath, `${exec.target.name}\n`);

  const threads = clampThreads(exec.threads);

  // Files
  const subfinderOut = path.join(baseDir, 'subdomains_subfinder.txt');
  const assetfinderOut = path.join(baseDir, 'subdomains_assetfinder.txt');
  const chaosOut = path.join(baseDir, 'subdomains_chaos.txt');
  const amassJson = path.join(baseDir, 'amass_raw_output.json');
  const amassOut = path.join(baseDir, 'subdomains_amass.txt');
  const allRaw = path.join(baseDir, 'all_subdomains_raw.txt');
  const resolvers = path.join(baseDir, 'resolvers.txt');
  const unresolved = path.join(baseDir, 'unresolved_hosts.txt');
  const resolved = path.join(baseDir, 'resolved_hosts.txt');
  const s3Takeover = path.join(baseDir, 'potential_s3_takeovers.txt');
  const logFile = path.join(baseDir, 'stage1_passive_recon.log');

  emitProgress(executionId, { stage: 'PASSIVE_RECON', status: 'STARTED' });

  // subfinder
  try {
    await runCmd('sh', ['-lc', `subfinder -dL ${path.basename(rootsPath)} -silent -o ${path.basename(subfinderOut)}`], baseDir, logFile);
    await prisma.artifact.create({ data: { executionId, name: 'subdomains_subfinder.txt', path: subfinderOut } });
  } catch {}
  emitProgress(executionId, { step: 'subfinder', status: 'DONE' });

  // assetfinder
  try {
    await runCmd('sh', ['-lc', `cat ${path.basename(rootsPath)} | assetfinder --subs-only | sort -u > ${path.basename(assetfinderOut)}`], baseDir, logFile);
    await prisma.artifact.create({ data: { executionId, name: 'subdomains_assetfinder.txt', path: assetfinderOut } });
  } catch {}
  emitProgress(executionId, { step: 'assetfinder', status: 'DONE' });

  // chaos (requires API key in ~/.config/chaos/config.yaml if used)
  try {
    await runCmd('sh', ['-lc', `if command -v chaos >/dev/null 2>&1; then chaos -dL ${path.basename(rootsPath)} -o ${path.basename(chaosOut)} -silent || true; fi`], baseDir, logFile);
    if (await fs.pathExists(chaosOut)) {
      await prisma.artifact.create({ data: { executionId, name: 'subdomains_chaos.txt', path: chaosOut } });
    }
  } catch {}
  emitProgress(executionId, { step: 'chaos', status: 'DONE' });

  // amass passive
  try {
    await runCmd('sh', ['-lc', `if command -v amass >/dev/null 2>&1; then amass enum -passive -df ${path.basename(rootsPath)} -json ${path.basename(amassJson)} || true; fi`], baseDir, logFile);
    await runCmd('sh', ['-lc', `if [ -f ${path.basename(amassJson)} ]; then cat ${path.basename(amassJson)} | jq -r '.name' | sort -u > ${path.basename(amassOut)}; fi`], baseDir, logFile);
    if (await fs.pathExists(amassOut)) {
      await prisma.artifact.create({ data: { executionId, name: 'subdomains_amass.txt', path: amassOut } });
    }
  } catch {}
  emitProgress(executionId, { step: 'amass', status: 'DONE' });

  // Combine and dedupe
  await runCmd('sh', ['-lc', `cat subdomains_*.txt *.com.txt 2>/dev/null | cut -d ' ' -f 1 | sed 's/:\([0-9]\+\)//g' | sed 's#https\?://##' | sort -u > ${path.basename(allRaw)} || true`], baseDir, logFile);
  await prisma.artifact.create({ data: { executionId, name: 'all_subdomains_raw.txt', path: allRaw } });

  // resolvers
  await runCmd('sh', ['-lc', `wget -q -O ${path.basename(resolvers)} https://raw.githubusercontent.com/trickest/resolvers/main/resolvers.txt`], baseDir, logFile);

  // dnsx resolution
  await runCmd('sh', ['-lc', `if [ -s ${path.basename(allRaw)} ]; then dnsx -l ${path.basename(allRaw)} -r ${path.basename(resolvers)} -a -cname -resp -o ${path.basename(unresolved)} -silent; fi`], baseDir, logFile);
  await runCmd('sh', ['-lc', `if [ -f ${path.basename(unresolved)} ]; then cat ${path.basename(unresolved)} | grep 'CNAME' | grep 's3.amazonaws.com' | awk '{print $1}' > ${path.basename(s3Takeover)} || true; fi`], baseDir, logFile);
  await runCmd('sh', ['-lc', `if [ -f ${path.basename(unresolved)} ]; then cat ${path.basename(unresolved)} | awk '{print $1}' | sort -u > ${path.basename(resolved)}; fi`], baseDir, logFile);

  if (await fs.pathExists(resolved)) {
    await prisma.artifact.create({ data: { executionId, name: 'resolved_hosts.txt', path: resolved } });
  }
  if (await fs.pathExists(s3Takeover)) {
    await prisma.artifact.create({ data: { executionId, name: 'potential_s3_takeovers.txt', path: s3Takeover } });
  }

  await prisma.execution.update({ where: { id: executionId }, data: { currentStage: 'PASSIVE_RECON' } });
  emitProgress(executionId, { stage: 'PASSIVE_RECON', status: 'COMPLETED' });
}

new Worker(
  'runs',
  async (job: Job) => {
    const { executionId } = job.data as { executionId: string };
    const execution = await prisma.execution.findUnique({ where: { id: executionId } });
    if (!execution) return;
    if (execution.status === 'ABORTED') return;

    await prisma.execution.update({ where: { id: executionId }, data: { status: 'RUNNING' } });

    // Create storage directory
    await ensureDir(execution.storagePath);

    // Stage 1 only; next stages require explicit confirmation via UI/API
    await stagePassiveRecon(executionId);
  },
  { connection: redisConnection, concurrency: 1 }
);

console.log('[Worker] Ready');