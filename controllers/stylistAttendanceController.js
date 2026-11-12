import mongoose from "mongoose";
import Stylist from "../models/Stylist.js";
import StylistAttendance from "../models/StylistAttendance.js";

// ======================================================
// CONSTANTS
// ======================================================

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
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
};

const roundMoney = (value) => {
  return Math.round(Number(value || 0) * 100) / 100;
};

const normalizeStatus = (value) => {
  return String(value || "PRESENT").trim().toUpperCase();
};

// ======================================================
// INDIA DATE HELPERS
// ======================================================

const getIndiaDateString = (date = new Date()) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const indiaDateToUTC = (dateString) => {
  if (
    typeof dateString !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateString)
  ) {
    return null;
  }

  const date = new Date(`${dateString}T00:00:00+05:30`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const normalizeAttendanceDate = (value) => {
  if (!value) {
    return null;
  }

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

const getDateRange = (startDate, endDate) => {
  const today = getIndiaDateString();

  const startString = startDate || today;
  const endString = endDate || today;

  const start = indiaDateToUTC(startString);
  const endStart = indiaDateToUTC(endString);

  if (!start || !endStart) {
    return null;
  }

  const end = new Date(endStart);

  end.setTime(
    end.getTime() + 24 * 60 * 60 * 1000 - 1
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

const parseDateTime = (value, fieldName) => {
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

const getDailyBasicSalary = (stylist) => {
  const salaryType =
    stylist.salaryType === "DAILY" ? "DAILY" : "MONTHLY";

  const monthlySalary = Math.max(
    0,
    toNumber(stylist.monthlySalary)
  );

  const dailySalary = Math.max(
    0,
    toNumber(stylist.basicSalary8h)
  );

  if (salaryType === "MONTHLY") {
    return roundMoney(
      monthlySalary / MONTHLY_WORKING_DAYS
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
  isCompleted = false,
}) => {
  const standardWorkingHours = Math.max(
    1,
    toNumber(stylist.standardWorkingHours, 8)
  );

  const dailyBasicSalary = getDailyBasicSalary(stylist);

  const hourlySalary =
    dailyBasicSalary / standardWorkingHours;

  const overtimeRatePerHour = Math.max(
    0,
    toNumber(stylist.overtimeRatePerHour)
  );

  // Check-out complete nahi hai to salary zero rahegi.
  if (!isCompleted) {
    return {
      workedHours: 0,
      overtimeHours: 0,
      basicSalaryEarned: 0,
      overtimeSalary: 0,
      totalSalaryEarned: 0,
    };
  }

  if (
    status !== "PRESENT" &&
    status !== "HALF_DAY"
  ) {
    return {
      workedHours: 0,
      overtimeHours: 0,
      basicSalaryEarned: 0,
      overtimeSalary: 0,
      totalSalaryEarned: 0,
    };
  }

  const finalWorkedHours = Math.max(
    0,
    toNumber(workedHours)
  );

  const regularWorkedHours = Math.min(
    finalWorkedHours,
    standardWorkingHours
  );

  const overtimeHours = Math.max(
    0,
    finalWorkedHours - standardWorkingHours
  );

  const basicSalaryEarned = roundMoney(
    regularWorkedHours * hourlySalary
  );

  const overtimeSalary = roundMoney(
    overtimeHours * overtimeRatePerHour
  );

  const totalSalaryEarned = roundMoney(
    basicSalaryEarned + overtimeSalary
  );

  return {
    workedHours: finalWorkedHours,
    overtimeHours: roundMoney(overtimeHours),
    basicSalaryEarned,
    overtimeSalary,
    totalSalaryEarned,
  };
};

// ======================================================
// MARK ATTENDANCE
//
// POST /api/stylists/:id/attendance
// ======================================================

export const markAttendance = async (req, res) => {
  try {
    const salonId = validateSalonAccess(req, res);

    if (!salonId) return;

    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid stylist ID",
      });
    }

    const {
      date,
      status: rawStatus = "PRESENT",
      checkIn,
      checkOut,
      notes = "",
    } = req.body;

    // ==================================================
    // STYLIST VALIDATION
    // ==================================================

    const stylist = await Stylist.findOne({
      _id: id,
      salonId,
    });

    if (!stylist) {
      return res.status(404).json({
        success: false,
        message: "Stylist not found",
      });
    }

    if (stylist.status === "INACTIVE") {
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
        message: "Attendance date is required",
      });
    }

    const attendanceDate = normalizeAttendanceDate(date);

    if (!attendanceDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance date",
      });
    }

    // ==================================================
    // STATUS
    // ==================================================

    const status = normalizeStatus(rawStatus);

    const allowedStatuses = [
      "PRESENT",
      "ABSENT",
      "HALF_DAY",
      "LEAVE",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance status",
      });
    }

    // ==================================================
    // CHECK-IN
    // ==================================================

    const parsedCheckIn = parseDateTime(
      checkIn,
      "check-in time"
    );

    if (parsedCheckIn.error) {
      return res.status(400).json({
        success: false,
        message: parsedCheckIn.error,
      });
    }

    // ==================================================
    // CHECK-OUT
    // ==================================================

    const parsedCheckOut = parseDateTime(
      checkOut,
      "check-out time"
    );

    if (parsedCheckOut.error) {
      return res.status(400).json({
        success: false,
        message: parsedCheckOut.error,
      });
    }

    // ==================================================
    // STATUS VALIDATION
    // ==================================================

    if (
      status === "PRESENT" ||
      status === "HALF_DAY"
    ) {
      if (!parsedCheckIn.date) {
        return res.status(400).json({
          success: false,
          message: "Check-in time is required",
        });
      }
    }

    if (
      status === "ABSENT" ||
      status === "LEAVE"
    ) {
      if (
        parsedCheckIn.date ||
        parsedCheckOut.date
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Check-in and check-out are not allowed for absent or leave status",
        });
      }
    }

    // ==================================================
    // CHECK-IN / CHECK-OUT VALIDATION
    // ==================================================

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
    // CALCULATE WORKED HOURS
    // ==================================================

    const isAttendanceCompleted = Boolean(
      parsedCheckIn.date &&
      parsedCheckOut.date
    );

    let finalWorkedHours = 0;

    if (isAttendanceCompleted) {
      const difference =
        parsedCheckOut.date.getTime() -
        parsedCheckIn.date.getTime();

      finalWorkedHours =
        difference / (1000 * 60 * 60);
    }

    finalWorkedHours =
      Math.round(finalWorkedHours * 100) / 100;

    // ==================================================
    // SALARY CALCULATION
    // ==================================================

    const salary = calculateAttendanceSalary({
      stylist,
      status,
      workedHours: finalWorkedHours,
      isCompleted: isAttendanceCompleted,
    });

    // ==================================================
    // UPSERT ATTENDANCE
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
            checkIn: parsedCheckIn.date,
            checkOut: parsedCheckOut.date,
            workedHours: finalWorkedHours,
            overtimeHours: salary.overtimeHours,
            basicSalaryEarned:
              salary.basicSalaryEarned,
            overtimeSalary: salary.overtimeSalary,
            totalSalaryEarned:
              salary.totalSalaryEarned,
            notes,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );

    return res.status(200).json({
      success: true,
      message: "Attendance marked successfully",
      attendance,
    });
  } catch (error) {
    console.error("MARK ATTENDANCE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark attendance",
      error: error.message,
    });
  }
};
// ======================================================
// GET STYLIST ATTENDANCE HISTORY
//
// GET /api/stylists/:id/attendance
// ======================================================

