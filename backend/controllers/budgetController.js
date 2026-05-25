import Budget from '../models/Budget.js';
import Expense from '../models/Expense.js';

export const setBudget = async (req, res, next) => {
  try {
    const { month, totalBudget } = req.body;
    const userId = req.user.id;

    if (!month || totalBudget === undefined) {
      return res.status(400).json({ success: false, message: "Please provide month and totalBudget", errors: [] });
    }

    let budget = await Budget.findOne({ userId, month });

    if (budget) {
      budget.totalBudget = totalBudget;
      budget.alertTriggered = false;
      await budget.save();
    } else {
      budget = await Budget.create({
        userId,
        month,
        totalBudget,
        alertTriggered: false
      });
    }

    res.status(200).json({
      success: true,
      data: budget
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentBudget = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const date = new Date();
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    let budget = await Budget.findOne({ userId, month });
    
    if (!budget) {
      budget = await Budget.create({
        userId,
        month,
        totalBudget: 10000,
        alertTriggered: false
      });
    }

    const expenses = await Expense.find({ userId, month });
    const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);

    res.status(200).json({
      success: true,
      data: {
        budget,
        totalSpent
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getBudgetHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const budgets = await Budget.find({ userId }).sort({ month: -1 });
    res.status(200).json({
      success: true,
      data: budgets
    });
  } catch (error) {
    next(error);
  }
};
