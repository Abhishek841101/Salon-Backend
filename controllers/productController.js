
import mongoose from "mongoose";
import Product from "../models/Product.js";

// ============================================================
// HELPERS
// ============================================================

const getSalonId = (req) => {
  return req.user?.salonId || null;
};

const validateSalonId = (req, res) => {
  const salonId = getSalonId(req);

  if (!salonId) {
    res.status(403).json({
      success: false,
      message: "Salon access is required",
    });

    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(salonId)) {
    res.status(403).json({
      success: false,
      message: "Invalid salon access",
    });

    return null;
  }

  return salonId;
};

// ============================================================
// CREATE PRODUCT
// POST /api/products
// ============================================================

export const createProduct = async (req, res) => {
  try {
    const salonId = validateSalonId(req, res);

    if (!salonId) return;

    const {
      name,
      brand,
      category,
      unit,
      currentStock,
      minimumStock,
      purchasePrice,
      vendor,
      notes,
    } = req.body;

    // ----------------------------------------
    // VALIDATION
    // ----------------------------------------

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
      });
    }

    if (!category || !String(category).trim()) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    if (!unit || !String(unit).trim()) {
      return res.status(400).json({
        success: false,
        message: "Unit is required",
      });
    }

    // ----------------------------------------
    // NORMALIZE NUMBERS
    // ----------------------------------------

    const stock = Number(currentStock ?? 0);
    const minStock = Number(minimumStock ?? 0);
    const price = Number(purchasePrice ?? 0);

    if (Number.isNaN(stock) || stock < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid current stock",
      });
    }

    if (Number.isNaN(minStock) || minStock < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid minimum stock",
      });
    }

    if (Number.isNaN(price) || price < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase price",
      });
    }

    // ----------------------------------------
    // CREATE
    // ----------------------------------------

    const product = await Product.create({
      salonId,

      name: String(name).trim(),
      brand: brand ? String(brand).trim() : "",
      category: String(category).trim(),
      unit: String(unit).trim(),

      currentStock: stock,
      minimumStock: minStock,
      purchasePrice: price,

      vendor: vendor ? String(vendor).trim() : "",
      notes: notes ? String(notes).trim() : "",

      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create product",
      error: error.message,
    });
  }
};

// ============================================================
// GET ALL PRODUCTS
// GET /api/products
// ============================================================

