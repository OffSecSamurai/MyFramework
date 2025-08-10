import { Router } from 'express';
import { asyncHandler } from '@/middleware/async';

const router = Router();

/**
 * @route   GET /api/executions
 * @desc    Get all executions (placeholder)
 * @access  Public
 */
router.get('/', asyncHandler(async (req, res) => {
  res.json({
    message: 'Executions endpoint - Coming in Phase 2: Reconnaissance',
    phase: 'reconnaissance',
    status: 'pending'
  });
}));

export default router;