import mongoose from "mongoose";

const stylistAttendanceSchema = new mongoose.Schema(
  {
    // ======================================================
    // SALON
    // ======================================================

    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: [true, "Salon ID is required"],
      index: true,
    },

    // ======================================================
    // STYLIST
    // ======================================================

    stylist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stylist",
      required: true,
      index: true,
    },

    // ======================================================
    // DATE
    // ======================================================

    date: {
      type: Date,
      required: true,
      index: true,
    },

    // ======================================================
    // ATTENDANCE STATUS
    // ======================================================

    status: {
      type: String,
      enum: [
        "PRESENT",
        "ABSENT",
        "HALF_DAY",
        "LEAVE",
      ],
      default: "PRESENT",
    },

    // ======================================================
    // CHECK IN / CHECK OUT
    // ======================================================

    checkIn: {
      type: Date,
      default: null,
    },

    checkOut: {
      type: Date,
      default: null,
    },

    // ======================================================
    // WORKING HOURS
    // ======================================================

    workedHours: {
      type: Number,
      min: 0,
      default: 0,
    },

    overtimeHours: {
      type: Number,
      min: 0,
      default: 0,
    },

    // ======================================================
    // SALARY
    // ======================================================

    basicSalaryEarned: {
      type: Number,
      min: 0,
      default: 0,
    },

    overtimeSalary: {
      type: Number,
      min: 0,
      default: 0,
    },

    totalSalaryEarned: {
      type: Number,
      min: 0,
      default: 0,
    },

    // ======================================================
    // NOTES
    // ======================================================

    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// ======================================================
// UNIQUE ATTENDANCE
//
// One attendance record per stylist per date
// within each salon.
// ======================================================

stylistAttendanceSchema.index(
  {
    salonId: 1,
    stylist: 1,
    date: 1,
  },
  {
    unique: true,
  }
);

// ======================================================
// MODEL
// ======================================================

const StylistAttendance =
  mongoose.models.StylistAttendance ||
  mongoose.model(
    "StylistAttendance",
    stylistAttendanceSchema
  );

export default StylistAttendance;