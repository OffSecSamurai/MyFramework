import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const router = Router();
router.get('/', async (_req, res) => {
    const targets = await prisma.target.findMany({ orderBy: { createdAt: 'desc' }, include: { executions: true } });
    res.json(targets);
});
router.get('/:name', async (req, res) => {
    const target = await prisma.target.findUnique({ where: { name: req.params.name }, include: { executions: true } });
    if (!target)
        return res.status(404).json({ error: 'not found' });
    res.json(target);
});
export default router;
