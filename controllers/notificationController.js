import Notification from "../models/Notification.js";
import Client from "../models/Client.js";

/**
 * Get all unread notifications
 */
export const getUnreadNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      isRead: false,
    })
      .populate("client", "name phone dateOfBirth anniversaryDate")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error("GET UNREAD NOTIFICATIONS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch unread notifications",
      error: error.message,
    });
  }
};

/**
 * Get all notifications
 */
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find()
      .populate("client", "name phone dateOfBirth anniversaryDate")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error("GET NOTIFICATIONS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

/**
 * Mark one notification as read
 */
export const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();

    await notification.save();

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("MARK NOTIFICATION READ ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: error.message,
    });
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
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
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("MARK ALL NOTIFICATIONS READ ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
      error: error.message,
    });
  }
};

/**
 * Generate birthday and anniversary notifications
 *
 * This checks clients whose birthday/anniversary is exactly
 * 3 days from today.
 */
export const generateUpcomingNotifications = async (req, res) => {
  try {
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + 3);

    const targetMonth = targetDate.getMonth();
    const targetDay = targetDate.getDate();

    const clients = await Client.find({
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
        const birthday = new Date(client.dateOfBirth);

        const birthdayMonth = birthday.getMonth();
        const birthdayDay = birthday.getDate();

        if (
          birthdayMonth === targetMonth &&
          birthdayDay === targetDay
        ) {
          const eventDate = new Date(
            targetDate.getFullYear(),
            birthdayMonth,
            birthdayDay
          );

          const existingNotification =
            await Notification.findOne({
              type: "birthday",
              client: client._id,
              eventDate,
            });

          if (!existingNotification) {
            await Notification.create({
              type: "birthday",
              client: client._id,
              title: "Upcoming Birthday",
              message: `${client.name}'s birthday is in 3 days.`,
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

      if (client.anniversaryDate) {
        const anniversary = new Date(
          client.anniversaryDate
        );

        const anniversaryMonth = anniversary.getMonth();
        const anniversaryDay = anniversary.getDate();

        if (
          anniversaryMonth === targetMonth &&
          anniversaryDay === targetDay
        ) {
          const eventDate = new Date(
            targetDate.getFullYear(),
            anniversaryMonth,
            anniversaryDay
          );

          const existingNotification =
            await Notification.findOne({
              type: "anniversary",
              client: client._id,
              eventDate,
            });

          if (!existingNotification) {
            await Notification.create({
              type: "anniversary",
              client: client._id,
              title: "Upcoming Anniversary",
              message: `${client.name}'s anniversary is in 3 days.`,
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
      message: "Upcoming notifications checked successfully",
      createdCount,
    });
  } catch (error) {
    console.error(
      "GENERATE UPCOMING NOTIFICATIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to generate notifications",
      error: error.message,
    });
  }
};