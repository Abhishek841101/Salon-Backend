
import mongoose from "mongoose";

import Stylist from "../models/Stylist.js";
import Booking from "../models/Booking.js";
import Bill from "../models/Bill.js";
import StylistAttendance from "../models/StylistAttendance.js";

// ======================================================
// CONSTANTS
// ======================================================

const MONTHLY_WORKING_DAYS = 26;

// ======================================================
// HELPERS
// ======================================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const toNumber = (
  value,
  fallback = 0
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const roundMoney = (value) => {
  return (
    Math.round(
      Number(value || 0) * 100
    ) / 100
  );
};

// ======================================================
// MULTI-TENANT ACCESS
// ======================================================

const getSalonId = (req) => req.user?.salonId || null;

const validateSalonAccess = (req, res) => {
  const salonId = getSalonId(req);

  if (!salonId || !isValidObjectId(salonId)) {
    res.status(403).json({
      success: false,
      message: "Salon access is required",
    });

    return null;
  }

  return salonId;
};

// ======================================================
// INDIA TIMEZONE
// ======================================================

const INDIA_TIMEZONE =
  "Asia/Kolkata";

const getIndiaDateString = (
  date = new Date()
) => {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        INDIA_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(date);
};

const indiaDateToUTC = (
  dateString
) => {
  if (
    typeof dateString !==
      "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dateString
    )
  ) {
    return null;
  }

  const date = new Date(
    `${dateString}T00:00:00+05:30`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
};

// ======================================================
// DATE RANGE
// ======================================================

const getDateRange = (
  period,
  startDate,
  endDate
) => {
  // ----------------------------------------------------
  // CUSTOM
  // ----------------------------------------------------

  if (
    startDate ||
    endDate
  ) {
    const today =
      getIndiaDateString();

    const startString =
      startDate || today;

    const endString =
      endDate || today;

    const start =
      indiaDateToUTC(
        startString
      );

    const endStart =
      indiaDateToUTC(
        endString
      );

    if (!start || !endStart) {
      return null;
    }

    const end =
      new Date(endStart);

    end.setTime(
      end.getTime() +
        24 *
          60 *
          60 *
          1000 -
        1
    );

    if (start > end) {
      return null;
    }

    return {
      start,
      end,
    };
  }

  // ----------------------------------------------------
  // NOW
  // ----------------------------------------------------

  const now = new Date();

  // ----------------------------------------------------
  // WEEK
  // Monday -> Sunday
  // ----------------------------------------------------

  if (period === "week") {
    const indiaToday =
      getIndiaDateString(
        now
      );

    const today =
      indiaDateToUTC(
        indiaToday
      );

    const weekday =
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            INDIA_TIMEZONE,
          weekday: "short",
        }
      ).format(now);

    const weekdayMap = {
      Mon: 0,
      Tue: 1,
      Wed: 2,
      Thu: 3,
      Fri: 4,
      Sat: 5,
      Sun: 6,
    };

    const diff =
      weekdayMap[weekday];

    const start =
      new Date(today);

    start.setUTCDate(
      start.getUTCDate() -
        diff
    );

    const end =
      new Date(start);

    end.setUTCDate(
      end.getUTCDate() + 6
    );

    end.setTime(
      end.getTime() +
        24 *
          60 *
          60 *
          1000 -
        1
    );

    return {
      start,
      end,
    };
  }

  // ----------------------------------------------------
  // MONTH
  // ----------------------------------------------------

  if (
    period === "month" ||
    !period
  ) {
    const parts =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            INDIA_TIMEZONE,
          year: "numeric",
          month: "2-digit",
        }
      ).formatToParts(now);

    const year =
      parts.find(
        (x) =>
          x.type === "year"
      )?.value;

    const month =
      parts.find(
        (x) =>
          x.type === "month"
      )?.value;

    const start =
      indiaDateToUTC(
        `${year}-${month}-01`
      );

    const nextMonthDate =
      new Date(
        `${year}-${month}-01T00:00:00+05:30`
      );

    nextMonthDate.setUTCMonth(
      nextMonthDate.getUTCMonth() +
        1
    );

    const nextMonthIndia =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            INDIA_TIMEZONE,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }
      ).format(
        nextMonthDate
      );

    const endStart =
      indiaDateToUTC(
        nextMonthIndia
      );

    const end =
      new Date(endStart);

    end.setTime(
      end.getTime() - 1
    );

    return {
      start,
      end,
    };
  }

  return null;
};

