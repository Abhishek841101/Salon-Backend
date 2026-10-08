
import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    // ========================================
    // SALON
    // ========================================

    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: [true, "Salon ID is required"],
      index: true,
    },

    // ========================================
    // SERVICE GROUP
    // ========================================
    // Example:
    // Hair Services
    // Skin Services
    // Grooming
    // Nail Services
    // Makeup
    // Spa
    // etc.

    serviceGroup: {
      type: String,
      trim: true,
      default: "General",
      maxlength: 100,
      index: true,
    },

    // ========================================
    // BASIC DETAILS
    // ========================================

    name: {
      type: String,
      required: [true, "Service name is required"],
      trim: true,
      maxlength: 100,
    },

    category: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
      index: true,
    },

    price: {
      type: Number,
      required: [true, "Service price is required"],
      min: 0,
    },

    duration: {
      type: Number,
      default: 30,
      min: 1,
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    // ========================================
    // SERVICE IMAGE
    // ========================================

    image: {
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
    // STATUS
    // ========================================

    isActive: {
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
// SEARCH INDEX
// ========================================

serviceSchema.index({
  name: "text",
  category: "text",
  serviceGroup: "text",
  description: "text",
});

// ========================================
// SALON + SERVICE GROUP INDEX
// ========================================

serviceSchema.index({
  salonId: 1,
  serviceGroup: 1,
});

// ========================================
// SALON + CATEGORY INDEX
// ========================================

serviceSchema.index({
  salonId: 1,
  category: 1,
});

// ========================================
// DUPLICATE SERVICE PROTECTION
// ========================================
// Same salon me same group + same service name
// duplicate nahi hona chahiye.

serviceSchema.index(
  {
    salonId: 1,
    serviceGroup: 1,
    name: 1,
  },
  {
    unique: true,
    collation: {
      locale: "en",
      strength: 2,
    },
  }
);

// ========================================
// MODEL
// ========================================

const Service =
  mongoose.models.Service ||
  mongoose.model("Service", serviceSchema);

export default Service;
