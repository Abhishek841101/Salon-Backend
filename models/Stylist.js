import mongoose from "mongoose";

const stylistSchema = new mongoose.Schema(
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
      index: true,
    },

    // ======================================================
    // EMPLOYMENT
    // ======================================================

    joiningDate: {
      type: Date,
      default: null,
    },

    // ======================================================
    // SALARY
    // ======================================================

    salaryType: {
      type: String,
      enum: ["MONTHLY", "DAILY"],
      default: "MONTHLY",
      index: true,
    },

    // Used when salaryType = MONTHLY
    monthlySalary: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Used when salaryType = DAILY
    // Salary for normal standard working day
    basicSalary8h: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Overtime amount per hour
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

// ======================================================
// SEARCH INDEX
// ======================================================

stylistSchema.index({
  name: "text",
  phone: "text",
  email: "text",
  specialization: "text",
});

// ======================================================
// MODEL
// ======================================================

const Stylist =
  mongoose.models.Stylist ||
  mongoose.model("Stylist", stylistSchema);

export default Stylist;