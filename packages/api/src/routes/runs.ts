import { Router } from 'express';
import { prisma, jobQueue } from '../app';

const router = Router();

// POST /runs/full
router.post('/full', async (req, res) => {
  const { targetId, threads = 50 } = req.body;
  const target = await prisma.target.findUnique({ where: { id: targetId } });
  if (!target) return res.status(404).json({ error: 'Target not found' });

  const execution = await prisma.execution.create({
    data: {
      phase: 'passive-recon',
      status: 'queued',
      targetId: target.id,
      jobId: '' // placeholder
    }
  });

  const job = await jobQueue.add('passive-recon', {
    executionId: execution.id,
    targetRoot: target.root,
    threads
  });

  await prisma.execution.update({ where: { id: execution.id }, data: { jobId: job.id } });

  res.status(202).json({ executionId: execution.id, jobId: job.id });
});

export default router;