// ======================================================
// SALARY
// ======================================================

const getDailyBasicSalary = (
  stylist
) => {
  if (
    stylist.salaryType ===
    "MONTHLY"
  ) {
    return roundMoney(
      Math.max(
        0,
        toNumber(
          stylist.monthlySalary
        )
      ) /
        MONTHLY_WORKING_DAYS
    );
  }

  return roundMoney(
    Math.max(
      0,
      toNumber(
        stylist.basicSalary8h
      )
    )
  );
};

// ======================================================
// CREATE STYLIST
// POST /api/stylists
// ======================================================

export const createStylist =
  async (req, res) => {
    try {
      const salonId =
        validateSalonAccess(
          req,
          res
        );

      if (!salonId) return;

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

      if (
        !name ||
        !String(name).trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Name is required",
        });
      }

      if (
        !phone ||
        !String(phone).trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Phone is required",
        });
      }

      // --------------------------------------------------
      // NORMALIZE SALARY TYPE
      // --------------------------------------------------

      const finalSalaryType =
        String(
          salaryType || "MONTHLY"
        ).toUpperCase() ===
        "DAILY"
          ? "DAILY"
          : "MONTHLY";

      // --------------------------------------------------
      // DATE
      // --------------------------------------------------

      let finalJoiningDate =
        null;

      if (joiningDate) {
        finalJoiningDate =
          new Date(joiningDate);

        if (
          Number.isNaN(
            finalJoiningDate.getTime()
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid joining date",
          });
        }
      }

      // --------------------------------------------------
      // CREATE
      // --------------------------------------------------

      const stylist =
        await Stylist.create({
          salonId,

          name:
            String(name).trim(),

          phone:
            String(phone).trim(),

          email:
            email
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

          experience:
            Math.max(
              0,
              toNumber(
                experience
              )
            ),

          status:
            String(
              status || "ACTIVE"
            ).toUpperCase() ===
            "INACTIVE"
              ? "INACTIVE"
              : "ACTIVE",

          joiningDate:
            finalJoiningDate,

          salaryType:
            finalSalaryType,

          monthlySalary:
            Math.max(
              0,
              toNumber(
                monthlySalary
              )
            ),

          basicSalary8h:
            Math.max(
              0,
              toNumber(
                basicSalary8h
              )
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

          notes:
            notes
              ? String(
                  notes
                ).trim()
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
        error:
          error.message,
      });
    }
  };

// ======================================================
// GET ALL STYLISTS
//
// GET /api/stylists
//
// ?search=rahul
// ?status=ACTIVE
// ======================================================

export const getStylists =
  async (req, res) => {
    try {
      const {
        status,
        search,
      } = req.query;

      const salonId =
        validateSalonAccess(
          req,
          res
        );

      if (!salonId) return;

      const filter = {
        salonId,
      };

      // --------------------------------------------------
      // STATUS
      // --------------------------------------------------

      if (status) {
        const finalStatus =
          String(status)
            .trim()
            .toUpperCase();

        if (
          [
            "ACTIVE",
            "INACTIVE",
          ].includes(
            finalStatus
          )
        ) {
          filter.status =
            finalStatus;
        }
      }

      // --------------------------------------------------
      // SEARCH
      // --------------------------------------------------

      if (search) {
        const searchText =
          String(search).trim();

        if (searchText) {
          const escaped =
            searchText.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            );

          filter.$or = [
            {
              name: {
                $regex:
                  escaped,
                $options:
                  "i",
              },
            },

            {
              phone: {
                $regex:
                  escaped,
                $options:
                  "i",
              },
            },

            {
              email: {
                $regex:
                  escaped,
                $options:
                  "i",
              },
            },

            {
              specialization: {
                $regex:
                  escaped,
                $options:
                  "i",
              },
            },
          ];
        }
      }

      const stylists =
        await Stylist.find(
          filter
        )
          .sort({
            createdAt: -1,
          })
          .lean();

      return res.status(200).json({
        success: true,
        count:
          stylists.length,
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
        error:
          error.message,
      });
    }
  };

