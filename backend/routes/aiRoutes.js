import express from 'express';
import {
  analyzeSpending,
  getLastInsight,
  categorizeTransaction,
  scanReceipt,
  chatWithCA,
  getFinancialScoreTips,
  getGoalTipsController
} from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/analyze', protect, analyzeSpending);
router.get('/last-insight', protect, getLastInsight);
router.post('/categorize', protect, categorizeTransaction);
router.post('/scan-receipt', protect, scanReceipt);
router.post('/assistant', protect, chatWithCA);
router.post('/score-tips', protect, getFinancialScoreTips);
router.post('/goal-tips', protect, getGoalTipsController);

export default router;
