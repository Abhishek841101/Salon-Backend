import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
  {
    // ========================================
    // BASIC DETAILS
    // ========================================

    name: {
      type: String,
      required: [true, "Client name is required"],
      trim: true,
      maxlength: 100,
    },

    phone: {
      type: String,
      required: [true, "Client phone number is required"],
      trim: true,
      unique: true,
      index: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    // ========================================
    // PERSONAL DETAILS
    // ========================================

    gender: {
      type: String,
      enum: ["Male", "Female", "Other", ""],
      default: "",
    },

    dateOfBirth: {
      type: Date,
      default: null,
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },

    // ========================================
    // PROFILE IMAGE
    // ========================================

    profileImage: {
      url: {
        type: String,
        default: "",
      },

      publicId: {
        type: String,
        default: "",
      },
    },

    // ========================================
    // NOTES
    // ========================================

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    // ========================================
    // CLIENT STATUS
    // ========================================

    isActive: {
      type: Boolean,
      default: true,
    },

    // ========================================
    // LAST VISIT
    // ========================================

    lastVisitAt: {
      type: Date,
      default: null,
    },

    // ========================================
    // TOTAL VISITS
    // ========================================

    totalVisits: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ========================================
    // TOTAL SPENDING
    // ========================================

    totalSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// ========================================
// NORMALIZE PHONE
// ========================================

// No next() callback needed
clientSchema.pre("save", function () {
  if (this.phone) {
    this.phone = String(this.phone).trim();
  }
});

// ========================================
// SEARCH INDEX
// ========================================

clientSchema.index({
  name: "text",
  phone: "text",
  email: "text",
});

// ========================================
// MODEL
// ========================================

const Client = mongoose.model("Client", clientSchema);

export default Client;