import mongoose from "mongoose";

import Stylist from "../models/Stylist.js";
import Booking from "../models/Booking.js";
import Bill from "../models/Bill.js";
import StylistAttendance from "../models/StylistAttendance.js";

// ======================================================
// HELPERS
// ======================================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const toNumber = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const roundMoney = (value) => {
  return Math.round(Number(value || 0) * 100) / 100;
};

// ======================================================
// DATE RANGE
// ======================================================

const getDateRange = (
  period,
  startDate,
  endDate
) => {
  const now = new Date();

  // ----------------------------------------------------
  // CUSTOM RANGE
  // ----------------------------------------------------

  if (startDate || endDate) {
    const start = startDate
      ? new Date(startDate)
      : new Date(now);

    const end = endDate
      ? new Date(endDate)
      : new Date(now);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      return null;
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return {
      start,
      end,
    };
  }

  // ----------------------------------------------------
  // CURRENT WEEK
  // Monday -> Sunday
  // ----------------------------------------------------

  if (period === "week") {
    const start = new Date(now);

    const day = start.getDay();

    const diff =
      day === 0
        ? 6
        : day - 1;

    start.setDate(
      start.getDate() - diff
    );

    start.setHours(0, 0, 0, 0);

    const end = new Date(start);

    end.setDate(
      end.getDate() + 6
    );

    end.setHours(
      23,
      59,
      59,
      999
    );

    return {
      start,
      end,
    };
  }

  // ----------------------------------------------------
  // CURRENT MONTH
  // ----------------------------------------------------

  if (
    period === "month" ||
    !period
  ) {
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    start.setHours(
      0,
      0,
      0,
      0
    );

    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    );

    end.setHours(
      23,
      59,
      59,
      999
    );

    return {
      start,
      end,
    };
  }

  return null;
};

// ======================================================
// CREATE STYLIST
// POST /api/stylists
// ======================================================

export const createStylist = async (
  req,
  res
) => {
  try {
    const {
      name,
      phone,
      email,
      specialization,
      experience,
      status,
      joiningDate,
      salaryType,
      monthlySalary,
      basicSalary8h,
      overtimeRatePerHour,
      standardWorkingHours,
      notes,
    } = req.body;

    // --------------------------------------------------
    // REQUIRED
    // --------------------------------------------------

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message:
          "Name and phone are required",
      });
    }

    // --------------------------------------------------
    // CREATE
    // --------------------------------------------------

    const stylist =
      await Stylist.create({
        name: String(name).trim(),

        phone: String(phone).trim(),

        email: email
          ? String(email)
              .trim()
              .toLowerCase()
          : "",

        specialization:
          specialization
            ? String(
                specialization
              ).trim()
            : "",

        experience: Math.max(
          0,
          toNumber(experience)
        ),

        status:
          status === "INACTIVE"
            ? "INACTIVE"
            : "ACTIVE",

        joiningDate: joiningDate
          ? new Date(joiningDate)
          : null,

        salaryType:
          salaryType === "DAILY"
            ? "DAILY"
            : "MONTHLY",

        monthlySalary: Math.max(
          0,
          toNumber(monthlySalary)
        ),

        basicSalary8h: Math.max(
          0,
          toNumber(basicSalary8h)
        ),

        overtimeRatePerHour:
          Math.max(
            0,
            toNumber(
              overtimeRatePerHour
            )
          ),

        standardWorkingHours:
          Math.max(
            1,
            toNumber(
              standardWorkingHours,
              8
            )
          ),

        notes: notes
          ? String(notes).trim()
          : "",
      });

    return res.status(201).json({
      success: true,
      message:
        "Stylist created successfully",
      stylist,
    });
  } catch (error) {
    console.error(
      "CREATE STYLIST ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create stylist",
      error: error.message,
    });
  }
};

// ======================================================
// GET ALL STYLISTS
// GET /api/stylists
// ======================================================

