
import mongoose from "mongoose";
import Expense from "../models/Expense.js";

// ========================================
// HELPERS
// ========================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const getSalonId = (req) => {
  const salonId = req.user?.salonId;

  if (!salonId || !isValidObjectId(salonId)) {
    return null;
  }

  return salonId;
};

// ========================================
// CREATE EXPENSE
// POST /api/expenses
// ========================================

export const createExpense = async (req, res) => {
  try {
    const salonId = getSalonId(req);

    if (!salonId) {
      return res.status(403).json({
        success: false,
        message: "Salon access is required",
      });
    }

    const {
      title,
      category,
      amount,
      paymentMethod,
      paidTo,
      expenseDate,
      notes,
      status,
    } = req.body;

    // ----------------------------------------
    // VALIDATION
    // ----------------------------------------

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Expense title is required",
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Expense category is required",
      });
    }

    if (
      amount === undefined ||
      amount === null ||
      amount === "" ||
      Number.isNaN(Number(amount))
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid expense amount is required",
      });
    }

    if (Number(amount) < 0) {
      return res.status(400).json({
        success: false,
        message: "Expense amount cannot be negative",
      });
    }

    // ----------------------------------------
    // DATE VALIDATION
    // ----------------------------------------

    const finalExpenseDate = expenseDate
      ? new Date(expenseDate)
      : new Date();

    if (Number.isNaN(finalExpenseDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense date",
      });
    }

    // ----------------------------------------
    // CREATE
    // ----------------------------------------

    const expense = await Expense.create({
      salonId,

      title: title.trim(),

      category,

      amount: Number(amount),

      paymentMethod:
        paymentMethod || "Cash",

      paidTo:
        paidTo?.trim() || "",

      expenseDate:
        finalExpenseDate,

      notes:
        notes?.trim() || "",

      status:
        status || "Paid",

      active: true,
    });

    return res.status(201).json({
      success: true,
      message: "Expense created successfully",
      expense,
    });
  } catch (error) {
    console.error(
      "CREATE EXPENSE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create expense",
      error: error.message,
    });
  }
};

// ========================================
// GET ALL EXPENSES
// GET /api/expenses
// ========================================

export const getExpenses = async (req, res) => {
  try {
    const salonId = getSalonId(req);

    if (!salonId) {
      return res.status(403).json({
        success: false,
        message: "Salon access is required",
      });
    }

    const {
      category,
      status,
      active,
      from,
      to,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    // IMPORTANT:
    // Every query starts with salonId.
    const filter = {
      salonId,
    };

    // ----------------------------------------
    // ACTIVE FILTER
    // ----------------------------------------

    if (active !== undefined) {
      filter.active =
        active === "true";
    } else {
      filter.active = true;
    }

    // ----------------------------------------
    // CATEGORY
    // ----------------------------------------

    if (
      category &&
      category !== "All"
    ) {
      filter.category = category;
    }

    // ----------------------------------------
    // STATUS
    // ----------------------------------------

    if (
      status &&
      status !== "All"
    ) {
      filter.status = status;
    }

    // ----------------------------------------
    // DATE RANGE
    // ----------------------------------------

    if (from || to) {
      filter.expenseDate = {};

      if (from) {
        const fromDate = new Date(from);

        if (
          !Number.isNaN(
            fromDate.getTime()
          )
        ) {
          fromDate.setHours(
            0,
            0,
            0,
            0
          );

          filter.expenseDate.$gte =
            fromDate;
        }
      }

      if (to) {
        const toDate = new Date(to);

        if (
          !Number.isNaN(
            toDate.getTime()
          )
        ) {
          toDate.setHours(
            23,
            59,
            59,
            999
          );

          filter.expenseDate.$lte =
            toDate;
        }
      }
    }

    // ----------------------------------------
    // SEARCH
    // ----------------------------------------

    if (
      search &&
      search.trim()
    ) {
      const searchText =
        search.trim();

      const escaped =
        searchText.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

      const searchRegex =
        new RegExp(
          escaped,
          "i"
        );

      filter.$or = [
        {
          title: searchRegex,
        },
        {
          paidTo: searchRegex,
        },
        {
          notes: searchRegex,
        },
      ];
    }

    // ----------------------------------------
    // PAGINATION
    // ----------------------------------------

    const pageNumber = Math.max(
      Number(page) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(
        Number(limit) || 50,
        1
      ),
      200
    );

    const skip =
      (pageNumber - 1) *
      limitNumber;

    // ----------------------------------------
    // FETCH
    // ----------------------------------------

    const [
      expenses,
      total,
    ] = await Promise.all([
      Expense.find(filter)
        .sort({
          expenseDate: -1,
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      Expense.countDocuments(filter),
    ]);

    // ----------------------------------------
    // TOTAL AMOUNT
    // ----------------------------------------

    const totalAmount =
      expenses.reduce(
        (sum, expense) =>
          sum +
          Number(
            expense.amount || 0
          ),
        0
      );

    return res.status(200).json({
      success: true,
      count: expenses.length,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalAmount,
      expenses,
    });
  } catch (error) {
    console.error(
      "GET EXPENSES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch expenses",
      error: error.message,
    });
  }
};

// ========================================
// GET SINGLE EXPENSE
// GET /api/expenses/:id
// ========================================

export const getExpenseById = async (
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

    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    const expense =
      await Expense.findOne({
        _id: id,
        salonId,
        active: true,
      });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    return res.status(200).json({
      success: true,
      expense,
    });
  } catch (error) {
    console.error(
      "GET EXPENSE BY ID ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch expense",
      error: error.message,
    });
  }
};

