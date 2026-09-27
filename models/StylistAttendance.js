import mongoose from "mongoose";

const stylistAttendanceSchema = new mongoose.Schema(
  {
    stylist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stylist",
      required: true,
      index: true,
    },

    date: {
      type: Date,
      required: true,
      index: true,
    },

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

    checkIn: {
      type: Date,
      default: null,
    },

    checkOut: {
      type: Date,
      default: null,
    },

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

// One attendance record per stylist per date
stylistAttendanceSchema.index(
  {
    stylist: 1,
    date: 1,
  },
  {
    unique: true,
  }
);

const StylistAttendance =
  mongoose.model(
    "StylistAttendance",
    stylistAttendanceSchema
  );

export default StylistAttendance;