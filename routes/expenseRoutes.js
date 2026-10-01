import express from "express";

import {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
} from "../controllers/expenseController.js";

const router = express.Router();

// ========================================
// CREATE EXPENSE
// POST /api/expenses
// ========================================

router.post("/", createExpense);

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

router.get("/summary", getExpenseSummary);

// ========================================
// GET ALL EXPENSES
// GET /api/expenses
// ========================================

router.get("/", getExpenses);

// ========================================
// GET SINGLE EXPENSE
// GET /api/expenses/:id
// ========================================

router.get("/:id", getExpenseById);

// ========================================
// UPDATE EXPENSE
// PATCH /api/expenses/:id
// ========================================

router.patch("/:id", updateExpense);

// ========================================
// DELETE EXPENSE
// DELETE /api/expenses/:id
// ========================================

router.delete("/:id", deleteExpense);

export default router;