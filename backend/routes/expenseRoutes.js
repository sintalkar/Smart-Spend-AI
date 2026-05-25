import express from 'express';
import { addExpense, getAllExpenses, getExpenseHistory, editExpense, deleteExpense, getSummary } from '../controllers/expenseController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/add', protect, addExpense);
router.get('/all', protect, getAllExpenses);
router.get('/history', protect, getExpenseHistory);
router.put('/:id', protect, editExpense);
router.delete('/:id', protect, deleteExpense);
router.get('/summary', protect, getSummary);

export default router;
