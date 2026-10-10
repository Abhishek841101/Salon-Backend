
import mongoose from "mongoose";

import Bill from "../models/Bill.js";
import Client from "../models/Client.js";
import Service from "../models/Service.js";
import Stylist from "../models/Stylist.js";

// ========================================
// HELPERS
// ========================================

const getSalonId = (req) => {
  return req.user?.salonId || null;
};

const validateSalonAccess = (req, res) => {
  const salonId = getSalonId(req);

  if (
    !salonId ||
    !mongoose.Types.ObjectId.isValid(salonId)
  ) {
    res.status(403).json({
      success: false,
      message: "Salon access is required",
    });

    return null;
  }

  return salonId;
};

// ========================================
// GENERATE INVOICE NUMBER
// ========================================

const generateInvoiceNumber = async () => {
  const count = await Bill.countDocuments();

  const number = String(
    count + 1
  ).padStart(5, "0");

  return `SAL-${new Date().getFullYear()}-${number}`;
};

// ========================================
// CREATE BILL
// POST /api/bills
// ========================================

export const createBill = async (
  req,
  res
) => {
  try {
    // ========================================
    // SALON ACCESS
    // ========================================

    const salonId =
      validateSalonAccess(
        req,
        res
      );

    if (!salonId) return;

    const {
      clientId,
      stylistId,
      items,
      discount = 0,
      tax = 0,
      paymentMethod = "Cash",
      paymentStatus = "Paid",
      notes = "",
    } = req.body;

    // ========================================
    // VALIDATION
    // ========================================

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message:
          "Client is required",
      });
    }

    if (!stylistId) {
      return res.status(400).json({
        success: false,
        message:
          "Staff / Stylist is required",
      });
    }

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one service is required",
      });
    }

    // ========================================
    // FIND CLIENT
    // IMPORTANT:
    // SAME SALON ONLY
    // ========================================

    const client =
      await Client.findOne({
        _id: clientId,
        salonId,
      });

    if (!client) {
      return res.status(404).json({
        success: false,
        message:
          "Client not found",
      });
    }

    if (!client.isActive) {
      return res.status(400).json({
        success: false,
        message:
          "Client is inactive",
      });
    }

    // ========================================
    // FIND STYLIST
    // IMPORTANT:
    // SAME SALON ONLY
    // ========================================

    const stylist =
      await Stylist.findOne({
        _id: stylistId,
        salonId,
      });

    if (!stylist) {
      return res.status(404).json({
        success: false,
        message:
          "Staff / Stylist not found",
      });
    }

    if (
      stylist.status !== "ACTIVE"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Selected staff / stylist is inactive",
      });
    }
// ========================================
// STAFF + SERVICE REVENUE REPORT
// GET /api/bills/staff-service-revenue
// ========================================

