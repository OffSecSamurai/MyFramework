import { Router } from 'express';
import { Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const router = Router();
const runsQueue = new Queue('runs', { connection: { url: process.env.REDIS_URL } });
router.post('/', async (req, res) => {
    try {
        const { target, scope, mode, threads, useNative } = req.body;
        if (!target || !mode) {
            return res.status(400).json({ error: 'target and mode are required' });
        }
        const cappedThreads = Math.min(Number(threads || process.env.MAX_THREADS || 50), 50);
        const dbTarget = await prisma.target.upsert({
            where: { name: target },
            update: { scope: scope ?? undefined },
            create: { name: target, scope }
        });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const storagePath = `${process.env.STORAGE_ROOT || 'storage'}/${dbTarget.name}/${timestamp}`;
        const execution = await prisma.execution.create({
            data: {
                targetId: dbTarget.id,
                mode,
                status: 'PENDING',
                currentStage: 'INITIAL_ASSESSMENT',
                threads: cappedThreads,
                useNative: Boolean(useNative),
                storagePath
            }
        });
        await runsQueue.add('run', { executionId: execution.id }, { removeOnComplete: true, removeOnFail: false, attempts: 1 });
        return res.json({ ok: true, execution });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});
router.get('/:id', async (req, res) => {
    const execution = await prisma.execution.findUnique({
        where: { id: req.params.id },
        include: { target: true, jobs: true, artifacts: true, findings: true }
    });
    if (!execution)
        return res.status(404).json({ error: 'not found' });
    res.json(execution);
});
router.post('/:id/pause', async (req, res) => {
    const updated = await prisma.execution.update({ where: { id: req.params.id }, data: { status: 'PAUSED' } });
    res.json(updated);
});
router.post('/:id/resume', async (req, res) => {
    const updated = await prisma.execution.update({ where: { id: req.params.id }, data: { status: 'RUNNING' } });
    res.json(updated);
});
router.post('/:id/abort', async (req, res) => {
    const updated = await prisma.execution.update({ where: { id: req.params.id }, data: { status: 'ABORTED' } });
    res.json(updated);
});
router.post('/:id/advance-stage', async (req, res) => {
    const { stage } = req.body;
    const exec = await prisma.execution.findUnique({ where: { id: req.params.id } });
    if (!exec)
        return res.status(404).json({ error: 'not found' });
    if (stage === 'ACTIVE_RECON') {
        if (exec.currentStage !== 'PASSIVE_RECON')
            return res.status(400).json({ error: 'current stage is not PASSIVE_RECON' });
        await prisma.execution.update({ where: { id: exec.id }, data: { currentStage: 'ACTIVE_RECON' } });
        await runsQueue.add('stage2-active-recon', { executionId: exec.id }, { removeOnComplete: true });
        return res.json({ ok: true });
    }
    if (stage === 'SPIDERING') {
        if (exec.currentStage !== 'ACTIVE_RECON')
            return res.status(400).json({ error: 'current stage is not ACTIVE_RECON' });
        await prisma.execution.update({ where: { id: exec.id }, data: { currentStage: 'SPIDERING' } });
        await runsQueue.add('stage3-spidering', { executionId: exec.id }, { removeOnComplete: true });
        return res.json({ ok: true });
    }
    return res.status(400).json({ error: 'unsupported stage transition' });
});
export default router;
