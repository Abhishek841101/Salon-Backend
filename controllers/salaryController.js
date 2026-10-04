import mongoose from "mongoose";

import Salary from "../models/Salary.js";
import Stylist from "../models/Stylist.js";
import StylistAttendance from "../models/StylistAttendance.js";

// ======================================================
// HELPERS
// ======================================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
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
  return (
    Math.round(Number(value || 0) * 100) / 100
  );
};

// ======================================================
// MONTH VALIDATION
// YYYY-MM
// ======================================================

const isValidMonth = (month) => {
  if (
    typeof month !== "string" ||
    !/^\d{4}-\d{2}$/.test(month)
  ) {
    return false;
  }

  const [year, monthNumber] =
    month.split("-").map(Number);

  return (
    year >= 2000 &&
    year <= 2100 &&
    monthNumber >= 1 &&
    monthNumber <= 12
  );
};

// ======================================================
// MONTH DATE RANGE
// ======================================================

const getMonthRange = (month) => {
  if (!isValidMonth(month)) {
    return null;
  }

  const [year, monthNumber] =
    month.split("-").map(Number);

  const start = new Date(
    `${month}-01T00:00:00+05:30`
  );

  const nextMonth =
    monthNumber === 12
      ? `${year + 1}-01`
      : `${year}-${String(
          monthNumber + 1
        ).padStart(2, "0")}`;

  const end = new Date(
    `${nextMonth}-01T00:00:00+05:30`
  );

  end.setTime(
    end.getTime() - 1
  );

  return {
    start,
    end,
  };
};

// ======================================================
// GET MONTH FROM CURRENT DATE
// INDIA TIME
// ======================================================

const getCurrentMonth = () => {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
      }
    ).formatToParts(new Date());

  const year =
    parts.find(
      (item) => item.type === "year"
    )?.value;

  const month =
    parts.find(
      (item) => item.type === "month"
    )?.value;

  return `${year}-${month}`;
};

// ======================================================
// CALCULATE NET SALARY
// ======================================================

const calculateSalary = ({
  basicSalary = 0,
  overtimeSalary = 0,
  commission = 0,
  bonus = 0,
  advance = 0,
  deduction = 0,
}) => {
  const basic = Math.max(
    0,
    toNumber(basicSalary)
  );

  const overtime = Math.max(
    0,
    toNumber(overtimeSalary)
  );

  const finalCommission = Math.max(
    0,
    toNumber(commission)
  );

  const finalBonus = Math.max(
    0,
    toNumber(bonus)
  );

  const finalAdvance = Math.max(
    0,
    toNumber(advance)
  );

  const finalDeduction = Math.max(
    0,
    toNumber(deduction)
  );

  const grossSalary =
    basic +
    overtime +
    finalCommission +
    finalBonus;

  const netSalary = Math.max(
    0,
    grossSalary -
      finalAdvance -
      finalDeduction
  );

  return {
    basicSalary: roundMoney(basic),
    overtimeSalary: roundMoney(overtime),
    commission: roundMoney(
      finalCommission
    ),
    bonus: roundMoney(
      finalBonus
    ),
    advance: roundMoney(
      finalAdvance
    ),
    deduction: roundMoney(
      finalDeduction
    ),
    grossSalary: roundMoney(
      grossSalary
    ),
    netSalary: roundMoney(
      netSalary
    ),
  };
};

// ======================================================
// GET ATTENDANCE SALARY FOR MONTH
// ======================================================

const getAttendanceSalary = async ({
  stylistId,
  month,
}) => {
  const range = getMonthRange(month);

  if (!range) {
    return null;
  }

  const attendance =
    await StylistAttendance.find({
      stylist: stylistId,
      date: {
        $gte: range.start,
        $lte: range.end,
      },
    }).lean();

  let basicSalary = 0;
  let overtimeSalary = 0;
  let workedHours = 0;
  let overtimeHours = 0;

  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let leaveDays = 0;

  attendance.forEach((item) => {
    basicSalary += Number(
      item.basicSalaryEarned || 0
    );

    overtimeSalary += Number(
      item.overtimeSalary || 0
    );

    workedHours += Number(
      item.workedHours || 0
    );

    overtimeHours += Number(
      item.overtimeHours || 0
    );

    switch (item.status) {
      case "PRESENT":
        presentDays++;
        break;

      case "ABSENT":
        absentDays++;
        break;

      case "HALF_DAY":
        halfDays++;
        break;

      case "LEAVE":
        leaveDays++;
        break;

      default:
        break;
    }
  });

  return {
    attendanceCount:
      attendance.length,

    presentDays,
    absentDays,
    halfDays,
    leaveDays,

    workedHours:
      roundMoney(workedHours),

    overtimeHours:
      roundMoney(overtimeHours),

    basicSalary:
      roundMoney(basicSalary),

    overtimeSalary:
      roundMoney(overtimeSalary),
  };
};