export const getStylistAttendance = async (req, res) => {
  try {
    // ==================================================
    // MULTI-TENANT ACCESS
    // ==================================================

    const salonId = validateSalonAccess(req, res);

    if (!salonId) return;

    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid stylist ID",
      });
    }

    // ==================================================
    // GET STYLIST
    // ==================================================

    const stylist = await Stylist.findOne({
      _id: id,
      salonId,
    });

    if (!stylist) {
      return res.status(404).json({
        success: false,
        message: "Stylist not found",
      });
    }

    // ==================================================
    // DATE RANGE
    // ==================================================

    const range = getDateRange(
      req.query.startDate,
      req.query.endDate
    );

    if (!range) {
      return res.status(400).json({
        success: false,
        message: "Invalid date range",
      });
    }

    // ==================================================
    // FETCH ATTENDANCE
    // ==================================================

    const attendance = await StylistAttendance.find({
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
    // Incomplete checkout records excluded
    // ==================================================

    const totalSalary = attendance.reduce(
      (sum, item) =>
        sum +
        (item.checkOut
          ? Number(item.totalSalaryEarned || 0)
          : 0),
      0
    );

    // ==================================================
    // TOTAL WORKED HOURS
    // ==================================================

    const totalWorkedHours = attendance.reduce(
      (sum, item) =>
        sum +
        (item.checkOut
          ? Number(item.workedHours || 0)
          : 0),
      0
    );

    // ==================================================
    // TOTAL OVERTIME HOURS
    // ==================================================

    const totalOvertimeHours = attendance.reduce(
      (sum, item) =>
        sum +
        (item.checkOut
          ? Number(item.overtimeHours || 0)
          : 0),
      0
    );

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      stylist,

      period: {
        startDate: range.start,
        endDate: range.end,
      },

      count: attendance.length,

      attendance,

      totals: {
        workedHours: roundMoney(
          totalWorkedHours
        ),

        overtimeHours: roundMoney(
          totalOvertimeHours
        ),

        salary: roundMoney(
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
      message: "Failed to fetch attendance",
      error: error.message,
    });
  }
};
// ======================================================
// ATTENDANCE SUMMARY
//
// GET /api/stylists/:id/attendance-summary
// ======================================================

