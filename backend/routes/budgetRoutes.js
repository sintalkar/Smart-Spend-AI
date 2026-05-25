import express from 'express';
import { setBudget, getCurrentBudget, getBudgetHistory } from '../controllers/budgetController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/set', protect, setBudget);
router.get('/current', protect, getCurrentBudget);
router.get('/history', protect, getBudgetHistory);

export default router;
