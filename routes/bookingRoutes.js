import express from "express";

import {
  createBooking,
  getBookings,
  getBookingById,
  confirmBooking,
  completeBooking,
  cancelBooking,
  updateBooking,
} from "../controllers/bookingController.js";

import { protectAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// ======================================================
// ALL BOOKING ROUTES = ADMIN ONLY
// ======================================================

// CREATE
router.post(
  "/",
  protectAdmin,
  createBooking
);

// GET ALL
router.get(
  "/",
  protectAdmin,
  getBookings
);

// GET SINGLE
router.get(
  "/:id",
  protectAdmin,
  getBookingById
);

// UPDATE
router.put(
  "/:id",
  protectAdmin,
  updateBooking
);

// CONFIRM
router.patch(
  "/:id/confirm",
  protectAdmin,
  confirmBooking
);

// COMPLETE
router.patch(
  "/:id/complete",
  protectAdmin,
  completeBooking
);

// CANCEL
router.patch(
  "/:id/cancel",
  protectAdmin,
  cancelBooking
);

export default router;