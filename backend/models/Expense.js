import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  category: {
    type: String,
    required: true,
    enum: ["Food & Dining", "Transport", "Entertainment",
           "Shopping", "Bills & Utilities", "Health", "Others"]
  },
  amount: { type: Number, required: true, min: 1 },
  date: { type: Date, default: Date.now },
  month: { type: String }, // Auto-set (YYYY-MM)
  note: { type: String }
});

// Auto-set the "month" field from the expense date
expenseSchema.pre('save', function (next) {
  if (this.date) {
    const d = new Date(this.date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    this.month = `${year}-${month}`;
  }
  next();
});

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
