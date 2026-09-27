import mongoose from "mongoose";

const stylistSchema = new mongoose.Schema(
  {
    // ======================================================
    // BASIC DETAILS
    // ======================================================

    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    specialization: {
      type: String,
      trim: true,
      default: "",
    },

    experience: {
      type: Number,
      min: 0,
      default: 0,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },

    // ======================================================
    // EMPLOYMENT
    // ======================================================

    joiningDate: {
      type: Date,
      default: null,
    },

    // ======================================================
    // SALARY SETTINGS
    // ======================================================

    salaryType: {
      type: String,
      enum: ["MONTHLY", "DAILY"],
      default: "MONTHLY",
    },

    // Fixed monthly salary
    monthlySalary: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Salary for normal 8-hour working day
    basicSalary8h: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Extra hour / overtime rate
    overtimeRatePerHour: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Normal working hours
    standardWorkingHours: {
      type: Number,
      min: 1,
      default: 8,
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

const Stylist = mongoose.model(
  "Stylist",
  stylistSchema
);

export default Stylist;