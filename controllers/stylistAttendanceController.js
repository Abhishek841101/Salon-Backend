
import mongoose from "mongoose";

import Stylist from "../models/Stylist.js";

import StylistAttendance from "../models/StylistAttendance.js";

// ======================================================
// CONSTANTS
// ======================================================

// Monthly salary ko daily salary me convert karne ke liye
// 26 working days use kiye ja rahe hain.
const MONTHLY_WORKING_DAYS = 26;

const INDIA_TIMEZONE = "Asia/Kolkata";

// ======================================================
// HELPERS
// ======================================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

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

const toNumber = (value, fallback = 0) => {
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
  return Math.round(Number(value || 0) * 100) / 100;
};

const normalizeStatus = (value) => {
  return String(value || "PRESENT")
    .trim()
    .toUpperCase();
};

// ======================================================
// INDIA DATE HELPERS
// ======================================================

// YYYY-MM-DD return karta hai India timezone me
const getIndiaDateString = (date = new Date()) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

// YYYY-MM-DD ko India midnight ke UTC Date me convert
const indiaDateToUTC = (dateString) => {
  if (
    typeof dateString !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateString)
  ) {
    return null;
  }

  const date = new Date(
    `${dateString}T00:00:00+05:30`
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

// Request date ko attendance date me convert
const normalizeAttendanceDate = (value) => {
  if (!value) {
    return null;
  }

  // YYYY-MM-DD
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return indiaDateToUTC(value);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const indiaDate = getIndiaDateString(date);

  return indiaDateToUTC(indiaDate);
};

// ======================================================
// DATE RANGE
// ======================================================

const getDateRange = (
  startDate,
  endDate
) => {
  const today = getIndiaDateString();

  const startString = startDate || today;
  const endString = endDate || today;

  const start = indiaDateToUTC(startString);
  const endStart = indiaDateToUTC(endString);

  if (!start || !endStart) {
    return null;
  }

  const end = new Date(endStart);

  // India next-day midnight minus 1ms
  end.setTime(
    end.getTime() +
      24 * 60 * 60 * 1000 -
      1
  );

  if (start > end) {
    return null;
  }

  return {
    start,
    end,
  };
};

// ======================================================
// DATE VALIDATION
// ======================================================

const parseDateTime = (
  value,
  fieldName
) => {
  if (!value) {
    return {
      date: null,
      error: null,
    };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      date: null,
      error: `Invalid ${fieldName}`,
    };
  }

  return {
    date,
    error: null,
  };
};

// ======================================================
// SALARY CALCULATION
// ======================================================

const getDailyBasicSalary = (
  stylist
) => {
  const salaryType =
    stylist.salaryType === "DAILY"
      ? "DAILY"
      : "MONTHLY";

  const monthlySalary = Math.max(
    0,
    toNumber(
      stylist.monthlySalary
    )
  );

  const dailySalary = Math.max(
    0,
    toNumber(
      stylist.basicSalary8h
    )
  );

  if (salaryType === "MONTHLY") {
    return roundMoney(
      monthlySalary /
        MONTHLY_WORKING_DAYS
    );
  }

  return roundMoney(dailySalary);
};

// ======================================================
// ATTENDANCE SALARY CALCULATION
// ======================================================

const calculateAttendanceSalary = ({
  stylist,
  status,
  workedHours,
}) => {
  const standardHours = Math.max(
    1,
    toNumber(
      stylist.standardWorkingHours,
      8
    )
  );

  const overtimeRate = Math.max(
    0,
    toNumber(
      stylist.overtimeRatePerHour
    )
  );

  const dailyBasicSalary =
    getDailyBasicSalary(stylist);

  const safeWorkedHours = Math.max(
    0,
    toNumber(workedHours)
  );

  const regularHours = Math.min(
    safeWorkedHours,
    standardHours
  );

  let overtimeHours = Math.max(
    0,
    safeWorkedHours -
      standardHours
  );

  let basicSalaryEarned = 0;

  if (status === "PRESENT") {
    basicSalaryEarned =
      dailyBasicSalary;
  }

  if (status === "HALF_DAY") {
    basicSalaryEarned =
      dailyBasicSalary / 2;

    // Half-day ke case me standard
    // hours ka half regular work maana jayega.
    // Lekin agar actual hours standard se zyada
    // hain to OT actual hours ke according rahega.
  }

  if (
    status === "ABSENT" ||
    status === "LEAVE"
  ) {
    overtimeHours = 0;
    basicSalaryEarned = 0;
  }

  const overtimeSalary =
    overtimeHours *
    overtimeRate;

  const totalSalaryEarned =
    basicSalaryEarned +
    overtimeSalary;

  return {
    standardHours: roundMoney(
      standardHours
    ),

    regularHours: roundMoney(
      regularHours
    ),

    overtimeHours: roundMoney(
      overtimeHours
    ),

    basicSalaryEarned: roundMoney(
      basicSalaryEarned
    ),

    overtimeSalary: roundMoney(
      overtimeSalary
    ),

    totalSalaryEarned: roundMoney(
      totalSalaryEarned
    ),
  };
};