// ========================================
// UPDATE EXPENSE
// PATCH /api/expenses/:id
// ========================================

export const updateExpense = async (
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

    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    const existingExpense =
      await Expense.findOne({
        _id: id,
        salonId,
        active: true,
      });

    if (!existingExpense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    const {
      title,
      category,
      amount,
      paymentMethod,
      paidTo,
      expenseDate,
      notes,
      status,
    } = req.body;

    // ----------------------------------------
    // UPDATE TITLE
    // ----------------------------------------

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Expense title cannot be empty",
        });
      }

      existingExpense.title =
        title.trim();
    }

    // ----------------------------------------
    // UPDATE CATEGORY
    // ----------------------------------------

    if (category !== undefined) {
      existingExpense.category =
        category;
    }

    // ----------------------------------------
    // UPDATE AMOUNT
    // ----------------------------------------

    if (amount !== undefined) {
      if (
        amount === "" ||
        Number.isNaN(
          Number(amount)
        ) ||
        Number(amount) < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid expense amount",
        });
      }

      existingExpense.amount =
        Number(amount);
    }

    // ----------------------------------------
    // UPDATE PAYMENT METHOD
    // ----------------------------------------

    if (
      paymentMethod !== undefined
    ) {
      existingExpense.paymentMethod =
        paymentMethod;
    }

    // ----------------------------------------
    // UPDATE PAID TO
    // ----------------------------------------

    if (
      paidTo !== undefined
    ) {
      existingExpense.paidTo =
        paidTo.trim();
    }

    // ----------------------------------------
    // UPDATE DATE
    // ----------------------------------------

    if (
      expenseDate !== undefined
    ) {
      const parsedDate =
        new Date(expenseDate);

      if (
        Number.isNaN(
          parsedDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid expense date",
        });
      }

      existingExpense.expenseDate =
        parsedDate;
    }

    // ----------------------------------------
    // UPDATE NOTES
    // ----------------------------------------

    if (notes !== undefined) {
      existingExpense.notes =
        notes.trim();
    }

    // ----------------------------------------
    // UPDATE STATUS
    // ----------------------------------------

    if (status !== undefined) {
      existingExpense.status =
        status;
    }

    await existingExpense.save();

    return res.status(200).json({
      success: true,
      message:
        "Expense updated successfully",
      expense: existingExpense,
    });
  } catch (error) {
    console.error(
      "UPDATE EXPENSE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update expense",
      error: error.message,
    });
  }
};

// ========================================
// DELETE EXPENSE
// DELETE /api/expenses/:id
// ========================================

export const deleteExpense = async (
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

    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    const expense =
      await Expense.findOne({
        _id: id,
        salonId,
        active: true,
      });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    // Soft delete
    expense.active = false;

    await expense.save();

    return res.status(200).json({
      success: true,
      message:
        "Expense deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE EXPENSE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete expense",
      error: error.message,
    });
  }
};

