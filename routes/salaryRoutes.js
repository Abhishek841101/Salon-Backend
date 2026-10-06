
import express from "express";

import {
  createSalary,
  getSalaries,
  getSalaryById,
  markSalaryPaid,
  markSalaryPending,
  deleteSalary,
} from "../controllers/salaryController.js";

import { protectAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Salary Routes
|--------------------------------------------------------------------------
*/

// Create / generate salary for stylist + month
router.post("/", protectAdmin, createSalary);

// Get all salaries
// GET /api/salaries?month=2026-10
// GET /api/salaries?month=2026-10&status=PENDING
// GET /api/salaries?month=2026-10&search=rahul
router.get("/", protectAdmin, getSalaries);

// Get single salary
router.get("/:id", protectAdmin, getSalaryById);

// Mark salary as PAID
router.patch("/:id/pay", protectAdmin, markSalaryPaid);

// Mark salary as PENDING
router.patch("/:id/pending", protectAdmin, markSalaryPending);

// Delete salary
router.delete("/:id", protectAdmin, deleteSalary);

export default router;