export const getProducts = async (req, res) => {
  try {
    const salonId = validateSalonId(req, res);

    if (!salonId) return;

    const {
      search,
      category,
      status,
      active,
    } = req.query;

    // IMPORTANT:
    // Always start with salonId.
    const filter = {
      salonId,
    };

    // ----------------------------------------
    // ACTIVE FILTER
    // ----------------------------------------

    if (active !== undefined) {
      filter.isActive = active === "true";
    }

    // ----------------------------------------
    // CATEGORY FILTER
    // ----------------------------------------

    if (category && String(category).trim()) {
      filter.category = String(category).trim();
    }

    // ----------------------------------------
    // SEARCH
    // ----------------------------------------

    if (search && String(search).trim()) {
      const searchValue = String(search).trim();

      filter.$or = [
        {
          name: {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          brand: {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          category: {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          vendor: {
            $regex: searchValue,
            $options: "i",
          },
        },
      ];
    }

    // ----------------------------------------
    // STOCK STATUS FILTER
    // ----------------------------------------

    if (status === "out_of_stock") {
      filter.currentStock = 0;
    }

    if (status === "low_stock") {
      filter.$expr = {
        $and: [
          {
            $gt: ["$currentStock", 0],
          },
          {
            $lte: ["$currentStock", "$minimumStock"],
          },
        ],
      };
    }

    if (status === "in_stock") {
      filter.$expr = {
        $gt: ["$currentStock", "$minimumStock"],
      };
    }

    // ----------------------------------------
    // FETCH
    // ----------------------------------------

    const products = await Product.find(filter).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};

// ============================================================
// GET SINGLE PRODUCT
// GET /api/products/:id
// ============================================================

export const getProductById = async (req, res) => {
  try {
    const salonId = validateSalonId(req, res);

    if (!salonId) return;

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findOne({
      _id: id,
      salonId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("GET PRODUCT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      error: error.message,
    });
  }
};

// ============================================================
// UPDATE PRODUCT
// PATCH /api/products/:id
// ============================================================

export const updateProduct = async (req, res) => {
  try {
    const salonId = validateSalonId(req, res);

    if (!salonId) return;

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const allowedFields = [
      "name",
      "brand",
      "category",
      "unit",
      "currentStock",
      "minimumStock",
      "purchasePrice",
      "vendor",
      "notes",
      "isActive",
    ];

    const updateData = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // ----------------------------------------
    // STRING CLEANUP
    // ----------------------------------------

    if (updateData.name !== undefined) {
      updateData.name = String(updateData.name).trim();

      if (!updateData.name) {
        return res.status(400).json({
          success: false,
          message: "Product name cannot be empty",
        });
      }
    }

    if (updateData.brand !== undefined) {
      updateData.brand = String(updateData.brand).trim();
    }

    if (updateData.category !== undefined) {
      updateData.category = String(updateData.category).trim();

      if (!updateData.category) {
        return res.status(400).json({
          success: false,
          message: "Category cannot be empty",
        });
      }
    }

    if (updateData.unit !== undefined) {
      updateData.unit = String(updateData.unit).trim();

      if (!updateData.unit) {
        return res.status(400).json({
          success: false,
          message: "Unit cannot be empty",
        });
      }
    }

    if (updateData.vendor !== undefined) {
      updateData.vendor = String(updateData.vendor).trim();
    }

    if (updateData.notes !== undefined) {
      updateData.notes = String(updateData.notes).trim();
    }

    // ----------------------------------------
    // NUMBER CLEANUP
    // ----------------------------------------

    if (updateData.currentStock !== undefined) {
      updateData.currentStock = Number(updateData.currentStock);

      if (
        Number.isNaN(updateData.currentStock) ||
        updateData.currentStock < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid current stock",
        });
      }
    }

    if (updateData.minimumStock !== undefined) {
      updateData.minimumStock = Number(updateData.minimumStock);

      if (
        Number.isNaN(updateData.minimumStock) ||
        updateData.minimumStock < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid minimum stock",
        });
      }
    }

    if (updateData.purchasePrice !== undefined) {
      updateData.purchasePrice = Number(updateData.purchasePrice);

      if (
        Number.isNaN(updateData.purchasePrice) ||
        updateData.purchasePrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid purchase price",
        });
      }
    }

    // ----------------------------------------
    // UPDATE
    // ----------------------------------------

    const product = await Product.findOneAndUpdate(
      {
        _id: id,
        salonId,
      },
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("UPDATE PRODUCT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE PRODUCT
// DELETE /api/products/:id
// ============================================================

export const deleteProduct = async (req, res) => {
  try {
    const salonId = validateSalonId(req, res);

    if (!salonId) return;

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findOne({
      _id: id,
      salonId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // ----------------------------------------
    // SOFT DELETE
    // ----------------------------------------

    product.isActive = false;

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product removed successfully",
      product,
    });
  } catch (error) {
    console.error("DELETE PRODUCT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete product",
      error: error.message,
    });
  }
};

// ============================================================
// PRODUCT SUMMARY
// GET /api/products/summary
// ============================================================

export const getProductSummary = async (req, res) => {
  try {
    const salonId = validateSalonId(req, res);

    if (!salonId) return;

    const products = await Product.find({
      salonId,
      isActive: true,
    });

    const totalProducts = products.length;

    const lowStock = products.filter(
      (product) =>
        product.currentStock > 0 &&
        product.currentStock <= product.minimumStock
    ).length;

    const outOfStock = products.filter(
      (product) => product.currentStock === 0
    ).length;

    const totalStockValue = products.reduce(
      (total, product) =>
        total +
        product.currentStock * product.purchasePrice,
      0
    );

    return res.status(200).json({
      success: true,
      summary: {
        totalProducts,
        lowStock,
        outOfStock,
        totalStockValue,
      },
    });
  } catch (error) {
    console.error("PRODUCT SUMMARY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product summary",
      error: error.message,
    });
  }
};
