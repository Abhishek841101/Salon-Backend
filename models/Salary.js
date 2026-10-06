
import mongoose from "mongoose";

const salarySchema = new mongoose.Schema(
  {
    // ============================================
    // TENANT
    // ============================================

    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: [true, "Salon ID is required"],
      index: true,
    },

    // ============================================
    // STYLIST
    // ============================================

    stylist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stylist",
      required: true,
      index: true,
    },

    // Example: 2026-10
    month: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}$/,
      index: true,
    },

    // ============================================
    // EARNINGS
    // ============================================

    basicSalary: {
      type: Number,
      min: 0,
      default: 0,
    },

    overtimeSalary: {
      type: Number,
      min: 0,
      default: 0,
    },

    commission: {
      type: Number,
      min: 0,
      default: 0,
    },

    bonus: {
      type: Number,
      min: 0,
      default: 0,
    },

    // ============================================
    // DEDUCTIONS
    // ============================================

    advance: {
      type: Number,
      min: 0,
      default: 0,
    },

    deduction: {
      type: Number,
      min: 0,
      default: 0,
    },

    // ============================================
    // FINAL
    // ============================================

    grossSalary: {
      type: Number,
      min: 0,
      default: 0,
    },

    netSalary: {
      type: Number,
      min: 0,
      default: 0,
    },

    // ============================================
    // PAYMENT
    // ============================================

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID"],
      default: "PENDING",
      index: true,
    },

    paymentDate: {
      type: Date,
      default: null,
    },

    paymentMethod: {
      type: String,
      enum: [
        "CASH",
        "BANK_TRANSFER",
        "UPI",
        "OTHER",
      ],
      default: "CASH",
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

// ============================================
// TENANT-SCOPED INDEXES
// ============================================

// One salary record per stylist per month
// INSIDE ONE SALON.
salarySchema.index(
  {
    salonId: 1,
    stylist: 1,
    month: 1,
  },
  {
    unique: true,
  }
);

salarySchema.index({
  salonId: 1,
  month: 1,
  paymentStatus: 1,
});

salarySchema.index({
  salonId: 1,
  stylist: 1,
  month: -1,
});

const Salary =
  mongoose.models.Salary ||
  mongoose.model("Salary", salarySchema);

export default Salary;