// ======================================================
// MARK / UPDATE ATTENDANCE
//
// POST /api/stylists/:id/attendance
// ======================================================

export const markAttendance =
  async (req, res) => {
    try {
      // ==================================================
      // MULTI-TENANT ACCESS
      // ==================================================

      const salonId =
        validateSalonAccess(
          req,
          res
        );

      if (!salonId) return;

      const { id } =
        req.params;

      const {
        date,
        status: rawStatus = "PRESENT",
        checkIn,
        checkOut,
        workedHours,
        notes = "",
      } = req.body;

      // ==================================================
      // VALIDATE STYLIST ID
      // ==================================================

      if (
        !isValidObjectId(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid stylist ID",
        });
      }

      // ==================================================
      // GET STYLIST
      // IMPORTANT:
      // Stylist must belong to same salon
      // ==================================================

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
      // INACTIVE STAFF
      // ==================================================

      if (
        stylist.status ===
        "INACTIVE"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Inactive stylist cannot be marked for attendance",
        });
      }

      // ==================================================
      // DATE
      // ==================================================

      if (!date) {
        return res.status(400).json({
          success: false,
          message:
            "Attendance date is required",
        });
      }

      const attendanceDate =
        normalizeAttendanceDate(
          date
        );

      if (!attendanceDate) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid attendance date",
        });
      }

      // ==================================================
      // STATUS
      // ==================================================

      const status =
        normalizeStatus(
          rawStatus
        );

      const allowedStatuses = [
        "PRESENT",
        "ABSENT",
        "HALF_DAY",
        "LEAVE",
      ];

      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid attendance status",
        });
      }

      // ==================================================
      // CHECK-IN
      // ==================================================

      const parsedCheckIn =
        parseDateTime(
          checkIn,
          "check-in time"
        );

      if (
        parsedCheckIn.error
      ) {
        return res.status(400).json({
          success: false,
          message:
            parsedCheckIn.error,
        });
      }

      // ==================================================
      // CHECK-OUT
      // ==================================================

      const parsedCheckOut =
        parseDateTime(
          checkOut,
          "check-out time"
        );

      if (
        parsedCheckOut.error
      ) {
        return res.status(400).json({
          success: false,
          message:
            parsedCheckOut.error,
        });
      }

      // ==================================================
      // STATUS VALIDATION
      // ==================================================

      if (
        status === "PRESENT" ||
        status === "HALF_DAY"
      ) {
        if (
          !parsedCheckIn.date
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Check-in time is required for PRESENT or HALF_DAY",
          });
        }
      }

      if (
        status === "ABSENT" ||
        status === "LEAVE"
      ) {
        // Absent / Leave me check-in/out
        // automatically remove karenge.
        parsedCheckIn.date = null;
        parsedCheckOut.date = null;
      }

      // ==================================================
      // CHECK-OUT VALIDATION
      // ==================================================

      if (
        parsedCheckOut.date &&
        !parsedCheckIn.date
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Check-in is required before check-out",
        });
      }

      if (
        parsedCheckIn.date &&
        parsedCheckOut.date
      ) {
        if (
          parsedCheckOut.date <=
          parsedCheckIn.date
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Check-out must be after check-in",
          });
        }
      }

      // ==================================================
      // WORKED HOURS
      // ==================================================

      let finalWorkedHours = 0;

      // --------------------------------------------------
      // If check-in + check-out available
      // calculate automatically.
      // --------------------------------------------------

      if (
        parsedCheckIn.date &&
        parsedCheckOut.date
      ) {
        finalWorkedHours =
          (
            parsedCheckOut.date -
            parsedCheckIn.date
          ) /
          (1000 * 60 * 60);
      }

      // --------------------------------------------------
      // If only workedHours manually provided
      // --------------------------------------------------

      if (
        !parsedCheckOut.date &&
        workedHours !==
          undefined &&
        workedHours !== null &&
        workedHours !== ""
      ) {
        finalWorkedHours =
          Math.max(
            0,
            toNumber(
              workedHours
            )
          );
      }

      // --------------------------------------------------
      // ABSENT / LEAVE = 0
      // --------------------------------------------------

      if (
        status === "ABSENT" ||
        status === "LEAVE"
      ) {
        finalWorkedHours = 0;
      }

      // ==================================================
      // SALARY
      // ==================================================

      const calculation =
        calculateAttendanceSalary({
          stylist,
          status,
          workedHours:
            finalWorkedHours,
        });

      // ==================================================
      // UPSERT
      // IMPORTANT:
      // salonId + stylist + date
      // ==================================================

      const attendance =
        await StylistAttendance.findOneAndUpdate(
          {
            salonId,
            stylist: id,
            date: attendanceDate,
          },
          {
            $set: {
              salonId,
              stylist: id,
              date: attendanceDate,

              status,

              checkIn:
                parsedCheckIn.date ||
                null,

              checkOut:
                parsedCheckOut.date ||
                null,

              workedHours:
                calculation
                  .standardHours >= 0
                  ? roundMoney(
                      finalWorkedHours
                    )
                  : 0,

              overtimeHours:
                calculation.overtimeHours,

              basicSalaryEarned:
                calculation.basicSalaryEarned,

              overtimeSalary:
                calculation.overtimeSalary,

              totalSalaryEarned:
                calculation.totalSalaryEarned,

              notes:
                String(
                  notes || ""
                ).trim(),
            },
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          }
        ).populate(
          "stylist",
          "name phone email specialization status salaryType monthlySalary basicSalary8h overtimeRatePerHour standardWorkingHours"
        );

      // ==================================================
      // RESPONSE
      // ==================================================

      return res.status(200).json({
        success: true,

        message:
          "Attendance saved successfully",

        attendance,

        calculation: {
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

          monthlyWorkingDays:
            stylist.salaryType ===
            "MONTHLY"
              ? MONTHLY_WORKING_DAYS
              : null,

          standardWorkingHours:
            calculation.standardHours,

          workedHours:
            roundMoney(
              finalWorkedHours
            ),

          regularHours:
            calculation.regularHours,

          overtimeHours:
            calculation.overtimeHours,

          basicSalaryEarned:
            calculation.basicSalaryEarned,

          overtimeSalary:
            calculation.overtimeSalary,

          totalSalaryEarned:
            calculation.totalSalaryEarned,
        },
      });
    } catch (error) {
      console.error(
        "MARK STYLIST ATTENDANCE ERROR:",
        error
      );

      // Duplicate index race condition
      if (
        error?.code === 11000
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Attendance already exists for this stylist and date. Please refresh and try again.",
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Failed to save attendance",
        error:
          error.message,
      });
    }
  };