export const getAttendanceSummary = async (req, res) => {
  try {
    // ==================================================
    // MULTI-TENANT ACCESS
    // ==================================================

    const salonId = validateSalonAccess(req, res);

    if (!salonId) return;

    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid stylist ID",
      });
    }

    // ==================================================
    // GET STYLIST
    // ==================================================

    const stylist = await Stylist.findOne({
      _id: id,
      salonId,
    }).lean();

    if (!stylist) {
      return res.status(404).json({
        success: false,
        message: "Stylist not found",
      });
    }

    // ==================================================
    // DATE RANGE
    // ==================================================

    const range = getDateRange(
      req.query.startDate,
      req.query.endDate
    );

    if (!range) {
      return res.status(400).json({
        success: false,
        message: "Invalid date range",
      });
    }

    // ==================================================
    // OBJECT IDS
    // ==================================================

    const stylistId = new mongoose.Types.ObjectId(id);

    const salonObjectId =
      new mongoose.Types.ObjectId(salonId);

    // ==================================================
    // AGGREGATION
    // ==================================================

    const stats = await StylistAttendance.aggregate([
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

          // ------------------------------------------
          // TOTAL DAYS
          // ------------------------------------------

          totalDays: {
            $sum: 1,
          },

          // ------------------------------------------
          // PRESENT DAYS
          // ------------------------------------------

          presentDays: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", "PRESENT"],
                },
                1,
                0,
              ],
            },
          },

          // ------------------------------------------
          // ABSENT DAYS
          // ------------------------------------------

          absentDays: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", "ABSENT"],
                },
                1,
                0,
              ],
            },
          },

          // ------------------------------------------
          // HALF DAYS
          // ------------------------------------------

          halfDays: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", "HALF_DAY"],
                },
                1,
                0,
              ],
            },
          },

          // ------------------------------------------
          // LEAVE DAYS
          // ------------------------------------------

          leaveDays: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", "LEAVE"],
                },
                1,
                0,
              ],
            },
          },

          // ------------------------------------------
          // WORKED HOURS
          // Only completed checkout records
          // ------------------------------------------

          totalWorkedHours: {
            $sum: {
              $cond: [
                {
                  $ne: ["$checkOut", null],
                },
                {
                  $ifNull: ["$workedHours", 0],
                },
                0,
              ],
            },
          },

          // ------------------------------------------
          // OVERTIME HOURS
          // ------------------------------------------

          totalOvertimeHours: {
            $sum: {
              $cond: [
                {
                  $ne: ["$checkOut", null],
                },
                {
                  $ifNull: ["$overtimeHours", 0],
                },
                0,
              ],
            },
          },

          // ------------------------------------------
          // BASIC SALARY
          // ------------------------------------------

          basicSalaryEarned: {
            $sum: {
              $cond: [
                {
                  $ne: ["$checkOut", null],
                },
                {
                  $ifNull: [
                    "$basicSalaryEarned",
                    0,
                  ],
                },
                0,
              ],
            },
          },

          // ------------------------------------------
          // OVERTIME SALARY
          // ------------------------------------------

          overtimeSalary: {
            $sum: {
              $cond: [
                {
                  $ne: ["$checkOut", null],
                },
                {
                  $ifNull: [
                    "$overtimeSalary",
                    0,
                  ],
                },
                0,
              ],
            },
          },

          // ------------------------------------------
          // TOTAL SALARY
          // ------------------------------------------

          totalSalaryEarned: {
            $sum: {
              $cond: [
                {
                  $ne: ["$checkOut", null],
                },
                {
                  $ifNull: [
                    "$totalSalaryEarned",
                    0,
                  ],
                },
                0,
              ],
            },
          },
        },
      },
    ]);

    // ==================================================
    // DEFAULT SUMMARY
    // ==================================================

    const summary = stats[0] || {
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
          salaryType: stylist.salaryType,

          monthlySalary: roundMoney(
            stylist.monthlySalary
          ),

          dailyBasicSalary: getDailyBasicSalary(
            stylist
          ),

          basicSalary8h: roundMoney(
            stylist.basicSalary8h
          ),

          overtimeRatePerHour: roundMoney(
            stylist.overtimeRatePerHour
          ),

          standardWorkingHours: Number(
            stylist.standardWorkingHours || 8
          ),
        },
      },

      period: {
        startDate: range.start,
        endDate: range.end,
      },

      attendance: {
        totalDays: Number(
          summary.totalDays || 0
        ),

        presentDays: Number(
          summary.presentDays || 0
        ),

        absentDays: Number(
          summary.absentDays || 0
        ),

        halfDays: Number(
          summary.halfDays || 0
        ),

        leaveDays: Number(
          summary.leaveDays || 0
        ),

        totalWorkedHours: roundMoney(
          summary.totalWorkedHours
        ),

        totalOvertimeHours: roundMoney(
          summary.totalOvertimeHours
        ),
      },

      salary: {
        basicSalaryEarned: roundMoney(
          summary.basicSalaryEarned
        ),

        overtimeSalary: roundMoney(
          summary.overtimeSalary
        ),

        totalSalaryEarned: roundMoney(
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
      message: "Failed to get attendance summary",
      error: error.message,
    });
  }
};