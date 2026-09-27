import express from "express";

import {
  createStylist,
  getStylists,
  getStylistById,
  getStylistProfile,
  updateStylist,
  deleteStylist,
} from "../controllers/stylistController.js";

import {
  markAttendance,
  getStylistAttendance,
  getAttendanceSummary,
} from "../controllers/stylistAttendanceController.js";

import {
  protectAdmin,
} from "../middleware/authMiddleware.js";

const router =
  express.Router();

// ======================================================
// CREATE
// POST /api/stylists
// ======================================================

router.post(
  "/",
  protectAdmin,
  createStylist
);

// ======================================================
// GET ALL
// GET /api/stylists
// ======================================================

router.get(
  "/",
  protectAdmin,
  getStylists
);

// ======================================================
// PROFILE
// GET /api/stylists/:id/profile
//
// ?period=week
// ?period=month
// ?startDate=2026-09-01&endDate=2026-09-30
// ======================================================

router.get(
  "/:id/profile",
  protectAdmin,
  getStylistProfile
);

// ======================================================
// ATTENDANCE
// ======================================================

// POST /api/stylists/:id/attendance
router.post(
  "/:id/attendance",
  protectAdmin,
  markAttendance
);

// GET /api/stylists/:id/attendance
router.get(
  "/:id/attendance",
  protectAdmin,
  getStylistAttendance
);

// GET /api/stylists/:id/attendance-summary
router.get(
  "/:id/attendance-summary",
  protectAdmin,
  getAttendanceSummary
);

// ======================================================
// GET SINGLE
// GET /api/stylists/:id
// ======================================================

router.get(
  "/:id",
  protectAdmin,
  getStylistById
);

// ======================================================
// UPDATE
// PATCH /api/stylists/:id
// ======================================================

router.patch(
  "/:id",
  protectAdmin,
  updateStylist
);

// ======================================================
// DELETE
// DELETE /api/stylists/:id
// ======================================================

router.delete(
  "/:id",
  protectAdmin,
  deleteStylist
);

export default router;