// ======================================================
// GET ATTENDANCE
//
// GET /api/stylists/:id/attendance
//
// Optional:
// ?startDate=2026-09-01
// &endDate=2026-09-30
// ======================================================

export const getStylistAttendance =
  async (req, res) => {
    try {
      // ==================================================
      // MULTI-TENANT ACCESS
      // ==================================================

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

      // ==================================================
      // GET STYLIST
      // ==================================================

      const stylist =
        await Stylist.findOne({
          _id: id,
          salonId,
        })
          .select(
            [
              "name",
              "phone",
              "email",
              "status",
              "salaryType",
              "monthlySalary",
              "basicSalary8h",
              "overtimeRatePerHour",
              "standardWorkingHours",
            ].join(" ")
          )
          .lean();

      if (!stylist) {
        return res.status(404).json({
          success: false,
          message:
            "Stylist not found",
        });
      }

      // ==================================================
      // DATE RANGE
      // ==================================================

      const range =
        getDateRange(
          req.query.startDate,
          req.query.endDate
        );

      if (!range) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid date range",
        });
      }

      // ==================================================
      // GET ATTENDANCE
      // ==================================================

      const attendance =
        await StylistAttendance.find({
          salonId,
          stylist: id,
          date: {
            $gte: range.start,
            $lte: range.end,
          },
        })
          .sort({
            date: -1,
          })
          .lean();

      // ==================================================
      // TOTAL SALARY
      // ==================================================

      const totalSalary =
        attendance.reduce(
          (sum, item) =>
            sum +
            Number(
              item.totalSalaryEarned ||
                0
            ),
          0
        );

      // ==================================================
      // TOTAL WORKED HOURS
      // ==================================================

      const totalWorkedHours =
        attendance.reduce(
          (sum, item) =>
            sum +
            Number(
              item.workedHours ||
                0
            ),
          0
        );

      // ==================================================
      // TOTAL OVERTIME HOURS
      // ==================================================

      const totalOvertimeHours =
        attendance.reduce(
          (sum, item) =>
            sum +
            Number(
              item.overtimeHours ||
                0
            ),
          0
        );

      // ==================================================
      // RESPONSE
      // ==================================================

      return res.status(200).json({
        success: true,

        stylist,

        period: {
          startDate:
            range.start,
          endDate:
            range.end,
        },

        count:
          attendance.length,

        attendance,

        totals: {
          workedHours:
            roundMoney(
              totalWorkedHours
            ),

          overtimeHours:
            roundMoney(
              totalOvertimeHours
            ),

          salary:
            roundMoney(
              totalSalary
            ),
        },
      });
    } catch (error) {
      console.error(
        "GET STYLIST ATTENDANCE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch attendance",
        error:
          error.message,
      });
    }
  };

