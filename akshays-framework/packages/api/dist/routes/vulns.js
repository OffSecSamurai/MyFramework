import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const router = Router();
router.get('/by-execution/:executionId', async (req, res) => {
    const vulns = await prisma.vulnerability.findMany({ where: { executionId: req.params.executionId }, orderBy: { createdAt: 'desc' } });
    res.json(vulns);
});
export default router;
