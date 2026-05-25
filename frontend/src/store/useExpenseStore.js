import { create } from 'zustand';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';

const useExpenseStore = create((set, get) => ({
  expenses: [],
  currentBudget: null,
  totalSpent: 0,
  summary: [],
  aiInsight: null,
  loadingExpenses: false,
  loadingBudget: false,
  loadingAI: false,

  fetchCurrentBudget: async () => {
    set({ loadingBudget: true });
    try {
      const res = await axiosInstance.get('/budget/current');
      if (res.data.success) {
        set({
          currentBudget: res.data.data.budget,
          totalSpent: res.data.data.totalSpent
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      set({ loadingBudget: false });
    }
  },

  setMonthlyBudget: async (totalBudget) => {
    const date = new Date();
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    try {
      const res = await axiosInstance.post('/budget/set', { month, totalBudget });
      if (res.data.success) {
        set({ currentBudget: res.data.data });
        toast.success(`Monthly budget set to ₹${totalBudget.toLocaleString()}`);
        get().fetchCurrentBudget();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update budget');
    }
  },

  fetchExpenses: async () => {
    set({ loadingExpenses: true });
    try {
      const res = await axiosInstance.get('/expenses/all');
      if (res.data.success) {
        set({ expenses: res.data.data });
      }
    } catch (err) {
      console.error(err);
    } finally {
      set({ loadingExpenses: false });
    }
  },

  fetchSummary: async () => {
    try {
      const res = await axiosInstance.get('/expenses/summary');
      if (res.data.success) {
        set({ summary: res.data.data });
      }
    } catch (err) {
      console.error(err);
    }
  },

  addExpense: async (expenseData) => {
    try {
      const res = await axiosInstance.post('/expenses/add', expenseData);
      if (res.data.success) {
        const { expense, alertRequired, spendingPercentage } = res.data.data;
        set((state) => ({
          expenses: [expense, ...state.expenses],
          totalSpent: state.totalSpent + expense.amount
        }));
        toast.success(`Added ${expense.name}`);
        get().fetchCurrentBudget();
        get().fetchSummary();
        return { alertRequired, spendingPercentage };
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add expense');
      return { alertRequired: false, spendingPercentage: 0 };
    }
  },

  deleteExpense: async (id) => {
    try {
      const res = await axiosInstance.delete(`/expenses/${id}`);
      if (res.data.success) {
        set((state) => {
          const removed = state.expenses.find(e => e._id === id);
          const amt = removed ? removed.amount : 0;
          return {
            expenses: state.expenses.filter(e => e._id !== id),
            totalSpent: Math.max(0, state.totalSpent - amt)
          };
        });
        toast.success('Expense deleted');
        get().fetchCurrentBudget();
        get().fetchSummary();
      }
    } catch (err) {
      toast.error('Failed to delete expense');
    }
  },

  editExpense: async (id, updatedData) => {
    try {
      const res = await axiosInstance.put(`/expenses/${id}`, updatedData);
      if (res.data.success) {
        toast.success('Expense updated');
        get().fetchExpenses();
        get().fetchCurrentBudget();
        get().fetchSummary();
      }
    } catch (err) {
      toast.error('Failed to update expense');
    }
  },

  triggerAIAnalysis: async () => {
    set({ loadingAI: true });
    try {
      const res = await axiosInstance.post('/ai/analyze');
      if (res.data.success) {
        set({ aiInsight: res.data.data });
        toast.success('AI insights generated!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'AI engine is busy. Please try again.');
    } finally {
      set({ loadingAI: false });
    }
  },

  fetchLastInsight: async () => {
    try {
      const res = await axiosInstance.get('/ai/last-insight');
      if (res.data.success) {
        set({ aiInsight: res.data.data });
      }
    } catch (err) {
      // Ignored non-critical failure
    }
  }
}));

export default useExpenseStore;
