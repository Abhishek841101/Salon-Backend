import express from "express";

import {
  createService,
  getServices,
  getServiceById,
  updateService,
  bulkUploadServices,
  deactivateService,
  reactivateService,
  deleteService,
} from "../controllers/serviceController.js";

import upload from "../middleware/upload.js";

import { protectAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =========================================================
   CREATE SERVICE
   POST /api/services
========================================================= */

router.post(
  "/",
  protectAdmin,
  upload.single("image"),
  createService
);

/* =========================================================
   BULK UPLOAD SERVICES
   POST /api/services/bulk-upload

   Excel / CSV:
   serviceGroup
   name
   category
   price
   duration
   description
========================================================= */

router.post(
  "/bulk-upload",
  protectAdmin,
  upload.single("file"),
  bulkUploadServices
);

/* =========================================================
   GET ALL SERVICES
   GET /api/services
========================================================= */

router.get(
  "/",
  protectAdmin,
  getServices
);

/* =========================================================
   GET SERVICE BY ID
   GET /api/services/:id
========================================================= */

router.get(
  "/:id",
  protectAdmin,
  getServiceById
);

/* =========================================================
   UPDATE SERVICE
   PUT /api/services/:id
========================================================= */

router.put(
  "/:id",
  protectAdmin,
  upload.single("image"),
  updateService
);

/* =========================================================
   DEACTIVATE SERVICE
   PATCH /api/services/:id/deactivate
========================================================= */

router.patch(
  "/:id/deactivate",
  protectAdmin,
  deactivateService
);

/* =========================================================
   REACTIVATE SERVICE
   PATCH /api/services/:id/reactivate
========================================================= */

router.patch(
  "/:id/reactivate",
  protectAdmin,
  reactivateService
);

/* =========================================================
   DELETE SERVICE
   DELETE /api/services/:id
========================================================= */

router.delete(
  "/:id",
  protectAdmin,
  deleteService
);

export default router;