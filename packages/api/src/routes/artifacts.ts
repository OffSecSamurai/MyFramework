import { Router } from 'express';
import { asyncHandler } from '@/middleware/async';

const router = Router();

/**
 * @route   GET /api/artifacts
 * @desc    Get all artifacts (placeholder)
 * @access  Public
 */
router.get('/', asyncHandler(async (req, res) => {
  res.json({
    message: 'Artifacts endpoint - Coming in Phase 3: Vulnerability Discovery',
    phase: 'vulnerability_discovery',
    status: 'pending'
  });
}));

export default router;