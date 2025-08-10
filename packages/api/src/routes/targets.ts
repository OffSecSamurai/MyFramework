import { Router } from 'express';
import { prisma } from '../app';

const router = Router();

// GET /targets
router.get('/', async (_req, res) => {
  const targets = await prisma.target.findMany({ include: { executions: true } });
  res.json(targets);
});

// POST /targets
router.post('/', async (req, res) => {
  const { name, root } = req.body;
  if (!name || !root) return res.status(400).json({ error: 'name and root required' });
  const target = await prisma.target.create({ data: { name, root } });
  res.status(201).json(target);
});

export default router;