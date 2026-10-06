
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
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
    // PRODUCT NAME
    // ========================================

    name: {
      type: String,
      required: true,
      trim: true,
    },

    // ========================================
    // BRAND
    // ========================================

    brand: {
      type: String,
      trim: true,
      default: "",
    },

    // ========================================
    // CATEGORY
    // ========================================

    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // ========================================
    // UNIT
    // ========================================

    unit: {
      type: String,
      required: true,
      trim: true,
    },

    // ========================================
    // CURRENT STOCK
    // ========================================

    currentStock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // ========================================
    // MINIMUM STOCK
    // ========================================

    minimumStock: {
      type: Number,
      min: 0,
      default: 0,
    },

    // ========================================
    // PURCHASE PRICE
    // ========================================

    purchasePrice: {
      type: Number,
      min: 0,
      default: 0,
    },

    // ========================================
    // VENDOR
    // ========================================

    vendor: {
      type: String,
      trim: true,
      default: "",
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
    // ACTIVE STATUS
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
// INDEXES
// ========================================

productSchema.index({
  name: "text",
  brand: "text",
  category: "text",
});

productSchema.index({
  salonId: 1,
  category: 1,
});

productSchema.index({
  salonId: 1,
  isActive: 1,
});

productSchema.index({
  salonId: 1,
  currentStock: 1,
});

productSchema.index({
  salonId: 1,
  minimumStock: 1,
});

// ========================================
// STOCK STATUS VIRTUAL
// ========================================

productSchema.virtual("stockStatus").get(function () {
  if (this.currentStock === 0) {
    return "Out of Stock";
  }

  if (
    this.minimumStock > 0 &&
    this.currentStock <= this.minimumStock
  ) {
    return "Low Stock";
  }

  return "In Stock";
});

// ========================================
// JSON / OBJECT VIRTUALS
// ========================================

productSchema.set("toJSON", {
  virtuals: true,
});

productSchema.set("toObject", {
  virtuals: true,
});

// ========================================
// MODEL
// ========================================

const Product =
  mongoose.models.Product ||
  mongoose.model("Product", productSchema);

export default Product;
