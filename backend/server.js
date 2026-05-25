import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import { errorHandler } from './middleware/errorMiddleware.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Bind routing paths
app.use('/api/auth', authRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/ai', aiRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({ success: true, message: "Smart Spend AI API is running" });
});

// Global error handler middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[Server] running on http://localhost:${PORT}`);
});
