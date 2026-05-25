import express from 'express';
import { analyzeSpending, getLastInsight } from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/analyze', protect, analyzeSpending);
router.get('/last-insight', protect, getLastInsight);

export default router;
