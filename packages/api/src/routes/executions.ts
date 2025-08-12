import { Router } from 'express';
import { prisma } from '../app';
import path from 'path';
import fs from 'fs';

const router = Router();

// GET /executions/:id/artifacts
router.get('/:id/artifacts', async (req, res) => {
  const execution = await prisma.execution.findUnique({
    where: { id: req.params.id },
    include: { artifacts: true }
  });
  if (!execution) return res.status(404).json({ error: 'Not found' });
  res.json(execution.artifacts);
});

export default router;