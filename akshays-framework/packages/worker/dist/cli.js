import 'dotenv/config';
import { Queue } from 'bullmq';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';
const prisma = new PrismaClient();
const runsQueue = new Queue('runs', { connection: { url: process.env.REDIS_URL } });
const argv = yargs(hideBin(process.argv))
    .command('run <mode>', 'enqueue a run', (y) => y
    .positional('mode', { choices: ['full', 'custom', 'single'] })
    .option('target', { type: 'string', demandOption: true })
    .option('threads', { type: 'number', default: Number(process.env.MAX_THREADS || 50) })
    .option('out', { type: 'string' })
    .option('native', { type: 'boolean', default: false }))
    .help()
    .parseSync();
(async () => {
    const modeMap = { full: 'FULL', custom: 'CUSTOM', single: 'SINGLE' };
    const mode = modeMap[argv.mode];
    const targetName = argv.target;
    const cappedThreads = Math.min(Number(argv.threads), 50);
    const target = await prisma.target.upsert({ where: { name: targetName }, update: {}, create: { name: targetName } });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const storagePath = argv.out ? path.resolve(String(argv.out)) : `${process.env.STORAGE_ROOT || 'storage'}/${target.name}/${timestamp}`;
    const execution = await prisma.execution.create({
        data: {
            targetId: target.id,
            mode,
            status: 'PENDING',
            currentStage: 'INITIAL_ASSESSMENT',
            threads: cappedThreads,
            useNative: Boolean(argv.native),
            storagePath
        }
    });
    await runsQueue.add('run', { executionId: execution.id }, { removeOnComplete: true });
    console.log(`Enqueued run ${execution.id} for target ${target.name}`);
})();
