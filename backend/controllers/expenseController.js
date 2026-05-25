import Expense from '../models/Expense.js';
import Budget from '../models/Budget.js';

export const addExpense = async (req, res, next) => {
  try {
    const { name, category, amount, note, date } = req.body;
    const userId = req.user.id;

    if (!name || !category || amount === undefined) {
      return res.status(400).json({ success: false, message: "Please provide name, category, and amount", errors: [] });
    }

    const expense = await Expense.create({
      userId,
      name,
      category,
      amount,
      note,
      date: date ? new Date(date) : undefined
    });

    const month = expense.month; 

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

    const spendingPercentage = budget.totalBudget > 0 ? (totalSpent / budget.totalBudget) * 100 : 0;

    let alertRequired = false;
    if (spendingPercentage >= 60 && !budget.alertTriggered) {
      budget.alertTriggered = true;
      await budget.save();
      alertRequired = true;
    }

    res.status(201).json({
      success: true,
      data: {
        expense,
        alertRequired,
        spendingPercentage: Math.round(spendingPercentage)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAllExpenses = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const date = new Date();
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const expenses = await Expense.find({ userId, month }).sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: expenses
    });
  } catch (error) {
    next(error);
  }
};

export const getExpenseHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const month = req.query.month;

    if (!month) {
      return res.status(400).json({ success: false, message: "Please specify month query param (YYYY-MM)", errors: [] });
    }

    const expenses = await Expense.find({ userId, month }).sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: expenses
    });
  } catch (error) {
    next(error);
  }
};

export const editExpense = async (req, res, next) => {
  try {
    const { name, category, amount, note, date } = req.body;
    const userId = req.user.id;
    const { id } = req.params;

    let expense = await Expense.findOne({ _id: id, userId });
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found", errors: [] });
    }

    expense.name = name || expense.name;
    expense.category = category || expense.category;
    expense.amount = amount !== undefined ? amount : expense.amount;
    expense.note = note !== undefined ? note : expense.note;
    if (date) {
      expense.date = new Date(date);
    }
    await expense.save();

    res.status(200).json({
      success: true,
      data: expense
    });
  } catch (error) {
    next(error);
  }
};

export const deleteExpense = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const expense = await Expense.findOneAndDelete({ _id: id, userId });
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found", errors: [] });
    }

    res.status(200).json({
      success: true,
      message: "Expense deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};

export const getSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const date = new Date();
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const budgetDoc = await Budget.findOne({ userId, month });
    const totalBudget = budgetDoc ? budgetDoc.totalBudget : 0;

    const expenses = await Expense.find({ userId, month });

    const categoriesMap = {};
    expenses.forEach(e => {
      categoriesMap[e.category] = (categoriesMap[e.category] || 0) + e.amount;
    });

    const categorySummary = Object.keys(categoriesMap).map(cat => ({
      category: cat,
      totalSpent: categoriesMap[cat],
      transactionCount: expenses.filter(e => e.category === cat).length,
      percentageOfBudget: totalBudget > 0 ? Number(((categoriesMap[cat] / totalBudget) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.totalSpent - a.totalSpent);

    res.status(200).json({
      success: true,
      data: categorySummary
    });
  } catch (error) {
    next(error);
  }
};
