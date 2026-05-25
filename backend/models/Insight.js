import mongoose from 'mongoose';

const insightSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: String, required: true },
  insightData: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Insight = mongoose.model('Insight', insightSchema);
export default Insight;
