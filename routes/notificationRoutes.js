import express from "express";

import {
  getNotifications,
  getUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  generateUpcomingNotifications,
} from "../controllers/notificationController.js";

import { protectAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all notifications
router.get("/", protectAdmin, getNotifications);

// Get only unread notifications
router.get("/unread", protectAdmin, getUnreadNotifications);

// Generate birthday / anniversary notifications
router.post("/generate", protectAdmin, generateUpcomingNotifications);

// Mark all notifications as read
router.patch("/read-all", protectAdmin, markAllNotificationsAsRead);

// Mark single notification as read
router.patch("/:id/read", protectAdmin, markNotificationAsRead);

export default router;