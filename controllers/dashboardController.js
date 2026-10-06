
import Client from "../models/Client.js";
import Service from "../models/Service.js";
import Bill from "../models/Bill.js";
import mongoose from "mongoose";

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
// DASHBOARD SUMMARY
// ========================================

export const getDashboardSummary = async (
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

    // Start of today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Start of tomorrow
    const startOfTomorrow = new Date(
      startOfToday
    );

    startOfTomorrow.setDate(
      startOfTomorrow.getDate() + 1
    );

    // Start of current month
    const startOfMonth = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth(),
      1
    );

    // ========================================
    // COUNTS
    // ========================================

    const [
      totalClients,
      activeClients,
      totalServices,
      activeServices,
      totalBills,
      todayBills,
      todaySalesResult,
      monthSalesResult,
    ] = await Promise.all([
      // CLIENTS
      Client.countDocuments({
        salonId,
      }),

      Client.countDocuments({
        salonId,
        isActive: true,
      }),

      // SERVICES
      Service.countDocuments({
        salonId,
      }),

      Service.countDocuments({
        salonId,
        isActive: true,
      }),

      // BILLS
      Bill.countDocuments({
        salonId,
      }),

      Bill.countDocuments({
        salonId,
        billDate: {
          $gte: startOfToday,
          $lt: startOfTomorrow,
        },
      }),

      // TODAY SALES
      Bill.aggregate([
        {
          $match: {
            salonId,

            billDate: {
              $gte: startOfToday,
              $lt: startOfTomorrow,
            },

            paymentStatus: "Paid",
          },
        },

        {
          $group: {
            _id: null,

            total: {
              $sum: "$grandTotal",
            },
          },
        },
      ]),

      // MONTH SALES
      Bill.aggregate([
        {
          $match: {
            salonId,

            billDate: {
              $gte: startOfMonth,
              $lt: startOfTomorrow,
            },

            paymentStatus: "Paid",
          },
        },

        {
          $group: {
            _id: null,

            total: {
              $sum: "$grandTotal",
            },
          },
        },
      ]),
    ]);

    const todaySales =
      todaySalesResult.length > 0
        ? Number(
            todaySalesResult[0].total || 0
          )
        : 0;

    const monthSales =
      monthSalesResult.length > 0
        ? Number(
            monthSalesResult[0].total || 0
          )
        : 0;

    return res.status(200).json({
      success: true,

      dashboard: {
        clients: {
          total: totalClients,
          active: activeClients,
        },

        services: {
          total: totalServices,
          active: activeServices,
        },

        billing: {
          totalBills,
          todayBills,
          todaySales,
          monthSales,
        },
      },
    });
  } catch (error) {
    console.error(
      "DASHBOARD SUMMARY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch dashboard summary",
    });
  }
};

// ========================================
// RECENT BILLS
// ========================================

export const getRecentBills = async (
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

    const limit = Math.min(
      Math.max(
        Number(req.query.limit) || 10,
        1
      ),
      50
    );

    // IMPORTANT:
    // Only current salon's bills.
    const bills = await Bill.find({
      salonId,
    })
      .populate(
        "client",
        "name phone email"
      )
      .sort({
        createdAt: -1,
      })
      .limit(limit);

    return res.status(200).json({
      success: true,
      bills,
    });
  } catch (error) {
    console.error(
      "RECENT BILLS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch recent bills",
    });
  }
};
