
import express from "express";

import {
  protectAuth,
  requireSuperAdmin,
} from "../middleware/authMiddleware.js";

import upload from "../middleware/upload.js";

import {
  createPaymentOffer,
  getMyPaymentOffer,
  submitPaymentProof,
  getAllPayments,
  approvePayment,
  rejectPayment,
} from "../controllers/paymentController.js";

const router = express.Router();

// Salon Admin: fetch their current offer.
router.get("/my/offer", protectAuth, getMyPaymentOffer);

// Salon Admin: submit transaction ID and payment screenshot.
router.post(
  "/submit",
  protectAuth,
  upload.single("screenshot"),
  submitPaymentProof
);

// Super Admin: create/update the agreed subscription offer.
router.post(
  "/superadmin/salons/:salonId/offer",
  protectAuth,
  requireSuperAdmin,
  createPaymentOffer
);

// Super Admin: view all offers and payment submissions.
router.get(
  "/superadmin",
  protectAuth,
  requireSuperAdmin,
  getAllPayments
);

// Super Admin: manually verify and approve.
router.patch(
  "/superadmin/:paymentId/approve",
  protectAuth,
  requireSuperAdmin,
  approvePayment
);

// Super Admin: reject with a reason.
router.patch(
  "/superadmin/:paymentId/reject",
  protectAuth,
  requireSuperAdmin,
  rejectPayment
);

export default router;
