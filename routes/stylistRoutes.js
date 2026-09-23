import express from "express";

import {
  createStylist,
  getStylists,
  getStylistById,
  updateStylist,
  deleteStylist,
} from "../controllers/stylistController.js";

const router = express.Router();

// ========================================
// CREATE
// POST /api/stylists
// ========================================

router.post("/", createStylist);

// ========================================
// GET ALL
// GET /api/stylists
// ========================================

router.get("/", getStylists);

// ========================================
// GET SINGLE
// GET /api/stylists/:id
// ========================================

router.get("/:id", getStylistById);

// ========================================
// UPDATE
// PATCH /api/stylists/:id
// ========================================

router.patch("/:id", updateStylist);

// ========================================
// DELETE
// DELETE /api/stylists/:id
// ========================================

router.delete("/:id", deleteStylist);

export default router;