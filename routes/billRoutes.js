
import express from "express";

import {
  createBill,
  getBills,
  getBillById,
  getBillByInvoiceNumber,
  updatePaymentStatus,
  getTotalRevenue,
} from "../controllers/billController.js";

import {
  protectAdmin,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// ========================================
// ALL BILL ROUTES = ADMIN ONLY
// ========================================

// ========================================
// CREATE BILL
// POST /api/bills
// ========================================

router.post(
  "/",
  protectAdmin,
  createBill
);

// ========================================
// GET TOTAL REVENUE
// GET /api/bills/revenue
// ========================================

router.get(
  "/revenue",
  protectAdmin,
  getTotalRevenue
);

// ========================================
// GET ALL BILLS
// GET /api/bills
// ========================================

router.get(
  "/",
  protectAdmin,
  getBills
);

// ========================================
// GET BILL BY INVOICE NUMBER
// GET /api/bills/invoice/:invoiceNumber
// ========================================

router.get(
  "/invoice/:invoiceNumber",
  protectAdmin,
  getBillByInvoiceNumber
);

// ========================================
// GET SINGLE BILL
// GET /api/bills/:id
// ========================================

router.get(
  "/:id",
  protectAdmin,
  getBillById
);

// ========================================
// UPDATE PAYMENT STATUS
// PATCH /api/bills/:id/payment
// ========================================

router.patch(
  "/:id/payment",
  protectAdmin,
  updatePaymentStatus
);

export default router;