export const getStylists = async (
  req,
  res
) => {
  try {
    const {
      status,
      search,
    } = req.query;

    const filter = {};

    // --------------------------------------------------
    // STATUS FILTER
    // --------------------------------------------------

    if (status) {
      filter.status =
        String(status).toUpperCase();
    }

    // --------------------------------------------------
    // SEARCH
    // --------------------------------------------------

    if (search) {
      const searchText =
        String(search).trim();

      filter.$or = [
        {
          name: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          phone: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          email: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          specialization: {
            $regex: searchText,
            $options: "i",
          },
        },
      ];
    }

    const stylists =
      await Stylist.find(filter)
        .sort({
          createdAt: -1,
        })
        .lean();

    return res.status(200).json({
      success: true,
      count: stylists.length,
      stylists,
    });
  } catch (error) {
    console.error(
      "GET STYLISTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch stylists",
      error: error.message,
    });
  }
};

// ======================================================
// GET SINGLE STYLIST
// GET /api/stylists/:id
// ======================================================

export const getStylistById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid stylist ID",
      });
    }

    const stylist =
      await Stylist.findById(id)
        .lean();

    if (!stylist) {
      return res.status(404).json({
        success: false,
        message:
          "Stylist not found",
      });
    }

    return res.status(200).json({
      success: true,
      stylist,
    });
  } catch (error) {
    console.error(
      "GET STYLIST BY ID ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch stylist",
      error: error.message,
    });
  }
};

// ======================================================
// GET STYLIST PROFILE
//
// GET /api/stylists/:id/profile
//
// Examples:
//
// ?period=week
// ?period=month
// ?startDate=2026-09-01&endDate=2026-09-30
// ======================================================

