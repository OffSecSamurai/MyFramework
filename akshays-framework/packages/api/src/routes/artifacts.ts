import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';

const prisma = new PrismaClient();
const router = Router();

router.get('/by-execution/:executionId', async (req, res) => {
  const artifacts = await prisma.artifact.findMany({ where: { executionId: req.params.executionId } });
  res.json(artifacts);
});

router.get('/download/:artifactId', async (req, res) => {
  const artifact = await prisma.artifact.findUnique({ where: { id: req.params.artifactId } });
  if (!artifact) return res.status(404).json({ error: 'not found' });
  res.sendFile(path.resolve(artifact.path));
});

export default router;