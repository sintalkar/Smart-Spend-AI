import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: String, required: true }, // Format: YYYY-MM
  totalBudget: { type: Number, required: true },
  alertTriggered: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Budget = mongoose.model('Budget', budgetSchema);
export default Budget;
