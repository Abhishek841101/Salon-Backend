
import mongoose from "mongoose";
import XLSX from "xlsx";
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
// BULK UPLOAD PRODUCTS
// POST /api/products/bulk-upload
// ============================================================

export const bulkUploadProducts = async (req, res) => {
  try {
    // --------------------------------------------------------
    // VALIDATE SALON
    // --------------------------------------------------------

    const salonId = validateSalonId(req, res);

    if (!salonId) return;

    // --------------------------------------------------------
    // FILE CHECK
    // --------------------------------------------------------

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Excel or CSV file is required",
      });
    }

    // --------------------------------------------------------
    // FILE EXTENSION CHECK
    // --------------------------------------------------------

    const originalName = String(
  req.file.originalname || ""
)
  .trim()
  .toLowerCase();

const mimeType = String(
  req.file.mimetype || ""
)
  .trim()
  .toLowerCase();

console.log("PRODUCT UPLOAD FILE DETAILS:", {
  originalname: req.file.originalname,
  mimetype: req.file.mimetype,
  size: req.file.size,
});

const allowedExtensions = [
  ".xlsx",
  ".xls",
  ".csv",
];

const allowedMimeTypes = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "text/comma-separated-values",
];

const hasValidExtension = allowedExtensions.some(
  (extension) => originalName.endsWith(extension)
);

const hasValidMimeType = allowedMimeTypes.includes(
  mimeType
);

