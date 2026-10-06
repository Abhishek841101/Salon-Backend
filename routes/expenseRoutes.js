
import express from "express";

import {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
} from "../controllers/expenseController.js";

import { protectAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// ========================================
// CREATE EXPENSE
// POST /api/expenses
// ========================================

router.post(
  "/",
  protectAdmin,
  createExpense
);

// ========================================
// EXPENSE SUMMARY
// GET /api/expenses/summary
//
// Examples:
// /api/expenses/summary?period=today
// /api/expenses/summary?period=7days
// /api/expenses/summary?period=month
// /api/expenses/summary?period=year
// ========================================

router.get(
  "/summary",
  protectAdmin,
  getExpenseSummary
);

// ========================================
// GET ALL EXPENSES
// GET /api/expenses
// ========================================

router.get(
  "/",
  protectAdmin,
  getExpenses
);

// ========================================
// GET SINGLE EXPENSE
// GET /api/expenses/:id
// ========================================

router.get(
  "/:id",
  protectAdmin,
  getExpenseById
);

// ========================================
// UPDATE EXPENSE
// PATCH /api/expenses/:id
// ========================================

router.patch(
  "/:id",
  protectAdmin,
  updateExpense
);

// ========================================
// DELETE EXPENSE
// DELETE /api/expenses/:id
// ========================================

router.delete(
  "/:id",
  protectAdmin,
  deleteExpense
);

export default router;
