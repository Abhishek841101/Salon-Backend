import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
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

    isActive: {
      type: Boolean,
      default: true,
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
});

// ========================================
// MODEL
// ========================================

const Service =
  mongoose.models.Service ||
  mongoose.model("Service", serviceSchema);

// ========================================
// DEFAULT EXPORT
// ========================================

export default Service;