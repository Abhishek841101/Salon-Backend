import mongoose from "mongoose";

import Stylist from "../models/Stylist.js";
import StylistAttendance from "../models/StylistAttendance.js";

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
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const roundMoney = (value) => {
  return Math.round(
    Number(value || 0) * 100
  ) / 100;
};

// ======================================================
// DATE
// ======================================================

const normalizeDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(
    0,
    0,
    0,
    0
  );

  return date;
};

// ======================================================
// DATE RANGE
// ======================================================

const getDateRange = (
  startDate,
  endDate
) => {
  const start = startDate
    ? new Date(startDate)
    : new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      );

  const end = endDate
    ? new Date(endDate)
    : new Date();

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return null;
  }

  start.setHours(
    0,
    0,
    0,
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
};

// ======================================================
// MARK / UPDATE ATTENDANCE
//
// POST /api/stylists/:id/attendance
// ======================================================

export const markAttendance = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const {
      date,
      status = "PRESENT",
      checkIn,
      checkOut,
      workedHours,
      overtimeHours,
      notes = "",
    } = req.body;

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
    // STYLIST
    // --------------------------------------------------

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
    // DATE
    // --------------------------------------------------

    if (!date) {
      return res.status(400).json({
        success: false,
        message:
          "Attendance date is required",
      });
    }

    const attendanceDate =
      normalizeDate(date);

    if (!attendanceDate) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid attendance date",
      });
    }

    // --------------------------------------------------
    // STATUS
    // --------------------------------------------------

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

    // --------------------------------------------------
    // SALARY SETTINGS
    // --------------------------------------------------

    const standardHours =
      Math.max(
        1,
        toNumber(
          stylist.standardWorkingHours,
          8
        )
      );

    const basicSalary8h =
      Math.max(
        0,
        toNumber(
          stylist.basicSalary8h
        )
      );

    const overtimeRate =
      Math.max(
        0,
        toNumber(
          stylist.overtimeRatePerHour
        )
      );

    // --------------------------------------------------
    // WORKED HOURS
    // --------------------------------------------------

    let finalWorkedHours = 0;

    if (
      workedHours !== undefined &&
      workedHours !== null &&
      workedHours !== ""
    ) {
      finalWorkedHours =
        Math.max(
          0,
          toNumber(workedHours)
        );
    } else if (
      checkIn &&
      checkOut
    ) {
      const inTime =
        new Date(checkIn);

      const outTime =
        new Date(checkOut);

      if (
        !Number.isNaN(
          inTime.getTime()
        ) &&
        !Number.isNaN(
          outTime.getTime()
        ) &&
        outTime > inTime
      ) {
        finalWorkedHours =
          (outTime - inTime) /
          (1000 * 60 * 60);
      }
    }

    // ABSENT / LEAVE = 0 hours
    if (
      status === "ABSENT" ||
      status === "LEAVE"
    ) {
      finalWorkedHours = 0;
    }

    // --------------------------------------------------
    // REGULAR HOURS
    // --------------------------------------------------

    const regularHours =
      Math.min(
        finalWorkedHours,
        standardHours
      );

    // --------------------------------------------------
    // OVERTIME
    // --------------------------------------------------

    let finalOvertimeHours;

    if (
      overtimeHours !== undefined &&
      overtimeHours !== null &&
      overtimeHours !== ""
    ) {
      finalOvertimeHours =
        Math.max(
          0,
          toNumber(
            overtimeHours
          )
        );
    } else {
      finalOvertimeHours =
        Math.max(
          0,
          finalWorkedHours -
            standardHours
        );
    }

    // ABSENT / LEAVE cannot have OT
    if (
      status === "ABSENT" ||
      status === "LEAVE"
    ) {
      finalOvertimeHours = 0;
    }

    // --------------------------------------------------
    // BASIC SALARY
    // --------------------------------------------------

    let basicSalaryEarned = 0;

    if (status === "PRESENT") {
      basicSalaryEarned =
        basicSalary8h;
    }

    if (status === "HALF_DAY") {
      basicSalaryEarned =
        basicSalary8h / 2;
    }

    // --------------------------------------------------
    // OT SALARY
    // --------------------------------------------------

    const overtimeSalary =
      finalOvertimeHours *
      overtimeRate;

    // --------------------------------------------------
    // TOTAL
    // --------------------------------------------------

    const totalSalaryEarned =
      basicSalaryEarned +
      overtimeSalary;

    // --------------------------------------------------
    // UPSERT
    //
    // One stylist + one date
    // --------------------------------------------------

    const attendance =
      await StylistAttendance.findOneAndUpdate(
        {
          stylist: id,
          date: attendanceDate,
        },
        {
          stylist: id,
          date: attendanceDate,

          status,

          checkIn: checkIn
            ? new Date(checkIn)
            : null,

          checkOut: checkOut
            ? new Date(checkOut)
            : null,

          workedHours:
            roundMoney(
              finalWorkedHours
            ),

          overtimeHours:
            roundMoney(
              finalOvertimeHours
            ),

          basicSalaryEarned:
            roundMoney(
              basicSalaryEarned
            ),

          overtimeSalary:
            roundMoney(
              overtimeSalary
            ),

          totalSalaryEarned:
            roundMoney(
              totalSalaryEarned
            ),

          notes:
            String(notes || "").trim(),
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

    return res.status(200).json({
      success: true,

      message:
        "Attendance saved successfully",

      attendance,

      calculation: {
        standardWorkingHours:
          standardHours,

        workedHours:
          roundMoney(
            finalWorkedHours
          ),

        regularHours:
          roundMoney(
            regularHours
          ),

        overtimeHours:
          roundMoney(
            finalOvertimeHours
          ),

        basicSalaryEarned:
          roundMoney(
            basicSalaryEarned
          ),

        overtimeSalary:
          roundMoney(
            overtimeSalary
          ),

        totalSalaryEarned:
          roundMoney(
            totalSalaryEarned
          ),
      },
    });
  } catch (error) {
    console.error(
      "MARK STYLIST ATTENDANCE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to save attendance",
      error: error.message,
    });
  }
};

// ======================================================
// GET ATTENDANCE
//
// GET /api/stylists/:id/attendance
// ======================================================

export const getStylistAttendance =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      if (!isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid stylist ID",
        });
      }

      const stylist =
        await Stylist.findById(id)
          .select(
            "name phone email status salaryType monthlySalary basicSalary8h overtimeRatePerHour standardWorkingHours"
          )
          .lean();

      if (!stylist) {
        return res.status(404).json({
          success: false,
          message:
            "Stylist not found",
        });
      }

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

      const attendance =
        await StylistAttendance.find({
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
        error: error.message,
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
      const { id } =
        req.params;

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

      const stats =
        await StylistAttendance.aggregate([
          {
            $match: {
              stylist:
                new mongoose.Types.ObjectId(
                  id
                ),

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

      return res.status(200).json({
        success: true,

        stylist: {
          id: stylist._id,
          name: stylist.name,
          phone: stylist.phone,
          status: stylist.status,

          salary: {
            salaryType:
              stylist.salaryType,

            monthlySalary:
              stylist.monthlySalary,

            basicSalary8h:
              stylist.basicSalary8h,

            overtimeRatePerHour:
              stylist.overtimeRatePerHour,

            standardWorkingHours:
              stylist.standardWorkingHours,
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
            summary.totalDays,

          presentDays:
            summary.presentDays,

          absentDays:
            summary.absentDays,

          halfDays:
            summary.halfDays,

          leaveDays:
            summary.leaveDays,

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
        error: error.message,
      });
    }
  };