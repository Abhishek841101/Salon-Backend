import express from "express";

import {
  getNotifications,
  getUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  generateUpcomingNotifications,
} from "../controllers/notificationController.js";

const router = express.Router();

// Get all notifications
router.get("/", getNotifications);

// Get only unread notifications
router.get("/unread", getUnreadNotifications);

// Generate birthday / anniversary notifications
router.post("/generate", generateUpcomingNotifications);

// Mark all notifications as read
router.patch("/read-all", markAllNotificationsAsRead);

// Mark single notification as read
router.patch("/:id/read", markNotificationAsRead);

export default router;