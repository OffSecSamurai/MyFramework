import { Router } from 'express';
import { prisma } from '../app';
import path from 'path';

const router = Router();

// GET /artifacts/:id/download
router.get('/:id/download', async (req, res) => {
  const artifact = await prisma.artifact.findUnique({ where: { id: req.params.id } });
  if (!artifact) return res.status(404).json({ error: 'Not found' });

  return res.download(path.resolve(artifact.path));
});

export default router;