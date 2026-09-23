import express from "express";

import {
  getDashboardSummary,
  getRecentBills,
} from "../controllers/dashboardController.js";

const router = express.Router();

// Dashboard summary
router.get("/summary", getDashboardSummary);

// Recent bills
router.get("/recent-bills", getRecentBills);

export default router;