import Client from "../models/Client.js";
import Service from "../models/Service.js";
import Bill from "../models/Bill.js";

// ========================================
// DASHBOARD SUMMARY
// ========================================

export const getDashboardSummary = async (req, res) => {
  try {
    // Start of today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Start of tomorrow
    const startOfTomorrow = new Date(startOfToday);
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
      Client.countDocuments(),

      Client.countDocuments({
        isActive: true,
      }),

      Service.countDocuments(),

      Service.countDocuments({
        isActive: true,
      }),

      Bill.countDocuments(),

      Bill.countDocuments({
        billDate: {
          $gte: startOfToday,
          $lt: startOfTomorrow,
        },
      }),

      Bill.aggregate([
        {
          $match: {
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

      Bill.aggregate([
        {
          $match: {
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
        ? todaySalesResult[0].total
        : 0;

    const monthSales =
      monthSalesResult.length > 0
        ? monthSalesResult[0].total
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
      message: "Failed to fetch dashboard summary",
    });
  }
};

// ========================================
// RECENT BILLS
// ========================================

export const getRecentBills = async (req, res) => {
  try {
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 10, 1),
      50
    );

    const bills = await Bill.find()
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
      message: "Failed to fetch recent bills",
    });
  }
};