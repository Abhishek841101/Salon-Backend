
import express from "express";

import {
  createService,
  getServices,
  getServiceById,
  updateService,
  deactivateService,
  reactivateService,
  deleteService,
} from "../controllers/serviceController.js";

import {
  protectAdmin,
} from "../middleware/authMiddleware.js";

import upload from "../middleware/upload.js";

const router = express.Router();

// ========================================
// ALL SERVICE ROUTES REQUIRE ADMIN LOGIN
// ========================================

// ========================================
// ADD SERVICE
// ========================================

router.post(
  "/",
  protectAdmin,
  upload.single("image"),
  createService
);

// ========================================
// GET ALL SERVICES / SEARCH
// ========================================

router.get(
  "/",
  protectAdmin,
  getServices
);

// ========================================
// GET SINGLE SERVICE
// ========================================

router.get(
  "/:id",
  protectAdmin,
  getServiceById
);

// ========================================
// UPDATE SERVICE
// ========================================

router.put(
  "/:id",
  protectAdmin,
  upload.single("image"),
  updateService
);

// ========================================
// DEACTIVATE SERVICE
// ========================================

router.patch(
  "/:id/deactivate",
  protectAdmin,
  deactivateService
);

// ========================================
// REACTIVATE SERVICE
// ========================================

router.patch(
  "/:id/reactivate",
  protectAdmin,
  reactivateService
);

// ========================================
// DELETE SERVICE
// ========================================

router.delete(
  "/:id",
  protectAdmin,
  deleteService
);

export default router;
