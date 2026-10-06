
import express from "express";

import {
  getDashboardSummary,
  getRecentBills,
} from "../controllers/dashboardController.js";

import { protectAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// ========================================
// DASHBOARD SUMMARY
// GET /api/dashboard/summary
// ========================================

router.get(
  "/summary",
  protectAdmin,
  getDashboardSummary
);

// ========================================
// RECENT BILLS
// GET /api/dashboard/recent-bills
// ========================================

router.get(
  "/recent-bills",
  protectAdmin,
  getRecentBills
);

export default router;
