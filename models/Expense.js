import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    // ========================================
    // EXPENSE TITLE
    // ========================================
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // ========================================
    // CATEGORY
    // ========================================
    category: {
      type: String,
      required: true,
      enum: [
        "Staff Salary",
        "Product Purchase",
        "Rent",
        "Electricity",
        "Maintenance",
        "Marketing",
        "Water",
        "Internet",
        "Equipment",
        "Other",
      ],
      index: true,
    },

    // ========================================
    // AMOUNT
    // ========================================
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // ========================================
    // PAYMENT METHOD
    // ========================================
    paymentMethod: {
      type: String,
      enum: ["Cash", "UPI", "Card", "Bank Transfer", "Other"],
      default: "Cash",
    },

    // ========================================
    // PAID TO / VENDOR
    // ========================================
    paidTo: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    // ========================================
    // EXPENSE DATE
    // ========================================
    expenseDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    // ========================================
    // NOTES
    // ========================================
    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    // ========================================
    // STATUS
    // ========================================
    status: {
      type: String,
      enum: ["Paid", "Pending"],
      default: "Paid",
      index: true,
    },

    // ========================================
    // ACTIVE
    // ========================================
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// ========================================
// INDEXES
// ========================================

expenseSchema.index({
  expenseDate: -1,
});

expenseSchema.index({
  category: 1,
  expenseDate: -1,
});

expenseSchema.index({
  active: 1,
  expenseDate: -1,
});

const Expense = mongoose.model("Expense", expenseSchema);

export default Expense;