if (!hasValidExtension && !hasValidMimeType) {
  return res.status(400).json({
    success: false,
    message: "Only XLSX, XLS, and CSV files are allowed",
  });
}
    // --------------------------------------------------------
    // READ EXCEL / CSV
    // --------------------------------------------------------

    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      cellDates: true,
    });

    if (
      !workbook.SheetNames ||
      workbook.SheetNames.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "No worksheet found in uploaded file",
      });
    }

    const firstSheetName = workbook.SheetNames[0];

    const worksheet = workbook.Sheets[firstSheetName];

    if (!worksheet) {
      return res.status(400).json({
        success: false,
        message: "Unable to read worksheet",
      });
    }

    const rows = XLSX.utils.sheet_to_json(
      worksheet,
      {
        defval: "",
        raw: false,
      }
    );

    // --------------------------------------------------------
    // EMPTY FILE CHECK
    // --------------------------------------------------------

    if (!rows || rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Uploaded file is empty",
      });
    }

    // --------------------------------------------------------
    // HEADER NORMALIZER
    // --------------------------------------------------------

    const normalizeHeader = (value) => {
      return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");
    };

    // --------------------------------------------------------
    // GET VALUE FROM ROW
    // --------------------------------------------------------

    const getValue = (row, aliases) => {
      for (const key of Object.keys(row)) {
        const normalizedKey = normalizeHeader(key);

        if (aliases.includes(normalizedKey)) {
          return row[key];
        }
      }

      return "";
    };

    // --------------------------------------------------------
    // CREATED / DUPLICATE / FAILED ARRAYS
    // --------------------------------------------------------

    const createdProducts = [];

    const duplicateRows = [];

    const failedRows = [];

    // --------------------------------------------------------
    // TRACK DUPLICATES INSIDE EXCEL
    // --------------------------------------------------------

    const uploadedNames = new Set();

    // --------------------------------------------------------
    // PROCESS EACH ROW
    // --------------------------------------------------------

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];

      const excelRowNumber = index + 2;

      try {
        // ----------------------------------------------------
        // READ VALUES
        // ----------------------------------------------------

        const name = getValue(row, [
          "name",
          "productname",
          "product",
        ]);

        const brand = getValue(row, [
          "brand",
        ]);

        const category = getValue(row, [
          "category",
          "productcategory",
        ]);

        const unit = getValue(row, [
          "unit",
          "unitname",
        ]);

        const currentStockValue = getValue(row, [
          "currentstock",
          "stock",
          "quantity",
          "currentquantity",
        ]);

        const minimumStockValue = getValue(row, [
          "minimumstock",
          "minstock",
          "minimumquantity",
          "minquantity",
        ]);

        const purchasePriceValue = getValue(row, [
          "purchaseprice",
          "price",
          "costprice",
        ]);

        const vendor = getValue(row, [
          "vendor",
          "supplier",
          "suppliername",
        ]);

        const notes = getValue(row, [
          "notes",
          "note",
          "remarks",
          "remark",
        ]);

        // ----------------------------------------------------
        // STRING NORMALIZATION
        // ----------------------------------------------------

        const productName = String(
          name || ""
        ).trim();

        const productBrand = String(
          brand || ""
        ).trim();

        const productCategory = String(
          category || ""
        ).trim();

        const productUnit = String(
          unit || ""
        ).trim();

        const productVendor = String(
          vendor || ""
        ).trim();

        const productNotes = String(
          notes || ""
        ).trim();

        // ----------------------------------------------------
        // REQUIRED FIELD VALIDATION
        // ----------------------------------------------------

        if (!productName) {
          failedRows.push({
            row: excelRowNumber,
            message: "Product name is required",
            data: row,
          });

          continue;
        }

        if (!productCategory) {
          failedRows.push({
            row: excelRowNumber,
            name: productName,
            message: "Category is required",
            data: row,
          });

          continue;
        }

        if (!productUnit) {
          failedRows.push({
            row: excelRowNumber,
            name: productName,
            message: "Unit is required",
            data: row,
          });

          continue;
        }

        // ----------------------------------------------------
        // NORMALIZE PRODUCT NAME FOR DUPLICATE CHECK
        // ----------------------------------------------------

        const normalizedName =
          productName.toLowerCase().trim();

        // ----------------------------------------------------
        // DUPLICATE INSIDE UPLOADED FILE
        // ----------------------------------------------------

        if (uploadedNames.has(normalizedName)) {
          duplicateRows.push({
            row: excelRowNumber,
            name: productName,
            reason: "Duplicate product name in uploaded file",
          });

          continue;
        }

        uploadedNames.add(normalizedName);

        // ----------------------------------------------------
        // NUMBER CONVERSION
        // ----------------------------------------------------

        const stock =
          currentStockValue === "" ||
          currentStockValue === null ||
          currentStockValue === undefined
            ? 0
            : Number(currentStockValue);

        const minimumStock =
          minimumStockValue === "" ||
          minimumStockValue === null ||
          minimumStockValue === undefined
            ? 0
            : Number(minimumStockValue);

        const purchasePrice =
          purchasePriceValue === "" ||
          purchasePriceValue === null ||
          purchasePriceValue === undefined
            ? 0
            : Number(purchasePriceValue);

        // ----------------------------------------------------
        // NUMBER VALIDATION
        // ----------------------------------------------------

        if (
          Number.isNaN(stock) ||
          stock < 0
        ) {
          failedRows.push({
            row: excelRowNumber,
            name: productName,
            message: "Invalid current stock",
            data: row,
          });

          continue;
        }

        if (
          Number.isNaN(minimumStock) ||
          minimumStock < 0
        ) {
          failedRows.push({
            row: excelRowNumber,
            name: productName,
            message: "Invalid minimum stock",
            data: row,
          });

          continue;
        }

        if (
          Number.isNaN(purchasePrice) ||
          purchasePrice < 0
        ) {
          failedRows.push({
            row: excelRowNumber,
            name: productName,
            message: "Invalid purchase price",
            data: row,
          });

          continue;
        }

        // ----------------------------------------------------
        // NOTES LENGTH VALIDATION
        // ----------------------------------------------------

        if (productNotes.length > 500) {
          failedRows.push({
            row: excelRowNumber,
            name: productName,
            message: "Notes cannot exceed 500 characters",
            data: row,
          });

          continue;
        }

        // ----------------------------------------------------
        // CHECK EXISTING PRODUCT
        // ----------------------------------------------------

        const escapedName =
          productName.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );

        const existingProduct =
          await Product.findOne({
            salonId,
            name: {
              $regex: `^${escapedName}$`,
              $options: "i",
            },
          });

        if (existingProduct) {
          duplicateRows.push({
            row: excelRowNumber,
            name: productName,
            reason: "Product already exists",
            productId: existingProduct._id,
          });

          continue;
        }

        // ----------------------------------------------------
        // CREATE PRODUCT
        // ----------------------------------------------------

        const product = await Product.create({
          salonId,

          name: productName,

          brand: productBrand,

          category: productCategory,

          unit: productUnit,

          currentStock: stock,

          minimumStock,

          purchasePrice,

          vendor: productVendor,

          notes: productNotes,

          isActive: true,
        });

        // ----------------------------------------------------
        // ADD CREATED PRODUCT
        // ----------------------------------------------------

        createdProducts.push(product);
      } catch (rowError) {
        console.error(
          `BULK PRODUCT ROW ${excelRowNumber} ERROR:`,
          rowError
        );

        failedRows.push({
          row: excelRowNumber,
          message:
            rowError.message ||
            "Failed to create product",
          data: row,
        });
      }
    }

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,

      message: "Product import completed",

      totalRows: rows.length,

      created: createdProducts.length,

      duplicates: duplicateRows.length,

      failed: failedRows.length,

      products: createdProducts,

      duplicateRows,

      failedRows,
    });
  } catch (error) {
    console.error(
      "BULK UPLOAD PRODUCTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to import products",
      error: error.message,
    });
  }
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
