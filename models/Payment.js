
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ["basic", "professional", "premium"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    durationDays: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["offered", "pending", "approved", "rejected"],
      default: "offered",
      index: true,
    },
    transactionId: {
      type: String,
      trim: true,
      default: null,
    },
    screenshotUrl: {
      type: String,
      default: null,
    },
    screenshotPublicId: {
      type: String,
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: ["upi"],
      default: "upi",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

// A submitted UPI transaction ID can only be used once.
paymentSchema.index(
  { transactionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      transactionId: { $type: "string" },
    },
  }
);

export default mongoose.model("Payment", paymentSchema);
