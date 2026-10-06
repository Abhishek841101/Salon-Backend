
import mongoose from "mongoose";

import Notification from "../models/Notification.js";
import Client from "../models/Client.js";

// ========================================
// HELPER
// ========================================

const getSalonId = (req) => {
  const salonId = req.user?.salonId;

  if (
    !salonId ||
    !mongoose.Types.ObjectId.isValid(salonId)
  ) {
    return null;
  }

  return salonId;
};

// ========================================
// GET ALL UNREAD NOTIFICATIONS
// ========================================

export const getUnreadNotifications = async (
  req,
  res
) => {
  try {
    const salonId = getSalonId(req);

    if (!salonId) {
      return res.status(403).json({
        success: false,
        message: "Salon access is required",
      });
    }

    const notifications =
      await Notification.find({
        salonId,
        isRead: false,
      })
        .populate(
          "client",
          "name phone dateOfBirth anniversaryDate"
        )
        .sort({
          createdAt: -1,
        });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error(
      "GET UNREAD NOTIFICATIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch unread notifications",
      error: error.message,
    });
  }
};

// ========================================
// GET ALL NOTIFICATIONS
// ========================================

export const getNotifications = async (
  req,
  res
) => {
  try {
    const salonId = getSalonId(req);

    if (!salonId) {
      return res.status(403).json({
        success: false,
        message: "Salon access is required",
      });
    }

    const notifications =
      await Notification.find({
        salonId,
      })
        .populate(
          "client",
          "name phone dateOfBirth anniversaryDate"
        )
        .sort({
          createdAt: -1,
        });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error(
      "GET NOTIFICATIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch notifications",
      error: error.message,
    });
  }
};

// ========================================
// MARK ONE NOTIFICATION AS READ
// ========================================

export const markNotificationAsRead = async (
  req,
  res
) => {
  try {
    const salonId = getSalonId(req);

    if (!salonId) {
      return res.status(403).json({
        success: false,
        message: "Salon access is required",
      });
    }

    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid notification ID",
      });
    }

    // IMPORTANT:
    // ID + salonId together.
    const notification =
      await Notification.findOne({
        _id: id,
        salonId,
      });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message:
          "Notification not found",
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();

    await notification.save();

    return res.status(200).json({
      success: true,
      message:
        "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error(
      "MARK NOTIFICATION READ ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to mark notification as read",
      error: error.message,
    });
  }
};

// ========================================
// MARK ALL NOTIFICATIONS AS READ
// ========================================

export const markAllNotificationsAsRead = async (
  req,
  res
) => {
  try {
    const salonId = getSalonId(req);

    if (!salonId) {
      return res.status(403).json({
        success: false,
        message: "Salon access is required",
      });
    }

    await Notification.updateMany(
      {
        salonId,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "All notifications marked as read",
    });
  } catch (error) {
    console.error(
      "MARK ALL NOTIFICATIONS READ ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to mark all notifications as read",
      error: error.message,
    });
  }
};

// ========================================
// GENERATE UPCOMING NOTIFICATIONS
//
// Birthday / Anniversary exactly 3 days
// before the event.
// ========================================

export const generateUpcomingNotifications =
  async (req, res) => {
    try {
      const salonId = getSalonId(req);

      if (!salonId) {
        return res.status(403).json({
          success: false,
          message:
            "Salon access is required",
        });
      }

      const today = new Date();

      today.setHours(
        0,
        0,
        0,
        0
      );

      const targetDate = new Date(today);

      targetDate.setDate(
        targetDate.getDate() + 3
      );

      const targetMonth =
        targetDate.getMonth();

      const targetDay =
        targetDate.getDate();

      // ========================================
      // ONLY CURRENT SALON CLIENTS
      // ========================================

      const clients =
        await Client.find({
          salonId,

          $or: [
            {
              dateOfBirth: {
                $ne: null,
              },
            },
            {
              anniversaryDate: {
                $ne: null,
              },
            },
          ],
        }).select(
          "name phone dateOfBirth anniversaryDate"
        );

      let createdCount = 0;

      for (const client of clients) {
        // ==========================================
        // BIRTHDAY
        // ==========================================

        if (client.dateOfBirth) {
          const birthday =
            new Date(
              client.dateOfBirth
            );

          const birthdayMonth =
            birthday.getMonth();

          const birthdayDay =
            birthday.getDate();

          if (
            birthdayMonth ===
              targetMonth &&
            birthdayDay ===
              targetDay
          ) {
            const eventDate =
              new Date(
                targetDate.getFullYear(),
                birthdayMonth,
                birthdayDay
              );

            const existingNotification =
              await Notification.findOne({
                salonId,
                type: "birthday",
                client: client._id,
                eventDate,
              });

            if (
              !existingNotification
            ) {
              await Notification.create({
                salonId,

                type: "birthday",

                client:
                  client._id,

                title:
                  "Upcoming Birthday",

                message:
                  `${client.name}'s birthday is in 3 days.`,

                eventDate,

                daysBefore: 3,

                isRead: false,
              });

              createdCount++;
            }
          }
        }

        // ==========================================
        // ANNIVERSARY
        // ==========================================

        if (
          client.anniversaryDate
        ) {
          const anniversary =
            new Date(
              client.anniversaryDate
            );

          const anniversaryMonth =
            anniversary.getMonth();

          const anniversaryDay =
            anniversary.getDate();

          if (
            anniversaryMonth ===
              targetMonth &&
            anniversaryDay ===
              targetDay
          ) {
            const eventDate =
              new Date(
                targetDate.getFullYear(),
                anniversaryMonth,
                anniversaryDay
              );

            const existingNotification =
              await Notification.findOne({
                salonId,
                type: "anniversary",
                client: client._id,
                eventDate,
              });

            if (
              !existingNotification
            ) {
              await Notification.create({
                salonId,

                type:
                  "anniversary",

                client:
                  client._id,

                title:
                  "Upcoming Anniversary",

                message:
                  `${client.name}'s anniversary is in 3 days.`,

                eventDate,

                daysBefore: 3,

                isRead: false,
              });

              createdCount++;
            }
          }
        }
      }

      return res.status(200).json({
        success: true,
        message:
          "Upcoming notifications checked successfully",
        createdCount,
      });
    } catch (error) {
      console.error(
        "GENERATE UPCOMING NOTIFICATIONS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to generate notifications",
        error: error.message,
      });
    }
  };
