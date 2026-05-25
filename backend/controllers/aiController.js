import { getAIAnalysis } from '../services/aiService.js';
import Insight from '../models/Insight.js';

export const analyzeSpending = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const date = new Date();
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    console.log(`[AI Analysis] Triggering Claude analysis for user: ${userId}, month: ${month}`);
    const analysis = await getAIAnalysis(userId, month);

    // Save/update cache
    await Insight.findOneAndUpdate(
      { userId, month },
      { insightData: analysis, createdAt: new Date() },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      data: analysis
    });
  } catch (error) {
    next(error);
  }
};

export const getLastInsight = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const latestInsight = await Insight.findOne({ userId }).sort({ createdAt: -1 });

    if (!latestInsight) {
      return res.status(404).json({
        success: false,
        message: "No AI insights generated yet. Trigger full AI analysis first.",
        errors: []
      });
    }

    res.status(200).json({
      success: true,
      data: latestInsight.insightData
    });
  } catch (error) {
    next(error);
  }
};
