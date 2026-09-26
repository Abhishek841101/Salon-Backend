import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import Stylist from "../models/Stylist.js";

// ======================================================
// CREATE / UPDATE ATTENDANCE
// POST /api/attendance
// ======================================================

export const markAttendance = async (req, res) => {
  try {
    const {
      staffId,
      date,
      status,
      checkIn,
      checkOut,
      notes,
    } = req.body;

    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: "Staff ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }

    const staff = await Stylist.findById(staffId);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }

    const attendanceDate = date
      ? new Date(date)
      : new Date();

    if (Number.isNaN(attendanceDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance date",
      });
    }

    attendanceDate.setHours(0, 0, 0, 0);

    const attendance =
      await Attendance.findOneAndUpdate(
        {
          staff: staffId,
          date: attendanceDate,
        },
        {
          staff: staffId,
          date: attendanceDate,
          status: status || "Present",
          checkIn: checkIn || "",
          checkOut: checkOut || "",
          notes: notes || "",
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      ).populate(
        "staff",
        "name phone email specialization status"
      );

    return res.status(200).json({
      success: true,
      message: "Attendance saved successfully",
      attendance,
    });
  } catch (error) {
    console.error(
      "MARK ATTENDANCE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to save attendance",
      error: error.message,
    });
  }
};

// ======================================================
// GET ATTENDANCE
// GET /api/attendance
// ======================================================

export const getAttendance = async (req, res) => {
  try {
    const {
      date,
      staffId,
      startDate,
      endDate,
    } = req.query;

    const filter = {};

    if (
      staffId &&
      mongoose.Types.ObjectId.isValid(staffId)
    ) {
      filter.staff = staffId;
    }

    if (date) {
      const selectedDate = new Date(date);

      if (Number.isNaN(selectedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date",
        });
      }

      const nextDate = new Date(selectedDate);

      selectedDate.setHours(0, 0, 0, 0);
      nextDate.setHours(0, 0, 0, 0);
      nextDate.setDate(nextDate.getDate() + 1);

      filter.date = {
        $gte: selectedDate,
        $lt: nextDate,
      };
    } else if (startDate || endDate) {
      filter.date = {};

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.date.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() + 1);
        filter.date.$lt = end;
      }
    }

    const attendance = await Attendance.find(filter)
      .populate(
        "staff",
        "name phone email specialization status"
      )
      .sort({
        date: -1,
        createdAt: -1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      count: attendance.length,
      attendance,
    });
  } catch (error) {
    console.error(
      "GET ATTENDANCE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance",
      error: error.message,
    });
  }
};

// ======================================================
// GET SINGLE ATTENDANCE
// GET /api/attendance/:id
// ======================================================

export const getAttendanceById = async (
  req,
  res
) => {
  try {
    const attendance =
      await Attendance.findById(
        req.params.id
      ).populate(
        "staff",
        "name phone email specialization status"
      );

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance not found",
      });
    }

    return res.status(200).json({
      success: true,
      attendance,
    });
  } catch (error) {
    console.error(
      "GET ATTENDANCE BY ID ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance",
      error: error.message,
    });
  }
};

// ======================================================
// DELETE ATTENDANCE
// DELETE /api/attendance/:id
// ======================================================

export const deleteAttendance = async (
  req,
  res
) => {
  try {
    const attendance =
      await Attendance.findByIdAndDelete(
        req.params.id
      );

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE ATTENDANCE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete attendance",
      error: error.message,
    });
  }
};