export const getStaffServiceRevenue = async (req, res) => {
  try {
    const salonId = validateSalonAccess(req, res);
    if (!salonId) return;

    const { period = "month" } = req.query;
    const selectedPeriod = String(period).toLowerCase();

    // India local date boundaries
    const now = new Date();
    const indiaNow = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    let from = null;
    let to = new Date(now);

    if (selectedPeriod !== "overall") {
      const year = indiaNow.getFullYear();
      const month = indiaNow.getMonth();
      const day = indiaNow.getDate();

      if (selectedPeriod === "today") {
        from = new Date(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+05:30`);
      } else if (selectedPeriod === "week") {
        const start = new Date(year, month, day);
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        from = new Date(
          `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}T00:00:00+05:30`
        );
      } else if (selectedPeriod === "month") {
        from = new Date(
          `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00+05:30`
        );
      } else if (selectedPeriod === "year") {
        from = new Date(`${year}-01-01T00:00:00+05:30`);
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid period. Use today, week, month, year or overall.",
        });
      }
    }

    const match = {
      salonId: new mongoose.Types.ObjectId(String(salonId)),
      paymentStatus: { $ne: "Cancelled" },
      ...(from && { billDate: { $gte: from, $lte: to } }),
    };

    const bills = await Bill.find(match)
      .select("stylist stylistName items grandTotal paymentStatus billDate")
      .lean();

    let totalRevenue = 0;
    const staffMap = new Map();
    const serviceMap = new Map();

    for (const bill of bills) {
      const billTotal = Number(bill.grandTotal || 0);
      totalRevenue += billTotal;

      const staffId = String(bill.stylist || "unassigned");
      const staffName = bill.stylistName || "Unknown Staff";

      if (!staffMap.has(staffId)) {
        staffMap.set(staffId, {
          staffId,
          staffName,
          totalRevenue: 0,
          totalBills: 0,
          services: new Map(),
        });
      }

      const staff = staffMap.get(staffId);
      staff.totalRevenue += billTotal;
      staff.totalBills += 1;

      for (const item of bill.items || []) {
        const serviceId = String(item.service || item.serviceName || "unknown");
        const serviceName = item.serviceName || "Unknown Service";
        const quantity = Number(item.quantity || 1);
        const amount = Number(
          item.total ?? Number(item.price || 0) * quantity
        );

        if (!serviceMap.has(serviceId)) {
          serviceMap.set(serviceId, {
            serviceId,
            serviceName,
            quantity: 0,
            billCount: 0,
            revenue: 0,
          });
        }

        const service = serviceMap.get(serviceId);
        service.quantity += quantity;
        service.billCount += 1;
        service.revenue += amount;

        if (!staff.services.has(serviceId)) {
          staff.services.set(serviceId, {
            serviceId,
            serviceName,
            quantity: 0,
            billCount: 0,
            revenue: 0,
          });
        }

        const staffService = staff.services.get(serviceId);
        staffService.quantity += quantity;
        staffService.billCount += 1;
        staffService.revenue += amount;
      }
    }

    const roundMoney = (value) =>
      Math.round((Number(value) + Number.EPSILON) * 100) / 100;

    const services = Array.from(serviceMap.values())
      .map((item) => ({ ...item, revenue: roundMoney(item.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);

    const staff = Array.from(staffMap.values())
      .map((item) => ({
        staffId: item.staffId,
        staffName: item.staffName,
        totalRevenue: roundMoney(item.totalRevenue),
        totalBills: item.totalBills,
        services: Array.from(item.services.values())
          .map((service) => ({
            ...service,
            revenue: roundMoney(service.revenue),
          }))
          .sort((a, b) => b.revenue - a.revenue),
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    return res.status(200).json({
      success: true,
      period: selectedPeriod,
      totalRevenue: roundMoney(totalRevenue),
      totalBills: bills.length,
      totalServicesSold: services.reduce((sum, item) => sum + item.quantity, 0),
      services,
      staff,
    });
  } catch (error) {
    console.error("STAFF SERVICE REVENUE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load staff and service revenue",
      error: error.message,
    });
  }
};
    // ========================================
    // GET SERVICES
    // IMPORTANT:
    // SAME SALON ONLY
    // ========================================

    const serviceIds = items.map(
      (item) => item.serviceId
    );

    const services =
      await Service.find({
        _id: {
          $in: serviceIds,
        },
        salonId,
        isActive: true,
      });

    if (
      services.length !==
      serviceIds.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "One or more services are invalid or inactive",
      });
    }

    // ========================================
    // CREATE BILL ITEMS
    // ========================================

    const billItems = [];

    for (const item of items) {
      const service =
        services.find(
          (serviceItem) =>
            serviceItem._id.toString() ===
            String(item.serviceId)
        );

      if (!service) {
        return res.status(400).json({
          success: false,
          message:
            "Service not found",
        });
      }

      const quantity = Number(
        item.quantity || 1
      );

      if (
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid service quantity",
        });
      }

      const total =
        Number(service.price) *
        quantity;

      billItems.push({
        service: service._id,
        serviceName: service.name,
        price: service.price,
        quantity,
        duration:
          service.duration,
        total,
      });
    }

    // ========================================
    // CALCULATE TOTALS
    // ========================================

    const subtotal =
      billItems.reduce(
        (sum, item) =>
          sum + item.total,
        0
      );

    const numericDiscount =
      Number(discount);

    const numericTax =
      Number(tax);

    if (
      Number.isNaN(
        numericDiscount
      ) ||
      numericDiscount < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid discount",
      });
    }

    if (
      Number.isNaN(numericTax) ||
      numericTax < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid tax",
      });
    }

    if (
      numericDiscount >
      subtotal
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Discount cannot exceed subtotal",
      });
    }

    const grandTotal =
      subtotal -
      numericDiscount +
      numericTax;

    // ========================================
    // PAYMENT VALIDATION
    // ========================================

    const allowedPaymentMethods = [
      "Cash",
      "UPI",
      "Card",
      "Other",
    ];

    const allowedPaymentStatuses = [
      "Paid",
      "Pending",
    ];

    if (
      !allowedPaymentMethods.includes(
        paymentMethod
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment method",
      });
    }

    if (
      !allowedPaymentStatuses.includes(
        paymentStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment status",
      });
    }

    // ========================================
    // INVOICE NUMBER
    // ========================================

    const invoiceNumber =
      await generateInvoiceNumber();

    // ========================================
    // CREATE BILL
    // ========================================

    const bill =
      await Bill.create({
        salonId,

        invoiceNumber,

        // CLIENT
        client: client._id,
        clientName: client.name,
        clientPhone: client.phone,

        // STYLIST / STAFF
        stylist: stylist._id,
        stylistName: stylist.name,

        // SERVICES
        items: billItems,

        // AMOUNTS
        subtotal,
        discount:
          numericDiscount,
        tax: numericTax,
        grandTotal,

        // PAYMENT
        paymentMethod,
        paymentStatus,

        // NOTES
        notes:
          String(notes).trim(),
      });

    // ========================================
    // UPDATE CLIENT VISIT
    // ========================================

    client.lastVisitAt =
      new Date();

    client.totalVisits =
      Number(
        client.totalVisits || 0
      ) + 1;

    client.totalSpent =
      Number(
        client.totalSpent || 0
      ) + grandTotal;

    await client.save();

    // ========================================
    // RESPONSE
    // ========================================

    return res.status(201).json({
      success: true,
      message:
        "Bill created successfully",
      bill,
    });
  } catch (error) {
    console.error(
      "CREATE BILL ERROR:",
      error
    );

    // Duplicate invoice number
    if (
      error?.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Invoice number already exists. Please try again.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to create bill",
      error: error.message,
    });
  }
};

// ========================================
// GET ALL BILLS
// GET /api/bills
// ========================================

export const getBills = async (
  req,
  res
) => {
  try {
    // ========================================
    // SALON ACCESS
    // ========================================

    const salonId =
      validateSalonAccess(
        req,
        res
      );

    if (!salonId) return;

    const {
      search = "",
      page = 1,
      limit = 20,
      paymentStatus = "",
    } = req.query;

    const currentPage =
      Math.max(
        Number(page) || 1,
        1
      );

    const perPage =
      Math.min(
        Math.max(
          Number(limit) || 20,
          1
        ),
        100
      );

    // IMPORTANT:
    // Every bill query starts
    // with salonId.
    const query = {
      salonId,
    };

    // ========================================
    // PAYMENT STATUS FILTER
    // ========================================

    if (
      paymentStatus.trim()
    ) {
      query.paymentStatus =
        paymentStatus.trim();
    }

    // ========================================
    // SEARCH
    // ========================================

    if (search.trim()) {
      const searchText =
        search.trim();

      query.$or = [
        {
          invoiceNumber: {
            $regex:
              searchText,
            $options: "i",
          },
        },

        {
          clientName: {
            $regex:
              searchText,
            $options: "i",
          },
        },

        {
          clientPhone: {
            $regex:
              searchText,
            $options: "i",
          },
        },

        {
          stylistName: {
            $regex:
              searchText,
            $options: "i",
          },
        },
      ];
    }

    // ========================================
    // PAGINATION
    // ========================================

    const skip =
      (currentPage - 1) *
      perPage;

    const [bills, total] =
      await Promise.all([
        Bill.find(query)
          .populate(
            "client",
            "name phone email profileImage address gender"
          )
          .populate(
            "stylist",
            "name phone email specialization experience status"
          )
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(perPage),

        Bill.countDocuments(query),
      ]);

    const totalPages =
      Math.ceil(
        total / perPage
      );

    return res.status(200).json({
      success: true,

      bills,

      pagination: {
        total,
        page: currentPage,
        limit: perPage,
        totalPages,

        hasNextPage:
          currentPage <
          totalPages,

        hasPreviousPage:
          currentPage > 1,
      },
    });
  } catch (error) {
    console.error(
      "GET BILLS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch bills",
    });
  }
};

// ========================================
// GET SINGLE BILL
// GET /api/bills/:id
// ========================================

export const getBillById = async (
  req,
  res
) => {
  try {
    // ========================================
    // SALON ACCESS
    // ========================================

    const salonId =
      validateSalonAccess(
        req,
        res
      );

    if (!salonId) return;

    const { id } =
      req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid bill ID",
      });
    }

    const bill =
      await Bill.findOne({
        _id: id,
        salonId,
      })
        .populate(
          "client",
          "name phone email profileImage address gender"
        )
        .populate(
          "stylist",
          "name phone email specialization experience status"
        );

    if (!bill) {
      return res.status(404).json({
        success: false,
        message:
          "Bill not found",
      });
    }

    return res.status(200).json({
      success: true,
      bill,
    });
  } catch (error) {
    console.error(
      "GET BILL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch bill",
    });
  }
};

// ========================================
// GET BILL BY INVOICE NUMBER
// GET /api/bills/invoice/:invoiceNumber
// ========================================

export const getBillByInvoiceNumber =
  async (req, res) => {
    try {
      // ========================================
      // SALON ACCESS
      // ========================================

      const salonId =
        validateSalonAccess(
          req,
          res
        );

      if (!salonId) return;

      const {
        invoiceNumber,
      } = req.params;

      if (!invoiceNumber) {
        return res.status(400).json({
          success: false,
          message:
            "Invoice number is required",
        });
      }

      const bill =
        await Bill.findOne({
          salonId,
          invoiceNumber:
            invoiceNumber.trim(),
        })
          .populate(
            "client",
            "name phone email profileImage address gender"
          )
          .populate(
            "stylist",
            "name phone email specialization experience status"
          );

      if (!bill) {
        return res.status(404).json({
          success: false,
          message:
            "Invoice not found",
        });
      }

      return res.status(200).json({
        success: true,
        bill,
      });
    } catch (error) {
      console.error(
        "GET BILL BY INVOICE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch invoice",
      });
    }
  };

// ========================================
// UPDATE PAYMENT STATUS
// PATCH /api/bills/:id/payment
// ========================================

export const updatePaymentStatus =
  async (req, res) => {
    try {
      // ========================================
      // SALON ACCESS
      // ========================================

      const salonId =
        validateSalonAccess(
          req,
          res
        );

      if (!salonId) return;

      const { id } =
        req.params;

      const {
        paymentStatus,
        paymentMethod,
      } = req.body;

      // Keep these compatible
      // with Bill model
      const allowedStatuses = [
        "Paid",
        "Pending",
      ];

      const allowedPaymentMethods = [
        "Cash",
        "UPI",
        "Card",
        "Other",
      ];

      if (!paymentStatus) {
        return res.status(400).json({
          success: false,
          message:
            "Payment status is required",
        });
      }

      if (
        !allowedStatuses.includes(
          paymentStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid payment status",
        });
      }

      if (
        paymentMethod !==
          undefined &&
        !allowedPaymentMethods.includes(
          paymentMethod
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid payment method",
        });
      }

      // IMPORTANT:
      // Same salon only
      const bill =
        await Bill.findOne({
          _id: id,
          salonId,
        });

      if (!bill) {
        return res.status(404).json({
          success: false,
          message:
            "Bill not found",
        });
      }

      bill.paymentStatus =
        paymentStatus;

      if (
        paymentMethod !==
        undefined
      ) {
        bill.paymentMethod =
          paymentMethod;
      }

      await bill.save();

      return res.status(200).json({
        success: true,
        message:
          "Payment status updated successfully",
        bill,
      });
    } catch (error) {
      console.error(
        "UPDATE PAYMENT STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update payment status",
        error: error.message,
      });
    }
  };

// ========================================
// INDIA DATE HELPERS
// ========================================

const getIndiaDateParts = (
  date = new Date()
) => {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    );

  const parts =
    formatter.formatToParts(
      date
    );

  const values = {};

  for (const part of parts) {
    if (
      part.type !== "literal"
    ) {
      values[part.type] =
        part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
};

// ========================================
// MAKE INDIA DATE START
// ========================================

const makeIndiaDate = (
  year,
  month,
  day,
  endOfDay = false
) => {
  const hour = endOfDay
    ? "23"
    : "00";

  const minute = endOfDay
    ? "59"
    : "00";

  const second = endOfDay
    ? "59"
    : "00";

  const millisecond =
    endOfDay
      ? "999"
      : "000";

  return new Date(
    `${String(year).padStart(
      4,
      "0"
    )}-${String(month).padStart(
      2,
      "0"
    )}-${String(day).padStart(
      2,
      "0"
    )}T${hour}:${minute}:${second}.${millisecond}+05:30`
  );
};

// ========================================
// PARSE CUSTOM DATE
// YYYY-MM-DD
// ========================================

const parseCustomDate = (
  dateString,
  endOfDay = false
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

  const [
    year,
    month,
    day,
  ] = dateString
    .split("-")
    .map(Number);

  const date =
    makeIndiaDate(
      year,
      month,
      day,
      endOfDay
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

// ========================================
// GET TOTAL REVENUE
//
// GET /api/bills/revenue
//
// Supported:
// ?period=today
// ?period=week
// ?period=month
// ?period=quarter
// ?period=year
// ?period=overall
//
// Custom:
// ?from=2026-10-01&to=2026-10-15
// ========================================

export const getTotalRevenue =
  async (req, res) => {
    try {
      // ========================================
      // SALON ACCESS
      // ========================================

      const salonId =
        validateSalonAccess(
          req,
          res
        );

      if (!salonId) return;

      const {
        period = "overall",
        from,
        to,
      } = req.query;

      const selectedPeriod =
        String(
          period || "overall"
        )
          .trim()
          .toLowerCase();

      // ========================================
      // BASE REVENUE FILTER
      // ========================================

      // IMPORTANT:
      // Revenue is ONLY for current salon.
      const match = {
        salonId:
          new mongoose.Types.ObjectId(
            salonId
          ),

        paymentStatus: {
          $ne: "Cancelled",
        },
      };

      let startDate = null;
      let endDate = null;

      // ========================================
      // CUSTOM DATE RANGE
      // ========================================

      if (from || to) {
        if (!from || !to) {
          return res.status(400).json({
            success: false,
            message:
              "Both from and to dates are required",
          });
        }

        startDate =
          parseCustomDate(
            String(from).trim(),
            false
          );

        endDate =
          parseCustomDate(
            String(to).trim(),
            true
          );

        if (
          !startDate ||
          !endDate
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid date format. Use YYYY-MM-DD",
          });
        }

        if (
          startDate >
          endDate
        ) {
          return res.status(400).json({
            success: false,
            message:
              "From date cannot be greater than To date",
          });
        }
      }

      // ========================================
      // PREDEFINED PERIOD
      // ========================================

      if (!from && !to) {
        const validPeriods = [
          "today",
          "week",
          "month",
          "quarter",
          "year",
          "overall",
        ];

        if (
          !validPeriods.includes(
            selectedPeriod
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid period. Use today, week, month, quarter, year or overall.",
          });
        }

        // ======================================
        // OVERALL
        // ======================================

        if (
          selectedPeriod ===
          "overall"
        ) {
          // No billDate filter.
          // All non-cancelled bills
          // for this salon are included.
        } else {
          const today =
            getIndiaDateParts();

          // ====================================
          // TODAY
          // ====================================

          if (
            selectedPeriod ===
            "today"
          ) {
            startDate =
              makeIndiaDate(
                today.year,
                today.month,
                today.day,
                false
              );

            endDate =
              makeIndiaDate(
                today.year,
                today.month,
                today.day,
                true
              );
          }

          // ====================================
          // LAST 7 DAYS
          // Today + previous 6 days
          // ====================================

          if (
            selectedPeriod ===
            "week"
          ) {
            const start =
              new Date(
                Date.UTC(
                  today.year,
                  today.month - 1,
                  today.day
                )
              );

            start.setUTCDate(
              start.getUTCDate() -
                6
            );

            startDate =
              makeIndiaDate(
                start.getUTCFullYear(),
                start.getUTCMonth() + 1,
                start.getUTCDate(),
                false
              );

            endDate =
              makeIndiaDate(
                today.year,
                today.month,
                today.day,
                true
              );
          }

          // ====================================
          // THIS MONTH
          // ====================================

          if (
            selectedPeriod ===
            "month"
          ) {
            startDate =
              makeIndiaDate(
                today.year,
                today.month,
                1,
                false
              );

            endDate =
              makeIndiaDate(
                today.year,
                today.month,
                today.day,
                true
              );
          }

          // ====================================
          // LAST 3 MONTHS
          // Current month + previous 2 months
          // ====================================

          if (
            selectedPeriod ===
            "quarter"
          ) {
            const start =
              new Date(
                Date.UTC(
                  today.year,
                  today.month - 1,
                  1
                )
              );

            start.setUTCMonth(
              start.getUTCMonth() -
                2
            );

            startDate =
              makeIndiaDate(
                start.getUTCFullYear(),
                start.getUTCMonth() + 1,
                1,
                false
              );

            endDate =
              makeIndiaDate(
                today.year,
                today.month,
                today.day,
                true
              );
          }

          // ====================================
          // THIS YEAR
          // ====================================

          if (
            selectedPeriod ===
            "year"
          ) {
            startDate =
              makeIndiaDate(
                today.year,
                1,
                1,
                false
              );

            endDate =
              makeIndiaDate(
                today.year,
                today.month,
                today.day,
                true
              );
          }

          // ====================================
          // APPLY DATE FILTER
          // ====================================

          match.billDate = {
            $gte: startDate,
            $lte: endDate,
          };
        }
      }

      // ========================================
      // CUSTOM DATE FILTER
      // ========================================

      if (
        (from || to) &&
        startDate &&
        endDate
      ) {
        match.billDate = {
          $gte: startDate,
          $lte: endDate,
        };
      }

      // ========================================
      // DATABASE AGGREGATION
      // ========================================

      const result =
        await Bill.aggregate([
          {
            $match: match,
          },

          {
            $group: {
              _id: null,

              totalRevenue: {
                $sum:
                  "$grandTotal",
              },

              totalBills: {
                $sum: 1,
              },
            },
          },
        ]);

      // ========================================
      // TOTAL REVENUE
      // ========================================

      const totalRevenue =
        result.length > 0
          ? Number(
              result[0]
                .totalRevenue || 0
            )
          : 0;

      // ========================================
      // TOTAL BILLS
      // ========================================

      const totalBills =
        result.length > 0
          ? Number(
              result[0]
                .totalBills || 0
            )
          : 0;

      // ========================================
      // RESPONSE
      // ========================================

      return res.status(200).json({
        success: true,

        period:
          from || to
            ? "custom"
            : selectedPeriod,

        totalRevenue,

        totalBills,

        from: startDate,

        to: endDate,
      });
    } catch (error) {
      console.error(
        "GET TOTAL REVENUE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to calculate total revenue",

        totalRevenue: 0,

        totalBills: 0,

        error: error.message,
      });
    }
  };
