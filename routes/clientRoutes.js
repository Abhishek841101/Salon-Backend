import express from "express";

import {
  createClient,
  getClients,
  getClientById,
  getClientHistory,
  updateClient,
  deactivateClient,
  reactivateClient,
  deleteClient,
  bulkImportClients,
} from "../controllers/clientController.js";

import { protectAdmin } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// ========================================
// ALL CLIENT ROUTES REQUIRE ADMIN LOGIN
// ========================================

// ========================================
// ADD SINGLE CLIENT
// ========================================

router.post(
  "/",
  protectAdmin,
  upload.single("profileImage"),
  createClient
);

// ========================================
// BULK IMPORT CLIENTS FROM EXCEL / CSV
// IMPORTANT: Keep before /:id
// ========================================

router.post(
  "/bulk",
  protectAdmin,
  upload.single("file"),
  bulkImportClients
);

// ========================================
// GET ALL CLIENTS / SEARCH
// ========================================

router.get(
  "/",
  protectAdmin,
  getClients
);

// ========================================
// GET CLIENT HISTORY
// ========================================

router.get(
  "/:id/history",
  protectAdmin,
  getClientHistory
);

// ========================================
// GET SINGLE CLIENT
// ========================================

router.get(
  "/:id",
  protectAdmin,
  getClientById
);

// ========================================
// UPDATE CLIENT
// ========================================

router.put(
  "/:id",
  protectAdmin,
  updateClient
);

// ========================================
// DEACTIVATE CLIENT
// ========================================

router.patch(
  "/:id/deactivate",
  protectAdmin,
  deactivateClient
);

// ========================================
// REACTIVATE CLIENT
// ========================================

router.patch(
  "/:id/reactivate",
  protectAdmin,
  reactivateClient
);

// ========================================
// PERMANENT DELETE
// ========================================

router.delete(
  "/:id",
  protectAdmin,
  deleteClient
);

export default router;