// ======================================================
// ATTENDANCE SUMMARY
//
// GET /api/stylists/:id/attendance-summary
// ======================================================

export const getAttendanceSummary =
  async (req, res) => {
    try {
      // ==================================================
      // MULTI-TENANT ACCESS
      // ==================================================

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

      // ==================================================
      // GET STYLIST
      // ==================================================

      const stylist =
        await Stylist.findOne({
          _id: id,
          salonId,
        })
          .lean();

      if (!stylist) {
        return res.status(404).json({
          success: false,
          message:
            "Stylist not found",
        });
      }

      // ==================================================
      // DATE RANGE
      // ==================================================

      const range =
        getDateRange(
          req.query.startDate,
          req.query.endDate
        );

      if (!range) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid date range",
        });
      }

      const stylistId =
        new mongoose.Types.ObjectId(
          id
        );

      const salonObjectId =
        new mongoose.Types.ObjectId(
          salonId
        );

      // ==================================================
      // SUMMARY
      // ==================================================

      const stats =
        await StylistAttendance.aggregate([
          {
            $match: {
              salonId: salonObjectId,

              stylist: stylistId,

              date: {
                $gte: range.start,
                $lte: range.end,
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

              totalOvertimeHours: {
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

      const summary =
        stats[0] || {
          totalDays: 0,
          presentDays: 0,
          absentDays: 0,
          halfDays: 0,
          leaveDays: 0,
          totalWorkedHours: 0,
          totalOvertimeHours: 0,
          basicSalaryEarned: 0,
          overtimeSalary: 0,
          totalSalaryEarned: 0,
        };

      // ==================================================
      // RESPONSE
      // ==================================================

      return res.status(200).json({
        success: true,

        stylist: {
          id: stylist._id,
          name: stylist.name,
          phone: stylist.phone,
          email: stylist.email,
          status: stylist.status,

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
          },
        },

        period: {
          startDate:
            range.start,
          endDate:
            range.end,
        },

        attendance: {
          totalDays:
            Number(
              summary.totalDays ||
                0
            ),

          presentDays:
            Number(
              summary.presentDays ||
                0
            ),

          absentDays:
            Number(
              summary.absentDays ||
                0
            ),

          halfDays:
            Number(
              summary.halfDays ||
                0
            ),

          leaveDays:
            Number(
              summary.leaveDays ||
                0
            ),

          totalWorkedHours:
            roundMoney(
              summary.totalWorkedHours
            ),

          totalOvertimeHours:
            roundMoney(
              summary.totalOvertimeHours
            ),
        },

        salary: {
          basicSalaryEarned:
            roundMoney(
              summary.basicSalaryEarned
            ),

          overtimeSalary:
            roundMoney(
              summary.overtimeSalary
            ),

          totalSalaryEarned:
            roundMoney(
              summary.totalSalaryEarned
            ),
        },
      });
    } catch (error) {
      console.error(
        "GET ATTENDANCE SUMMARY ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to get attendance summary",
        error:
          error.message,
      });
    }
  };
