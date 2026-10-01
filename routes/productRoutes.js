import express from "express";

import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductSummary,
} from "../controllers/productController.js";

const router = express.Router();

// ============================================================
// PRODUCT SUMMARY
// GET /api/products/summary
// ============================================================

router.get(
  "/summary",
  getProductSummary
);

// ============================================================
// CREATE PRODUCT
// POST /api/products
// ============================================================

router.post(
  "/",
  createProduct
);

// ============================================================
// GET ALL PRODUCTS
// GET /api/products
//
// Optional:
// ?search=shampoo
// ?category=Hair Care
// ?status=low_stock
// ?status=out_of_stock
// ?status=in_stock
// ?active=true
// ============================================================

router.get(
  "/",
  getProducts
);

// ============================================================
// GET SINGLE PRODUCT
// GET /api/products/:id
// ============================================================

router.get(
  "/:id",
  getProductById
);

// ============================================================
// UPDATE PRODUCT
// PATCH /api/products/:id
// ============================================================

router.patch(
  "/:id",
  updateProduct
);

// ============================================================
// DELETE PRODUCT
// DELETE /api/products/:id
// ============================================================

router.delete(
  "/:id",
  deleteProduct
);

export default router;