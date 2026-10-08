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
      required: [true, "Product name is required"],
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
      required: [true, "Product category is required"],
      trim: true,
      index: true,
    },

    // ========================================
    // UNIT
    // ========================================

    unit: {
      type: String,
      required: [true, "Product unit is required"],
      trim: true,
    },

    // ========================================
    // CURRENT STOCK
    // ========================================

    currentStock: {
      type: Number,
      required: true,
      min: [0, "Current stock cannot be negative"],
      default: 0,
    },

    // ========================================
    // MINIMUM STOCK
    // ========================================

    minimumStock: {
      type: Number,
      min: [0, "Minimum stock cannot be negative"],
      default: 0,
    },

    // ========================================
    // PURCHASE PRICE
    // ========================================

    purchasePrice: {
      type: Number,
      min: [0, "Purchase price cannot be negative"],
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
      maxlength: [500, "Notes cannot exceed 500 characters"],
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
// TEXT SEARCH INDEX
// ========================================

productSchema.index({
  name: "text",
  brand: "text",
  category: "text",
});

// ========================================
// SALON + CATEGORY INDEX
// ========================================

productSchema.index({
  salonId: 1,
  category: 1,
});

// ========================================
// SALON + ACTIVE STATUS INDEX
// ========================================

productSchema.index({
  salonId: 1,
  isActive: 1,
});

// ========================================
// SALON + CURRENT STOCK INDEX
// ========================================

productSchema.index({
  salonId: 1,
  currentStock: 1,
});

// ========================================
// SALON + MINIMUM STOCK INDEX
// ========================================

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
// STOCK VALUE VIRTUAL
// ========================================

productSchema.virtual("stockValue").get(function () {
  return this.currentStock * this.purchasePrice;
});

// ========================================
// JSON VIRTUALS
// ========================================

productSchema.set("toJSON", {
  virtuals: true,
});

// ========================================
// OBJECT VIRTUALS
// ========================================

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