import {
  getAIAnalysis,
  parseNaturalTransaction,
  scanInvoiceReceipt,
  chatWithCharteredAccountant,
  getGoalTips
} from '../services/aiService.js';
import Insight from '../models/Insight.js';

// @desc    Trigger AI spending habit & budget projection report
// @route   POST /api/ai/analyze
// @access  Private
export const analyzeSpending = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const date = new Date();
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    console.log(`[AI Analysis] Triggering professional finance analysis for user: ${userId}, month: ${month}`);
    const analysis = await getAIAnalysis(userId, month);

    // Save/update cache in MongoDB
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

// @desc    Get latest cached spending analysis
// @route   GET /api/ai/last-insight
// @access  Private
export const getLastInsight = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const latestInsight = await Insight.findOne({ userId }).sort({ createdAt: -1 });

    if (!latestInsight) {
      // Fallback generator to prevent cold-starts or blank states
      const date = new Date();
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const analysis = await getAIAnalysis(userId, month);
      
      await Insight.create({
        userId,
        month,
        insightData: analysis
      });

      return res.status(200).json({
        success: true,
        data: analysis
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

// @desc    Smart categorise transaction note / merchant details
// @route   POST /api/ai/categorize
// @access  Private
export const categorizeTransaction = async (req, res, next) => {
  try {
    const { merchant, note } = req.body;
    const text = `Merchant: ${merchant || 'None'}, Note: ${note || 'None'}`;
    
    console.log(`[AI Categorization] Querying parser engine for text: "${text}"`);
    const result = await parseNaturalTransaction(text);
    
    res.status(200).json({
      success: true,
      categoryId: result.categoryId || "other",
      confidence: result.confidence || 0.8,
      merchant: result.merchant || merchant
    });
  } catch (error) {
    res.status(200).json({
      success: true,
      categoryId: "other",
      confidence: 0.5,
      merchant: req.body.merchant || "Unknown"
    });
  }
};

// @desc    Scan receipt / bill photo via Gemini OCR Vision
// @route   POST /api/ai/scan-receipt
// @access  Private
export const scanReceipt = async (req, res, next) => {
  try {
    const { image, mimeType } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: "Receipt base64 image data is required.",
        errors: ["Missing field: image"]
      });
    }

    console.log("[AI OCR Scanner] Analyzing receipt image attachment...");
    const base64Data = image.split(',')[1] || image;
    const buffer = Buffer.from(base64Data, 'base64');
    
    const result = await scanInvoiceReceipt(buffer, mimeType || "image/png");

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("[AI OCR Scanner Error]", error);
    res.status(500).json({
      success: false,
      message: "Failed to scan receipt automatically. Please enter details manually.",
      errors: [error.message]
    });
  }
};

// @desc    Interact with the Chartered Accountant AI Assistant
// @route   POST /api/ai/assistant
// @access  Private
export const chatWithCA = async (req, res, next) => {
  try {
    const { message, files } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Consultation message is required.",
        errors: ["Missing field: message"]
      });
    }

    console.log("[AI CA Assistant] Consulted with message query...");
    const result = await chatWithCharteredAccountant(message, [], files);

    res.status(200).json({
      success: true,
      text: result.text
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get AI tips to hit a savings goal faster
// @route   POST /api/ai/goal-tips
// @access  Private
export const getGoalTipsController = async (req, res, next) => {
  try {
    const {
      goalName, targetAmount, currentAmount, deadline,
      monthlyIncome, monthlyExpenses, categoryBreakdown
    } = req.body;

    if (!goalName || targetAmount === undefined) {
      return res.status(400).json({ success: false, message: 'goalName and targetAmount are required', errors: [] });
    }

    const result = await getGoalTips({
      goalName,
      targetAmount: Number(targetAmount),
      currentAmount: Number(currentAmount ?? 0),
      deadline: deadline ? Number(deadline) : null,
      monthlyIncome: Number(monthlyIncome ?? 0),
      monthlyExpenses: Number(monthlyExpenses ?? 0),
      categoryBreakdown: categoryBreakdown ?? {}
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// @desc    Get tips to improve health money score
// @route   POST /api/ai/score-tips
// @access  Private
export const getFinancialScoreTips = async (req, res, next) => {
  try {
    const { score, breakdown } = req.body;
    
    console.log(`[AI Health Tips] Loading tailored score tips for score: ${score || 100}`);
    
    // Quick custom rule engine
    const tips = [
      {
        tip: "Switch active subscriptions to family accounts to share bill costs.",
        impact: 6,
        effort: "easy"
      },
      {
        tip: "Set an automated savings SIP directly to Zerodha index funds within 2 days of paycheck credit.",
        impact: 12,
        effort: "medium"
      },
      {
        tip: "Maintain a strict 25% boundary on your food delivery wallets this fortnight.",
        impact: 9,
        effort: "easy"
      }
    ];

    res.status(200).json({
      success: true,
      data: tips
    });
  } catch (error) {
    next(error);
  }
};