export const getStylistProfile = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const {
      period,
      startDate,
      endDate,
    } = req.query;

    // --------------------------------------------------
    // VALIDATE ID
    // --------------------------------------------------

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid stylist ID",
      });
    }

    // --------------------------------------------------
    // GET STYLIST
    // --------------------------------------------------

    const stylist =
      await Stylist.findById(id)
        .lean();

    if (!stylist) {
      return res.status(404).json({
        success: false,
        message:
          "Stylist not found",
      });
    }

    const stylistId =
      new mongoose.Types.ObjectId(id);

    // ==================================================
    // ALL TIME BOOKING STATS
    // ==================================================

    const bookingStats =
      await Booking.aggregate([
        {
          $match: {
            stylist: stylistId,
          },
        },

        {
          $group: {
            _id: null,

            totalAppointments: {
              $sum: 1,
            },

            completedAppointments: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "COMPLETED",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            confirmedAppointments: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "CONFIRMED",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            cancelledAppointments: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "CANCELLED",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            // Revenue generated from completed services
            completedBookingRevenue: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "COMPLETED",
                    ],
                  },
                  "$price",
                  0,
                ],
              },
            },
          },
        },
      ]);

    const bookingSummary =
      bookingStats[0] || {
        totalAppointments: 0,
        completedAppointments: 0,
        confirmedAppointments: 0,
        cancelledAppointments: 0,
        completedBookingRevenue: 0,
      };

    // ==================================================
    // UNIQUE CLIENTS FROM BOOKINGS
    // ==================================================

    const bookingClients =
      await Booking.distinct(
        "client",
        {
          stylist: stylistId,
          client: {
            $ne: null,
          },
        }
      );

    // ==================================================
    // ALL TIME BILL STATS
    // ==================================================

    const billStats =
      await Bill.aggregate([
        {
          $match: {
            stylist: stylistId,
          },
        },

        {
          $group: {
            _id: null,

            totalBills: {
              $sum: 1,
            },

            paidRevenue: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$paymentStatus",
                      "Paid",
                    ],
                  },
                  "$grandTotal",
                  0,
                ],
              },
            },

            pendingAmount: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$paymentStatus",
                      "Pending",
                    ],
                  },
                  "$grandTotal",
                  0,
                ],
              },
            },
          },
        },
      ]);

    const billSummary =
      billStats[0] || {
        totalBills: 0,
        paidRevenue: 0,
        pendingAmount: 0,
      };

    // ==================================================
    // CLIENTS FROM BILLS
    // ==================================================

    const billClients =
      await Bill.distinct(
        "client",
        {
          stylist: stylistId,
          client: {
            $ne: null,
          },
        }
      );

    // ==================================================
    // UNIQUE CLIENT COUNT
    // ==================================================

    const uniqueClientIds =
      new Set();

    [
      ...bookingClients,
      ...billClients,
    ].forEach((clientId) => {
      if (clientId) {
        uniqueClientIds.add(
          clientId.toString()
        );
      }
    });

    const totalClients =
      uniqueClientIds.size;

    // ==================================================
    // REVENUE
    // ==================================================

    const paidRevenue =
      roundMoney(
        billSummary.paidRevenue
      );

    const completedBookingRevenue =
      roundMoney(
        bookingSummary.completedBookingRevenue
      );

    const totalBills =
      Number(
        billSummary.totalBills || 0
      );

    const averageServiceValue =
      totalBills > 0
        ? roundMoney(
            paidRevenue /
              totalBills
          )
        : 0;

    // ==================================================
    // PERIOD
    // ==================================================

    const range =
      getDateRange(
        period,
        startDate,
        endDate
      );

    // ==================================================
    // PERIOD BOOKING
    // ==================================================

    let periodFilter = {
      stylist: stylistId,
    };

    if (range) {
      periodFilter = {
        stylist: stylistId,

        bookingDate: {
          $gte: range.start,
          $lte: range.end,
        },
      };
    }

    const periodBookingStats =
      await Booking.aggregate([
        {
          $match: periodFilter,
        },

        {
          $group: {
            _id: null,

            appointments: {
              $sum: 1,
            },

            completedServices: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "COMPLETED",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            completedRevenue: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "COMPLETED",
                    ],
                  },
                  "$price",
                  0,
                ],
              },
            },
          },
        },
      ]);

    const periodBookings =
      periodBookingStats[0] || {
        appointments: 0,
        completedServices: 0,
        completedRevenue: 0,
      };

    // ==================================================
    // PERIOD BILLS
    // ==================================================

    let periodBillFilter = {
      stylist: stylistId,
    };

    if (range) {
      periodBillFilter = {
        stylist: stylistId,

        billDate: {
          $gte: range.start,
          $lte: range.end,
        },
      };
    }

    const periodBillStats =
      await Bill.aggregate([
        {
          $match:
            periodBillFilter,
        },

        {
          $group: {
            _id: null,

            totalBills: {
              $sum: 1,
            },

            paidRevenue: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$paymentStatus",
                      "Paid",
                    ],
                  },
                  "$grandTotal",
                  0,
                ],
              },
            },

            pendingAmount: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$paymentStatus",
                      "Pending",
                    ],
                  },
                  "$grandTotal",
                  0,
                ],
              },
            },
          },
        },
      ]);

    const periodBills =
      periodBillStats[0] || {
        totalBills: 0,
        paidRevenue: 0,
        pendingAmount: 0,
      };

    // ==================================================
    // PERIOD ATTENDANCE
    // ==================================================

    let attendanceFilter = {
      stylist: stylistId,
    };

    if (range) {
      attendanceFilter.date = {
        $gte: range.start,
        $lte: range.end,
      };
    }

    const attendanceStats =
      await StylistAttendance.aggregate([
        {
          $match:
            attendanceFilter,
        },

        {
          $group: {
            _id: null,

            totalDays: {
              $sum: 1,
            },

            presentDays: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "PRESENT",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            absentDays: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "ABSENT",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            halfDays: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "HALF_DAY",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            leaveDays: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "LEAVE",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            totalWorkedHours: {
              $sum: "$workedHours",
            },

            overtimeHours: {
              $sum: "$overtimeHours",
            },

            basicSalaryEarned: {
              $sum:
                "$basicSalaryEarned",
            },

            overtimeSalary: {
              $sum:
                "$overtimeSalary",
            },

            totalSalaryEarned: {
              $sum:
                "$totalSalaryEarned",
            },
          },
        },
      ]);

    const attendanceSummary =
      attendanceStats[0] || {
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        halfDays: 0,
        leaveDays: 0,
        totalWorkedHours: 0,
        overtimeHours: 0,
        basicSalaryEarned: 0,
        overtimeSalary: 0,
        totalSalaryEarned: 0,
      };

    // ==================================================
    // RECENT BOOKINGS
    // ==================================================

    const recentBookings =
      await Booking.find({
        stylist: stylistId,
      })
        .populate(
          "client",
          "name phone email"
        )
        .populate(
          "service",
          "name price duration"
        )
        .sort({
          bookingDate: -1,
          createdAt: -1,
        })
        .limit(10)
        .lean();

    // ==================================================
    // RECENT BILLS
    // ==================================================

    const recentBills =
      await Bill.find({
        stylist: stylistId,
      })
        .sort({
          billDate: -1,
          createdAt: -1,
        })
        .limit(10)
        .lean();

    // ==================================================
    // FINAL RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      period: {
        type:
          period ||
          "month",

        startDate:
          range
            ? range.start
            : null,

        endDate:
          range
            ? range.end
            : null,
      },

      stylist,

      stats: {
        // ----------------------------------------------
        // ALL TIME
        // ----------------------------------------------

        totalClients,

        totalAppointments:
          Number(
            bookingSummary.totalAppointments ||
              0
          ),

        completedServices:
          Number(
            bookingSummary.completedAppointments ||
              0
          ),

        confirmedAppointments:
          Number(
            bookingSummary.confirmedAppointments ||
              0
          ),

        cancelledAppointments:
          Number(
            bookingSummary.cancelledAppointments ||
              0
          ),

        totalBills,

        // Paid revenue from bills
        totalRevenue:
          paidRevenue,

        // Revenue generated by completed bookings
        completedBookingRevenue,

        pendingAmount:
          roundMoney(
            billSummary.pendingAmount
          ),

        averageServiceValue,

        // ----------------------------------------------
        // PERIOD
        // ----------------------------------------------

        periodAppointments:
          Number(
            periodBookings.appointments ||
              0
          ),

        periodCompletedServices:
          Number(
            periodBookings.completedServices ||
              0
          ),

        periodBookingRevenue:
          roundMoney(
            periodBookings.completedRevenue
          ),

        periodBills:
          Number(
            periodBills.totalBills ||
              0
          ),

        periodRevenue:
          roundMoney(
            periodBills.paidRevenue
          ),

        periodPendingAmount:
          roundMoney(
            periodBills.pendingAmount
          ),
      },

      attendance: {
        totalDays:
          Number(
            attendanceSummary.totalDays ||
              0
          ),

        presentDays:
          Number(
            attendanceSummary.presentDays ||
              0
          ),

        absentDays:
          Number(
            attendanceSummary.absentDays ||
              0
          ),

        halfDays:
          Number(
            attendanceSummary.halfDays ||
              0
          ),

        leaveDays:
          Number(
            attendanceSummary.leaveDays ||
              0
          ),

        totalWorkedHours:
          roundMoney(
            attendanceSummary.totalWorkedHours
          ),

        overtimeHours:
          roundMoney(
            attendanceSummary.overtimeHours
          ),
      },

      salary: {
        monthlySalary:
          roundMoney(
            stylist.monthlySalary
          ),

        basicSalary8h:
          roundMoney(
            stylist.basicSalary8h
          ),

        overtimeRatePerHour:
          roundMoney(
            stylist.overtimeRatePerHour
          ),

        standardWorkingHours:
          Number(
            stylist.standardWorkingHours ||
              8
          ),

        basicSalaryEarned:
          roundMoney(
            attendanceSummary.basicSalaryEarned
          ),

        overtimeSalary:
          roundMoney(
            attendanceSummary.overtimeSalary
          ),

        totalSalaryEarned:
          roundMoney(
            attendanceSummary.totalSalaryEarned
          ),
      },

      recentBookings,

      recentBills,
    });
  } catch (error) {
    console.error(
      "GET STYLIST PROFILE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch stylist profile",
      error: error.message,
    });
  }
};

