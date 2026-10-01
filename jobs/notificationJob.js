import cron from "node-cron";
import {
  generateUpcomingNotifications,
} from "../controllers/notificationController.js";

// Run every day at 12:05 AM
cron.schedule("5 0 * * *", async () => {
  try {
    console.log("=================================");
    console.log("🔔 Notification check started");
    console.log("=================================");

    // Fake Express req/res objects
    let result = null;

    const req = {};

    const res = {
      status: () => ({
        json: (data) => {
          result = data;
          return data;
        },
      }),
    };

    await generateUpcomingNotifications(req, res);

    console.log(
      "🔔 Notification check completed:",
      result
    );
  } catch (error) {
    console.error(
      "NOTIFICATION CRON ERROR:",
      error
    );
  }
});