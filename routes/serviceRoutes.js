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

import upload from "../middleware/upload.js";

const router = express.Router();

router.post("/", upload.single("image"), createService);

router.get("/", getServices);

router.get("/:id", getServiceById);

router.put("/:id", upload.single("image"), updateService);

router.patch("/:id/deactivate", deactivateService);

router.patch("/:id/reactivate", reactivateService);

router.delete("/:id", deleteService);

export default router;