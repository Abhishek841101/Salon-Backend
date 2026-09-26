import express from "express";

import {
  markAttendance,
  getAttendance,
  getAttendanceById,
  deleteAttendance,
} from "../controllers/attendanceController.js";

const router = express.Router();

// Create / update attendance
router.post("/", markAttendance);

// Get attendance
router.get("/", getAttendance);

// Get single attendance
router.get("/:id", getAttendanceById);

// Delete attendance
router.delete("/:id", deleteAttendance);

export default router;