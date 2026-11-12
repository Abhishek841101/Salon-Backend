

import mongoose from "mongoose";

// ========================================
// SUBSCRIPTION SCHEMA
// ========================================

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

    // ----------------------------------------
    // DEFAULT FREE TRIAL
    // ----------------------------------------

    trialStartDate: {
      type: Date,
      default: null,
    },

    trialEndDate: {
      type: Date,
      default: null,
    },

    // ----------------------------------------
    // PAID SUBSCRIPTION
    // ----------------------------------------

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

    // ----------------------------------------
    // SUPER ADMIN TRIAL EXTENSION
    // ----------------------------------------

    trialExtensionDays: {
      type: Number,
      default: 0,
    },

    trialExtensionCount: {
      type: Number,
      default: 0,
    },

    lastTrialExtendedAt: {
      type: Date,
      default: null,
    },

    lastTrialExtendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ----------------------------------------
    // TRIAL EXTENSION HISTORY
    // ----------------------------------------

    trialExtensionHistory: [
      {
        days: {
          type: Number,
          required: true,
        },

        previousEndDate: {
          type: Date,
          default: null,
        },

        newEndDate: {
          type: Date,
          required: true,
        },

        extendedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },

        extendedAt: {
          type: Date,
          default: Date.now,
        },

        reason: {
          type: String,
          default: "",
          maxlength: 500,
        },
      },
    ],

    // ----------------------------------------
    // TEMPORARY FREE ACCESS
    // FOR EXPIRED PAID PLANS
    // ----------------------------------------

    temporaryAccessEndDate: {
      type: Date,
      default: null,
    },

    // ----------------------------------------
    // TEMPORARY ACCESS HISTORY
    // ----------------------------------------

    temporaryAccessHistory: [
      {
        days: {
          type: Number,
          required: true,
        },

        previousEndDate: {
          type: Date,
          default: null,
        },

        newEndDate: {
          type: Date,
          required: true,
        },

        extendedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },

        extendedAt: {
          type: Date,
          default: Date.now,
        },

        reason: {
          type: String,
          default: "",
          maxlength: 500,
        },
      },
    ],
  },
  {
    _id: false,
  }
);

// ========================================
// USER SCHEMA
// ========================================

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

    // ----------------------------------------
    // USER ROLE
    // ----------------------------------------

    role: {
      type: String,
      enum: ["superadmin", "admin", "owner", "staff"],
      default: "admin",
    },

    // ----------------------------------------
    // SALON REFERENCE
    // ----------------------------------------

    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      default: null,
    },

    // ----------------------------------------
    // ACCOUNT STATUS
    // ----------------------------------------

    isActive: {
      type: Boolean,
      default: true,
    },

    // ----------------------------------------
    // SUBSCRIPTION DETAILS
    // ----------------------------------------

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

// ========================================
// USER MODEL
// ========================================

const User = mongoose.model("User", userSchema);

export default User;