// ======================================================
// GET SINGLE
//
// GET /api/stylists/:id
// ======================================================

export const getStylistById =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      if (
        !isValidObjectId(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid stylist ID",
        });
      }

      const salonId =
        validateSalonAccess(
          req,
          res
        );

      if (!salonId) return;

      const stylist =
        await Stylist.findOne({
          _id: id,
          salonId,
        }).lean();

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
        error:
          error.message,
      });
    }
  };

// ======================================================
// GET STYLIST PROFILE
//
// GET /api/stylists/:id/profile
//
// ?period=week
// ?period=month
// ?startDate=2026-09-01
// ?endDate=2026-09-30
// ======================================================

export const getStylistProfile =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      const {
        period,
        startDate,
        endDate,
      } = req.query;

      // --------------------------------------------------
      // ID
      // --------------------------------------------------

      if (
        !isValidObjectId(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid stylist ID",
        });
      }

      // --------------------------------------------------
      // SALON ACCESS
      // --------------------------------------------------

      const salonId =
        validateSalonAccess(
          req,
          res
        );

      if (!salonId) return;

      // --------------------------------------------------
      // STYLIST
      // --------------------------------------------------

      const stylist =
        await Stylist.findOne({
          _id: id,
          salonId,
        }).lean();

      if (!stylist) {
        return res.status(404).json({
          success: false,
          message:
            "Stylist not found",
        });
      }

      const stylistId =
        new mongoose.Types.ObjectId(
          id
        );

      // ==================================================
      // ALL-TIME BOOKING STATS
      // ==================================================

      const bookingStats =
        await Booking.aggregate([
          {
            $match: {
              stylist:
                stylistId,
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
                        {
                          $toUpper: {
                            $ifNull: [
                              "$status",
                              "",
                            ],
                          },
                        },
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
                        {
                          $toUpper: {
                            $ifNull: [
                              "$status",
                              "",
                            ],
                          },
                        },
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
                        {
                          $toUpper: {
                            $ifNull: [
                              "$status",
                              "",
                            ],
                          },
                        },
                        "CANCELLED",
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },

              completedBookingRevenue: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        {
                          $toUpper: {
                            $ifNull: [
                              "$status",
                              "",
                            ],
                          },
                        },
                        "COMPLETED",
                      ],
                    },
                    {
                      $convert: {
                        input:
                          "$price",
                        to: "double",
                        onError: 0,
                        onNull: 0,
                      },
                    },
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
      // CLIENTS FROM BOOKINGS
      // ==================================================

      const bookingClients =
        await Booking.distinct(
          "client",
          {
            stylist:
              stylistId,

            client: {
              $ne: null,
            },
          }
        );

      // ==================================================
      // BILL STATS
      // ==================================================

      const billStats =
        await Bill.aggregate([
          {
            $match: {
              stylist:
                stylistId,
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
                        {
                          $toUpper: {
                            $ifNull: [
                              "$paymentStatus",
                              "",
                            ],
                          },
                        },
                        "PAID",
                      ],
                    },
                    {
                      $convert: {
                        input:
                          "$grandTotal",
                        to: "double",
                        onError: 0,
                        onNull: 0,
                      },
                    },
                    0,
                  ],
                },
              },

              pendingAmount: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        {
                          $toUpper: {
                            $ifNull: [
                              "$paymentStatus",
                              "",
                            ],
                          },
                        },
                        "PENDING",
                      ],
                    },
                    {
                      $convert: {
                        input:
                          "$grandTotal",
                        to: "double",
                        onError: 0,
                        onNull: 0,
                      },
                    },
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
            stylist:
              stylistId,

            client: {
              $ne: null,
            },
          }
        );

      // ==================================================
      // UNIQUE CLIENTS
      // ==================================================

      const uniqueClientIds =
        new Set();

      [
        ...bookingClients,
        ...billClients,
      ].forEach(
        (clientId) => {
          if (clientId) {
            uniqueClientIds.add(
              clientId.toString()
            );
          }
        }
      );

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
          billSummary.totalBills ||
            0
        );

      // This is average paid bill,
      // not average service.
      const averageBillValue =
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

      if (!range) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid period/date range",
        });
      }

      // ==================================================
      // PERIOD BOOKINGS
      // ==================================================

      const periodBookingStats =
        await Booking.aggregate([
          {
            $match: {
              stylist:
                stylistId,

              bookingDate: {
                $gte:
                  range.start,
                $lte:
                  range.end,
              },
            },
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
                        {
                          $toUpper: {
                            $ifNull: [
                              "$status",
                              "",
                            ],
                          },
                        },
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
                        {
                          $toUpper: {
                            $ifNull: [
                              "$status",
                              "",
                            ],
                          },
                        },
                        "COMPLETED",
                      ],
                    },
                    {
                      $convert: {
                        input:
                          "$price",
                        to: "double",
                        onError: 0,
                        onNull: 0,
                      },
                    },
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

      const periodBillStats =
        await Bill.aggregate([
          {
            $match: {
              stylist:
                stylistId,

              billDate: {
                $gte:
                  range.start,
                $lte:
                  range.end,
              },
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
                        {
                          $toUpper: {
                            $ifNull: [
                              "$paymentStatus",
                              "",
                            ],
                          },
                        },
                        "PAID",
                      ],
                    },
                    {
                      $convert: {
                        input:
                          "$grandTotal",
                        to: "double",
                        onError: 0,
                        onNull: 0,
                      },
                    },
                    0,
                  ],
                },
              },

              pendingAmount: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        {
                          $toUpper: {
                            $ifNull: [
                              "$paymentStatus",
                              "",
                            ],
                          },
                        },
                        "PENDING",
                      ],
                    },
                    {
                      $convert: {
                        input:
                          "$grandTotal",
                        to: "double",
                        onError: 0,
                        onNull: 0,
                      },
                    },
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

      const attendanceStats =
        await StylistAttendance.aggregate([
          {
            $match: {
              salonId,

              stylist:
                stylistId,

              date: {
                $gte:
                  range.start,
                $lte:
                  range.end,
              },
            },
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
                $sum:
                  "$workedHours",
              },

              overtimeHours: {
                $sum:
                  "$overtimeHours",
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
          stylist:
            stylistId,
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
          stylist:
            stylistId,
        })
          .sort({
            billDate: -1,
            createdAt: -1,
          })
          .limit(10)
          .lean();

      // ==================================================
      // RESPONSE
      // ==================================================

      return res.status(200).json({
        success: true,

        period: {
          type:
            period || "month",

          startDate:
            range.start,

          endDate:
            range.end,
        },

        stylist,

        stats: {
          // ------------------------------
          // ALL TIME
          // ------------------------------

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

          // Actual paid bill revenue
          totalRevenue:
            paidRevenue,

          // Booking value separately
          completedBookingRevenue,

          pendingAmount:
            roundMoney(
              billSummary.pendingAmount
            ),

          averageBillValue,

          // ------------------------------
          // PERIOD
          // ------------------------------

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
          salaryType:
            stylist.salaryType,

          monthlySalary:
            roundMoney(
              stylist.monthlySalary
            ),

          dailyBasicSalary:
            getDailyBasicSalary(
              stylist
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

          monthlyWorkingDays:
            stylist.salaryType ===
            "MONTHLY"
              ? MONTHLY_WORKING_DAYS
              : null,

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
        error:
          error.message,
      });
    }
  };

// ======================================================
// UPDATE STYLIST
//
// PATCH /api/stylists/:id
// ======================================================

export const updateStylist =
  async (req, res) => {
    try {
      const salonId =
        validateSalonAccess(
          req,
          res
        );

      if (!salonId) return;

      const { id } =
        req.params;

      if (
        !isValidObjectId(id)
      ) {
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

      // ==================================================
      // BASIC
      // ==================================================

      if (
        name !== undefined
      ) {
        if (
          !String(name).trim()
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Name cannot be empty",
          });
        }

        updateData.name =
          String(name).trim();
      }

      if (
        phone !== undefined
      ) {
        if (
          !String(phone).trim()
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Phone cannot be empty",
          });
        }

        updateData.phone =
          String(phone).trim();
      }

      if (
        email !== undefined
      ) {
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
        experience !==
        undefined
      ) {
        updateData.experience =
          Math.max(
            0,
            toNumber(
              experience
            )
          );
      }

      // ==================================================
      // STATUS
      // ==================================================

      if (
        status !== undefined
      ) {
        const finalStatus =
          String(status)
            .trim()
            .toUpperCase();

        if (
          ![
            "ACTIVE",
            "INACTIVE",
          ].includes(
            finalStatus
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid stylist status",
          });
        }

        updateData.status =
          finalStatus;
      }

      // ==================================================
      // JOINING DATE
      // ==================================================

      if (
        joiningDate !==
        undefined
      ) {
        if (
          joiningDate ===
            null ||
          joiningDate === ""
        ) {
          updateData.joiningDate =
            null;
        } else {
          const date =
            new Date(
              joiningDate
            );

          if (
            Number.isNaN(
              date.getTime()
            )
          ) {
            return res.status(400).json({
              success: false,
              message:
                "Invalid joining date",
            });
          }

          updateData.joiningDate =
            date;
        }
      }

      // ==================================================
      // SALARY TYPE
      // ==================================================

      if (
        salaryType !==
        undefined
      ) {
        const finalSalaryType =
          String(
            salaryType
          )
            .trim()
            .toUpperCase();

        if (
          ![
            "MONTHLY",
            "DAILY",
          ].includes(
            finalSalaryType
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid salary type",
          });
        }

        updateData.salaryType =
          finalSalaryType;
      }

      // ==================================================
      // SALARY
      // ==================================================

      if (
        monthlySalary !==
        undefined
      ) {
        updateData.monthlySalary =
          Math.max(
            0,
            toNumber(
              monthlySalary
            )
          );
      }

      if (
        basicSalary8h !==
        undefined
      ) {
        updateData.basicSalary8h =
          Math.max(
            0,
            toNumber(
              basicSalary8h
            )
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

      if (
        notes !== undefined
      ) {
        updateData.notes =
          String(
            notes || ""
          ).trim();
      }

      // ==================================================
      // UPDATE
      // ==================================================

      const stylist =
        await Stylist.findOneAndUpdate(
          {
            _id: id,
            salonId,
          },
          {
            $set: updateData,
          },
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
        error:
          error.message,
      });
    }
  };

