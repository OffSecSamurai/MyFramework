import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

router.get('/by-execution/:executionId', async (req, res) => {
  const artifacts = await prisma.artifact.findMany({ where: { executionId: req.params.executionId } });
  res.json(artifacts);
});

export default router;