// ========================================
// GET EXPENSE SUMMARY
// GET /api/expenses/summary
// ========================================

export const getExpenseSummary = async (
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

    const {
      period = "month",
      from,
      to,
    } = req.query;

    let startDate;
    let endDate;

    // ----------------------------------------
    // CUSTOM DATE RANGE
    // ----------------------------------------

    if (from || to) {
      startDate = from
        ? new Date(from)
        : new Date(0);

      endDate = to
        ? new Date(to)
        : new Date();

      if (
        Number.isNaN(
          startDate.getTime()
        ) ||
        Number.isNaN(
          endDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid date range",
        });
      }

      startDate.setHours(
        0,
        0,
        0,
        0
      );

      endDate.setHours(
        23,
        59,
        59,
        999
      );
    } else {
      // ----------------------------------------
      // PREDEFINED PERIODS
      // ----------------------------------------

      const now = new Date();

      endDate = new Date(now);

      endDate.setHours(
        23,
        59,
        59,
        999
      );

      startDate = new Date(now);

      if (period === "today") {
        startDate.setHours(
          0,
          0,
          0,
          0
        );
      } else if (
        period === "7days" ||
        period === "7"
      ) {
        startDate.setDate(
          startDate.getDate() - 6
        );

        startDate.setHours(
          0,
          0,
          0,
          0
        );
      } else if (
        period === "month"
      ) {
        startDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        );

        startDate.setHours(
          0,
          0,
          0,
          0
        );
      } else if (
        period === "year"
      ) {
        startDate = new Date(
          now.getFullYear(),
          0,
          1
        );

        startDate.setHours(
          0,
          0,
          0,
          0
        );
      } else {
        return res.status(400).json({
          success: false,
          message:
            "Invalid period. Use today, 7days, month or year",
        });
      }
    }

    // ----------------------------------------
    // AGGREGATION
    // ----------------------------------------

    // IMPORTANT:
    // salonId is part of the match for
    // every aggregation.
    const match = {
      salonId,
      active: true,
      expenseDate: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    const [
      summary,
      categorySummary,
      paymentSummary,
    ] = await Promise.all([
      Expense.aggregate([
        {
          $match: match,
        },
        {
          $group: {
            _id: null,

            totalExpense: {
              $sum: "$amount",
            },

            totalExpenses: {
              $sum: 1,
            },

            paidExpense: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "Paid",
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },

            pendingExpense: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "Pending",
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
          },
        },
      ]),

      Expense.aggregate([
        {
          $match: match,
        },
        {
          $group: {
            _id: "$category",
            total: {
              $sum: "$amount",
            },
            count: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            total: -1,
          },
        },
      ]),

      Expense.aggregate([
        {
          $match: match,
        },
        {
          $group: {
            _id: "$paymentMethod",
            total: {
              $sum: "$amount",
            },
            count: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            total: -1,
          },
        },
      ]),
    ]);

    const result =
      summary[0] || {
        totalExpense: 0,
        totalExpenses: 0,
        paidExpense: 0,
        pendingExpense: 0,
      };

    return res.status(200).json({
      success: true,

      period,

      from:
        startDate.toISOString(),

      to:
        endDate.toISOString(),

      totalExpense:
        Number(
          result.totalExpense || 0
        ),

      totalExpenses:
        Number(
          result.totalExpenses || 0
        ),

      paidExpense:
        Number(
          result.paidExpense || 0
        ),

      pendingExpense:
        Number(
          result.pendingExpense || 0
        ),

      byCategory:
        categorySummary.map(
          (item) => ({
            category:
              item._id,

            total:
              Number(
                item.total || 0
              ),

            count:
              Number(
                item.count || 0
              ),
          })
        ),

      byPaymentMethod:
        paymentSummary.map(
          (item) => ({
            paymentMethod:
              item._id,

            total:
              Number(
                item.total || 0
              ),

            count:
              Number(
                item.count || 0
              ),
          })
        ),
    });
  } catch (error) {
    console.error(
      "EXPENSE SUMMARY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get expense summary",
      error: error.message,
    });
  }
};