// ======================================================
// DELETE STYLIST
//
// DELETE /api/stylists/:id
// ======================================================

export const deleteStylist =
  async (req, res) => {
    try {
      const salonId =
        validateSalonAccess(
          req,
          res
        );

      if (!salonId) return;

      const { id } =
        req.params;

      if (
        !isValidObjectId(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid stylist ID",
        });
      }

      const stylist =
        await Stylist.findOne({
          _id: id,
          salonId,
        });

      if (!stylist) {
        return res.status(404).json({
          success: false,
          message:
            "Stylist not found",
        });
      }

      // ==================================================
      // CHECK BOOKING HISTORY
      // ==================================================

      const bookingCount =
        await Booking.countDocuments({
          stylist: id,
        });

      // ==================================================
      // CHECK BILL HISTORY
      // ==================================================

      const billCount =
        await Bill.countDocuments({
          stylist: id,
        });

      // ==================================================
      // DO NOT DELETE HISTORICAL STAFF
      // ==================================================

      if (
        bookingCount > 0 ||
        billCount > 0
      ) {
        return res.status(409).json({
          success: false,

          message:
            "This stylist has booking or billing history. Set stylist status to INACTIVE instead of deleting.",

          hasHistory: true,

          bookingCount,

          billCount,
        });
      }

      // ==================================================
      // DELETE ATTENDANCE
      // ==================================================

      await StylistAttendance.deleteMany(
        {
          salonId,
          stylist: id,
        }
      );

      // ==================================================
      // DELETE STYLIST
      // ==================================================

      await Stylist.findOneAndDelete({
        _id: id,
        salonId,
      });

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
        error:
          error.message,
      });
    }
  };
