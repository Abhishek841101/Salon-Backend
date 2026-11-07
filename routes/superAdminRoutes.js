
import express from "express";

import {
  getSuperAdminDashboard,
  getAllSalons,
  activateSalonPlan,
  extendSalonTrial,
} from "../controllers/superAdminController.js";

import {
  protectAuth,
  requireSuperAdmin,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// ========================================
// ALL ROUTES REQUIRE SUPER ADMIN
// ========================================

router.use(
  protectAuth,
  requireSuperAdmin
);

// Dashboard
router.get(
  "/dashboard",
  getSuperAdminDashboard
);

// All salons
router.get(
  "/salons",
  getAllSalons
);

// Activate / assign plan
router.patch(
  "/salons/:salonId/activate-plan",
  activateSalonPlan
);

// Extend free trial / temporary access
router.put(
  "/salons/:salonId/extend-trial",
  extendSalonTrial
);

export default router;
