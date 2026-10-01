import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
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
    // pcs / bottle / ml / litre / kg
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
    // Low-stock alert threshold
    // ========================================

    minimumStock: {
      type: Number,
      min: 0,
      default: 0,
    },

    // ========================================
    // PURCHASE PRICE
    // Internal salon purchase cost
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
  currentStock: 1,
});

productSchema.index({
  minimumStock: 1,
});

// ========================================
// STOCK STATUS VIRTUAL
// ========================================

productSchema.virtual("stockStatus").get(
  function () {
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
  }
);

// Make virtual available in JSON
productSchema.set("toJSON", {
  virtuals: true,
});

productSchema.set("toObject", {
  virtuals: true,
});

const Product = mongoose.model(
  "Product",
  productSchema
);

export default Product;