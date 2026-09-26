import express from "express";

import {
  createBill,
  getBills,
  getBillById,
  getBillByInvoiceNumber,
  updatePaymentStatus,
  getTotalRevenue,
} from "../controllers/billController.js";

const router = express.Router();

// ========================================
// CREATE BILL
// POST /api/bills
// ========================================

router.post("/", createBill);

// ========================================
// GET TOTAL REVENUE
// GET /api/bills/revenue
// ========================================

router.get("/revenue", getTotalRevenue);

// ========================================
// GET ALL BILLS
// GET /api/bills
// ========================================

router.get("/", getBills);

// ========================================
// GET BILL BY INVOICE NUMBER
// GET /api/bills/invoice/:invoiceNumber
// ========================================

router.get(
  "/invoice/:invoiceNumber",
  getBillByInvoiceNumber
);

// ========================================
// GET SINGLE BILL
// GET /api/bills/:id
// ========================================

router.get("/:id", getBillById);

// ========================================
// UPDATE PAYMENT STATUS
// PATCH /api/bills/:id/payment
// ========================================

router.patch(
  "/:id/payment",
  updatePaymentStatus
);

export default router;