// ======================================================
// CREATE / UPDATE SALARY
//
// POST /api/salaries
// ======================================================

export const createSalary =
  async (req, res) => {
    try {
      const {
        stylist,
        month,
        commission = 0,
        bonus = 0,
        advance = 0,
        deduction = 0,
        paymentMethod = "CASH",
        notes = "",
      } = req.body;

      // --------------------------------------------------
      // VALIDATE STYLIST
      // --------------------------------------------------

      if (
        !stylist ||
        !isValidObjectId(stylist)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Valid stylist is required",
        });
      }

      // --------------------------------------------------
      // MONTH
      // --------------------------------------------------

      const finalMonth =
        month || getCurrentMonth();

      if (!isValidMonth(finalMonth)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid month. Use YYYY-MM format",
        });
      }

      // --------------------------------------------------
      // GET STYLIST
      // --------------------------------------------------

      const stylistData =
        await Stylist.findById(
          stylist
        ).lean();

      if (!stylistData) {
        return res.status(404).json({
          success: false,
          message:
            "Stylist not found",
        });
      }

      // --------------------------------------------------
      // ATTENDANCE
      // --------------------------------------------------

      const attendance =
        await getAttendanceSalary({
          stylistId: stylist,
          month: finalMonth,
        });

      if (!attendance) {
        return res.status(400).json({
          success: false,
          message:
            "Unable to calculate attendance salary",
        });
      }

      // --------------------------------------------------
      // CALCULATE
      // --------------------------------------------------

      const calculation =
        calculateSalary({
          basicSalary:
            attendance.basicSalary,

          overtimeSalary:
            attendance.overtimeSalary,

          commission,

          bonus,

          advance,

          deduction,
        });

      // --------------------------------------------------
      // CREATE / UPDATE
      // --------------------------------------------------

      const salary =
        await Salary.findOneAndUpdate(
          {
            stylist,
            month: finalMonth,
          },
          {
            $set: {
              stylist,
              month: finalMonth,

              ...calculation,

              paymentMethod:
                String(
                  paymentMethod
                ).toUpperCase(),

              notes:
                String(notes || "").trim(),
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
          "name phone email status salaryType monthlySalary basicSalary8h overtimeRatePerHour standardWorkingHours"
        );

      return res.status(200).json({
        success: true,

        message:
          "Salary saved successfully",

        salary,

        attendance,
      });
    } catch (error) {
      console.error(
        "CREATE SALARY ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to save salary",
        error: error.message,
      });
    }
  };

// ======================================================
// GET ALL SALARIES
//
// GET /api/salaries
//
// ?month=2026-10
// ?status=PAID
// ?search=rahul
// ======================================================

export const getSalaries =
  async (req, res) => {
    try {
      const {
        month,
        status,
        search,
      } = req.query;

      const finalMonth =
        month || getCurrentMonth();

      if (!isValidMonth(finalMonth)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid month. Use YYYY-MM",
        });
      }

      const filter = {
        month: finalMonth,
      };

      // --------------------------------------------------
      // PAYMENT STATUS
      // --------------------------------------------------

      if (status) {
        const finalStatus =
          String(status)
            .trim()
            .toUpperCase();

        if (
          ["PAID", "PENDING"].includes(
            finalStatus
          )
        ) {
          filter.paymentStatus =
            finalStatus;
        }
      }

      // --------------------------------------------------
      // SEARCH STYLIST
      // --------------------------------------------------

      let stylistIds = null;

      if (search) {
        const searchText =
          String(search).trim();

        if (searchText) {
          const escaped =
            searchText.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            );

          const stylists =
            await Stylist.find({
              $or: [
                {
                  name: {
                    $regex: escaped,
                    $options: "i",
                  },
                },
                {
                  phone: {
                    $regex: escaped,
                    $options: "i",
                  },
                },
                {
                  email: {
                    $regex: escaped,
                    $options: "i",
                  },
                },
              ],
            })
              .select("_id")
              .lean();

          stylistIds =
            stylists.map(
              (item) => item._id
            );

          filter.stylist = {
            $in: stylistIds,
          };
        }
      }

      // --------------------------------------------------
      // GET SAVED SALARIES
      // --------------------------------------------------

      const salaries =
        await Salary.find(filter)
          .populate(
            "stylist",
            "name phone email status salaryType monthlySalary basicSalary8h overtimeRatePerHour"
          )
          .sort({
            createdAt: -1,
          })
          .lean();

      // --------------------------------------------------
      // TOTALS
      // --------------------------------------------------

      const totals =
        salaries.reduce(
          (result, salary) => {
            result.grossSalary +=
              Number(
                salary.grossSalary || 0
              );

            result.netSalary +=
              Number(
                salary.netSalary || 0
              );

            if (
              salary.paymentStatus ===
              "PAID"
            ) {
              result.paid +=
                Number(
                  salary.netSalary || 0
                );
            }

            if (
              salary.paymentStatus ===
              "PENDING"
            ) {
              result.pending +=
                Number(
                  salary.netSalary || 0
                );
            }

            return result;
          },
          {
            grossSalary: 0,
            netSalary: 0,
            paid: 0,
            pending: 0,
          }
        );

      return res.status(200).json({
        success: true,

        month: finalMonth,

        count: salaries.length,

        totals: {
          grossSalary:
            roundMoney(
              totals.grossSalary
            ),

          netSalary:
            roundMoney(
              totals.netSalary
            ),

          paid:
            roundMoney(
              totals.paid
            ),

          pending:
            roundMoney(
              totals.pending
            ),
        },

        salaries,
      });
    } catch (error) {
      console.error(
        "GET SALARIES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch salaries",
        error: error.message,
      });
    }
  };

