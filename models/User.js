import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["trial", "active", "expired", "cancelled"],
      default: "trial",
    },

    plan: {
      type: String,
      enum: ["basic", "professional", "premium", null],
      default: null,
    },

    trialStartDate: {
      type: Date,
      default: null,
    },

    trialEndDate: {
      type: Date,
      default: null,
    },

    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },

    amount: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },

    role: {
      type: String,
      enum: ["superadmin", "admin", "owner", "staff"],
      default: "admin",
    },

    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    subscription: {
      type: subscriptionSchema,
      default: () => ({
        status: "trial",
      }),
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;