// ======================================================
// UPDATE STYLIST
// PATCH /api/stylists/:id
// ======================================================

export const updateStylist = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid stylist ID",
      });
    }

    const {
      name,
      phone,
      email,
      specialization,
      experience,
      status,
      joiningDate,
      salaryType,
      monthlySalary,
      basicSalary8h,
      overtimeRatePerHour,
      standardWorkingHours,
      notes,
    } = req.body;

    const updateData = {};

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Name cannot be empty",
        });
      }

      updateData.name =
        String(name).trim();
    }

    if (phone !== undefined) {
      if (!String(phone).trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Phone cannot be empty",
        });
      }

      updateData.phone =
        String(phone).trim();
    }

    if (email !== undefined) {
      updateData.email =
        email
          ? String(email)
              .trim()
              .toLowerCase()
          : "";
    }

    if (
      specialization !==
      undefined
    ) {
      updateData.specialization =
        specialization
          ? String(
              specialization
            ).trim()
          : "";
    }

    if (
      experience !== undefined
    ) {
      updateData.experience =
        Math.max(
          0,
          toNumber(experience)
        );
    }

    if (status !== undefined) {
      updateData.status =
        status === "INACTIVE"
          ? "INACTIVE"
          : "ACTIVE";
    }

    if (
      joiningDate !== undefined
    ) {
      updateData.joiningDate =
        joiningDate
          ? new Date(joiningDate)
          : null;
    }

    if (
      salaryType !== undefined
    ) {
      updateData.salaryType =
        salaryType === "DAILY"
          ? "DAILY"
          : "MONTHLY";
    }

    if (
      monthlySalary !== undefined
    ) {
      updateData.monthlySalary =
        Math.max(
          0,
          toNumber(monthlySalary)
        );
    }

    if (
      basicSalary8h !== undefined
    ) {
      updateData.basicSalary8h =
        Math.max(
          0,
          toNumber(basicSalary8h)
        );
    }

    if (
      overtimeRatePerHour !==
      undefined
    ) {
      updateData.overtimeRatePerHour =
        Math.max(
          0,
          toNumber(
            overtimeRatePerHour
          )
        );
    }

    if (
      standardWorkingHours !==
      undefined
    ) {
      updateData.standardWorkingHours =
        Math.max(
          1,
          toNumber(
            standardWorkingHours,
            8
          )
        );
    }

    if (notes !== undefined) {
      updateData.notes =
        String(notes || "").trim();
    }

    const stylist =
      await Stylist.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true,
        }
      );

    if (!stylist) {
      return res.status(404).json({
        success: false,
        message:
          "Stylist not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Stylist updated successfully",
      stylist,
    });
  } catch (error) {
    console.error(
      "UPDATE STYLIST ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update stylist",
      error: error.message,
    });
  }
};

// ======================================================
// DELETE STYLIST
// DELETE /api/stylists/:id
// ======================================================

export const deleteStylist = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid stylist ID",
      });
    }

    const stylist =
      await Stylist.findById(id);

    if (!stylist) {
      return res.status(404).json({
        success: false,
        message:
          "Stylist not found",
      });
    }

    // --------------------------------------------------
    // Delete attendance
    // --------------------------------------------------

    await StylistAttendance.deleteMany({
      stylist: id,
    });

    // --------------------------------------------------
    // Delete stylist
    // --------------------------------------------------

    await Stylist.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message:
        "Stylist deleted successfully",
      stylist,
    });
  } catch (error) {
    console.error(
      "DELETE STYLIST ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete stylist",
      error: error.message,
    });
  }
};