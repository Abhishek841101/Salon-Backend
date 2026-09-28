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
//
// GET /api/stylists
//
// Search:
// /api/stylists?search=rahul
// /api/stylists?search=9876543210
//
// Status:
// /api/stylists?status=ACTIVE
// ======================================================

router.get(
  "/",
  protectAdmin,
  getStylists
);

// ======================================================
// PROFILE
//
// GET /api/stylists/:id/profile
//
// ?period=week
// ?period=month
//
// OR
//
// ?startDate=2026-09-01
// &endDate=2026-09-30
// ======================================================

router.get(
  "/:id/profile",
  protectAdmin,
  getStylistProfile
);

// ======================================================
// ATTENDANCE
// ======================================================

// ------------------------------------------------------
// CHECK-IN / CHECK-OUT / UPDATE
//
// POST /api/stylists/:id/attendance
// ------------------------------------------------------

router.post(
  "/:id/attendance",
  protectAdmin,
  markAttendance
);

// ------------------------------------------------------
// ATTENDANCE HISTORY
//
// GET /api/stylists/:id/attendance
//
// ?startDate=2026-09-01
// &endDate=2026-09-30
// ------------------------------------------------------

router.get(
  "/:id/attendance",
  protectAdmin,
  getStylistAttendance
);

// ------------------------------------------------------
// ATTENDANCE SUMMARY
//
// GET /api/stylists/:id/attendance-summary
// ------------------------------------------------------

router.get(
  "/:id/attendance-summary",
  protectAdmin,
  getAttendanceSummary
);

// ======================================================
// GET SINGLE
//
// GET /api/stylists/:id
// ======================================================

router.get(
  "/:id",
  protectAdmin,
  getStylistById
);

// ======================================================
// UPDATE
//
// PATCH /api/stylists/:id
// ======================================================

router.patch(
  "/:id",
  protectAdmin,
  updateStylist
);

// ======================================================
// DELETE
//
// DELETE /api/stylists/:id
// ======================================================

router.delete(
  "/:id",
  protectAdmin,
  deleteStylist
);

export default router;