// ======================================================
// GET SINGLE SALARY
//
// GET /api/salaries/:id
// ======================================================

export const getSalaryById =
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
            "Invalid salary ID",
        });
      }

      const salary =
        await Salary.findById(id)
          .populate(
            "stylist",
            "name phone email status salaryType monthlySalary basicSalary8h overtimeRatePerHour standardWorkingHours"
          )
          .lean();

      if (!salary) {
        return res.status(404).json({
          success: false,
          message:
            "Salary not found",
        });
      }

      const attendance =
        await getAttendanceSalary({
          stylistId:
            salary.stylist._id,
          month: salary.month,
        });

      return res.status(200).json({
        success: true,
        salary,
        attendance,
      });
    } catch (error) {
      console.error(
        "GET SALARY ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch salary",
        error: error.message,
      });
    }
  };

// ======================================================
// MARK SALARY AS PAID
//
// PATCH /api/salaries/:id/pay
// ======================================================

export const markSalaryPaid =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      const {
        paymentMethod = "CASH",
        paymentDate,
        notes,
      } = req.body;

      if (
        !isValidObjectId(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid salary ID",
        });
      }

      const allowedMethods = [
        "CASH",
        "BANK_TRANSFER",
        "UPI",
        "OTHER",
      ];

      const finalPaymentMethod =
        String(paymentMethod)
          .trim()
          .toUpperCase();

      if (
        !allowedMethods.includes(
          finalPaymentMethod
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid payment method",
        });
      }

      const finalPaymentDate =
        paymentDate
          ? new Date(paymentDate)
          : new Date();

      if (
        Number.isNaN(
          finalPaymentDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid payment date",
        });
      }

      const salary =
        await Salary.findByIdAndUpdate(
          id,
          {
            $set: {
              paymentStatus: "PAID",

              paymentDate:
                finalPaymentDate,

              paymentMethod:
                finalPaymentMethod,

              ...(notes !== undefined
                ? {
                    notes:
                      String(
                        notes
                      ).trim(),
                  }
                : {}),
            },
          },
          {
            new: true,
            runValidators: true,
          }
        ).populate(
          "stylist",
          "name phone email status"
        );

      if (!salary) {
        return res.status(404).json({
          success: false,
          message:
            "Salary not found",
        });
      }

      return res.status(200).json({
        success: true,

        message:
          "Salary marked as paid",

        salary,
      });
    } catch (error) {
      console.error(
        "MARK SALARY PAID ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to mark salary as paid",
        error: error.message,
      });
    }
  };

// ======================================================
// MARK SALARY AS PENDING
//
// PATCH /api/salaries/:id/pending
// ======================================================

export const markSalaryPending =
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
            "Invalid salary ID",
        });
      }

      const salary =
        await Salary.findByIdAndUpdate(
          id,
          {
            $set: {
              paymentStatus:
                "PENDING",

              paymentDate: null,
            },
          },
          {
            new: true,
            runValidators: true,
          }
        ).populate(
          "stylist",
          "name phone email status"
        );

      if (!salary) {
        return res.status(404).json({
          success: false,
          message:
            "Salary not found",
        });
      }

      return res.status(200).json({
        success: true,

        message:
          "Salary marked as pending",

        salary,
      });
    } catch (error) {
      console.error(
        "MARK SALARY PENDING ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update salary status",
        error: error.message,
      });
    }
  };

// ======================================================
// DELETE SALARY
//
// DELETE /api/salaries/:id
// ======================================================

export const deleteSalary =
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
            "Invalid salary ID",
        });
      }

      const salary =
        await Salary.findByIdAndDelete(
          id
        );

      if (!salary) {
        return res.status(404).json({
          success: false,
          message:
            "Salary not found",
        });
      }

      return res.status(200).json({
        success: true,

        message:
          "Salary deleted successfully",
      });
    } catch (error) {
      console.error(
        "DELETE SALARY ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete salary",
        error: error.message,
      });
    }
  };