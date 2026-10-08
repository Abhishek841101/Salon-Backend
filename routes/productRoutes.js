import express from "express";

import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductSummary,
  bulkUploadProducts,
} from "../controllers/productController.js";

import { protectAdmin } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// ============================================================
// PRODUCT SUMMARY
// GET /api/products/summary
// ============================================================

router.get(
  "/summary",
  protectAdmin,
  getProductSummary
);

// ============================================================
// BULK UPLOAD PRODUCTS
// POST /api/products/bulk-upload
// ============================================================

router.post(
  "/bulk-upload",
  protectAdmin,
  upload.single("file"),
  bulkUploadProducts
);

// ============================================================
// CREATE PRODUCT
// POST /api/products
// ============================================================

router.post(
  "/",
  protectAdmin,
  createProduct
);

// ============================================================
// GET ALL PRODUCTS
// GET /api/products
// ============================================================

router.get(
  "/",
  protectAdmin,
  getProducts
);

// ============================================================
// GET SINGLE PRODUCT
// GET /api/products/:id
// ============================================================

router.get(
  "/:id",
  protectAdmin,
  getProductById
);

// ============================================================
// UPDATE PRODUCT
// PATCH /api/products/:id
// ============================================================

router.patch(
  "/:id",
  protectAdmin,
  updateProduct
);

// ============================================================
// DELETE PRODUCT
// DELETE /api/products/:id
// ============================================================

router.delete(
  "/:id",
  protectAdmin,
  deleteProduct
);

export default router;