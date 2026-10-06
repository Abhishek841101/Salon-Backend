import express from "express";

import {
  login,
  getMe,
  registerSalon,
} from "../controllers/authController.js";

import {
  protectAuth,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// ========================================
// LOGIN
// ========================================

router.post(
  "/login",
  login
);

// ========================================
// CURRENT LOGGED-IN USER
// ========================================
// JWT required
// Subscription check nahi hoga.
// Expired user bhi /me access kar sakta hai.
// ========================================

router.get(
  "/me",
  protectAuth,
  getMe
);

// ========================================
// PUBLIC SALON REGISTRATION
// ========================================

router.post(
  "/register-salon",
  registerSalon
);

export default router;