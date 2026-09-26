// import Bill from "../models/Bill.js";
// import Client from "../models/Client.js";
// import Service from "../models/Service.js";

// // ========================================
// // GENERATE INVOICE NUMBER
// // ========================================

// const generateInvoiceNumber = async () => {
//   const count = await Bill.countDocuments();

//   const number = String(count + 1).padStart(5, "0");

//   return `SAL-${new Date().getFullYear()}-${number}`;
// };

// // ========================================
// // CREATE BILL
// // ========================================

// export const createBill = async (req, res) => {
//   try {
//     const {
//       clientId,
//       items,
//       discount = 0,
//       tax = 0,
//       paymentMethod = "Cash",
//       paymentStatus = "Paid",
//       notes = "",
//     } = req.body;

//     // ========================================
//     // VALIDATION
//     // ========================================

//     if (!clientId) {
//       return res.status(400).json({
//         success: false,
//         message: "Client is required",
//       });
//     }

//     if (!Array.isArray(items) || items.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "At least one service is required",
//       });
//     }

//     // ========================================
//     // FIND CLIENT
//     // ========================================

//     const client = await Client.findById(clientId);

//     if (!client) {
//       return res.status(404).json({
//         success: false,
//         message: "Client not found",
//       });
//     }

//     if (!client.isActive) {
//       return res.status(400).json({
//         success: false,
//         message: "Client is inactive",
//       });
//     }

//     // ========================================
//     // GET SERVICES
//     // ========================================

//     const serviceIds = items.map(
//       (item) => item.serviceId
//     );

//     const services = await Service.find({
//       _id: { $in: serviceIds },
//       isActive: true,
//     });

//     if (services.length !== serviceIds.length) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "One or more services are invalid or inactive",
//       });
//     }

//     // ========================================
//     // CREATE BILL ITEMS
//     // ========================================

//     const billItems = [];

//     for (const item of items) {
//       const service = services.find(
//         (service) =>
//           service._id.toString() ===
//           String(item.serviceId)
//       );

//       if (!service) {
//         return res.status(400).json({
//           success: false,
//           message: "Service not found",
//         });
//       }

//       const quantity = Number(
//         item.quantity || 1
//       );

//       if (
//         !Number.isInteger(quantity) ||
//         quantity < 1
//       ) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid service quantity",
//         });
//       }

//       const total =
//         Number(service.price) * quantity;

//       billItems.push({
//         service: service._id,
//         serviceName: service.name,
//         price: service.price,
//         quantity,
//         duration: service.duration,
//         total,
//       });
//     }

//     // ========================================
//     // CALCULATE TOTALS
//     // ========================================

//     const subtotal = billItems.reduce(
//       (sum, item) => sum + item.total,
//       0
//     );

//     const numericDiscount = Number(discount);
//     const numericTax = Number(tax);

//     if (
//       Number.isNaN(numericDiscount) ||
//       numericDiscount < 0
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid discount",
//       });
//     }

//     if (
//       Number.isNaN(numericTax) ||
//       numericTax < 0
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid tax",
//       });
//     }

//     if (numericDiscount > subtotal) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Discount cannot exceed subtotal",
//       });
//     }

//     const grandTotal =
//       subtotal -
//       numericDiscount +
//       numericTax;

//     // ========================================
//     // PAYMENT VALIDATION
//     // ========================================

//     const allowedPaymentMethods = [
//       "Cash",
//       "UPI",
//       "Card",
//       "Other",
//     ];

//     const allowedPaymentStatuses = [
//       "Paid",
//       "Pending",
//       "Partial",
//     ];

//     if (
//       !allowedPaymentMethods.includes(
//         paymentMethod
//       )
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid payment method",
//       });
//     }

//     if (
//       !allowedPaymentStatuses.includes(
//         paymentStatus
//       )
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid payment status",
//       });
//     }

//     // ========================================
//     // INVOICE NUMBER
//     // ========================================

//     const invoiceNumber =
//       await generateInvoiceNumber();

//     // ========================================
//     // CREATE BILL
//     // ========================================

//     const bill = await Bill.create({
//       invoiceNumber,

//       client: client._id,
//       clientName: client.name,
//       clientPhone: client.phone,

//       items: billItems,

//       subtotal,
//       discount: numericDiscount,
//       tax: numericTax,
//       grandTotal,

//       paymentMethod,
//       paymentStatus,

//       notes: String(notes).trim(),
//     });

//     // ========================================
//     // UPDATE CLIENT VISIT
//     // ========================================

//     client.lastVisitAt = new Date();

//     client.totalVisits =
//       Number(client.totalVisits || 0) + 1;

//     client.totalSpent =
//       Number(client.totalSpent || 0) +
//       grandTotal;

//     await client.save();

//     // ========================================
//     // RESPONSE
//     // ========================================

//     return res.status(201).json({
//       success: true,
//       message: "Bill created successfully",
//       bill,
//     });
//   } catch (error) {
//     console.error(
//       "CREATE BILL ERROR:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message: "Failed to create bill",
//       error: error.message,
//     });
//   }
// };

// // ========================================
// // GET ALL BILLS
// // ========================================

// export const getBills = async (req, res) => {
//   try {
//     const {
//       search = "",
//       page = 1,
//       limit = 20,
//       paymentStatus = "",
//     } = req.query;

//     const currentPage = Math.max(
//       Number(page) || 1,
//       1
//     );

//     const perPage = Math.min(
//       Math.max(
//         Number(limit) || 20,
//         1
//       ),
//       100
//     );

//     const query = {};

//     // ========================================
//     // PAYMENT STATUS FILTER
//     // ========================================

//     if (paymentStatus.trim()) {
//       query.paymentStatus =
//         paymentStatus.trim();
//     }

//     // ========================================
//     // SEARCH
//     // ========================================

//     if (search.trim()) {
//       const searchText = search.trim();

//       query.$or = [
//         {
//           invoiceNumber: {
//             $regex: searchText,
//             $options: "i",
//           },
//         },
//         {
//           clientName: {
//             $regex: searchText,
//             $options: "i",
//           },
//         },
//         {
//           clientPhone: {
//             $regex: searchText,
//             $options: "i",
//           },
//         },
//       ];
//     }

//     // ========================================
//     // PAGINATION
//     // ========================================

//     const skip =
//       (currentPage - 1) * perPage;

//     const [bills, total] =
//       await Promise.all([
//         Bill.find(query)
//           .populate(
//             "client",
//             "name phone email profileImage address gender"
//           )
//           .sort({
//             createdAt: -1,
//           })
//           .skip(skip)
//           .limit(perPage),

//         Bill.countDocuments(query),
//       ]);

//     const totalPages = Math.ceil(
//       total / perPage
//     );

//     return res.status(200).json({
//       success: true,
//       bills,

//       pagination: {
//         total,
//         page: currentPage,
//         limit: perPage,
//         totalPages,

//         hasNextPage:
//           currentPage < totalPages,

//         hasPreviousPage:
//           currentPage > 1,
//       },
//     });
//   } catch (error) {
//     console.error(
//       "GET BILLS ERROR:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch bills",
//     });
//   }
// };

// // ========================================
// // GET SINGLE BILL
// // ========================================

// export const getBillById = async (
//   req,
//   res
// ) => {
//   try {
//     const { id } = req.params;

//     const bill =
//       await Bill.findById(id).populate(
//         "client",
//         "name phone email profileImage address gender"
//       );

//     if (!bill) {
//       return res.status(404).json({
//         success: false,
//         message: "Bill not found",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       bill,
//     });
//   } catch (error) {
//     console.error(
//       "GET BILL ERROR:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch bill",
//     });
//   }
// };

// // ========================================
// // GET BILL BY INVOICE NUMBER
// // ========================================

// export const getBillByInvoiceNumber =
//   async (req, res) => {
//     try {
//       const { invoiceNumber } =
//         req.params;

//       if (!invoiceNumber) {
//         return res.status(400).json({
//           success: false,
//           message:
//             "Invoice number is required",
//         });
//       }

//       const bill =
//         await Bill.findOne({
//           invoiceNumber:
//             invoiceNumber.trim(),
//         }).populate(
//           "client",
//           "name phone email profileImage address gender"
//         );

//       if (!bill) {
//         return res.status(404).json({
//           success: false,
//           message: "Invoice not found",
//         });
//       }

//       return res.status(200).json({
//         success: true,
//         bill,
//       });
//     } catch (error) {
//       console.error(
//         "GET BILL BY INVOICE ERROR:",
//         error
//       );

//       return res.status(500).json({
//         success: false,
//         message:
//           "Failed to fetch invoice",
//       });
//     }
//   };

// // ========================================
// // UPDATE PAYMENT STATUS
// // ========================================

// export const updatePaymentStatus = async (
//   req,
//   res
// ) => {
//   try {
//     const { id } = req.params;

//     const {
//       paymentStatus,
//       paymentMethod,
//     } = req.body;

//     const allowedStatuses = [
//       "Paid",
//       "Pending",
//       "Partial",
//       "Cancelled",
//     ];

//     const allowedPaymentMethods = [
//       "Cash",
//       "UPI",
//       "Card",
//       "Other",
//     ];

//     if (!paymentStatus) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Payment status is required",
//       });
//     }

//     if (
//       !allowedStatuses.includes(
//         paymentStatus
//       )
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Invalid payment status",
//       });
//     }

//     if (
//       paymentMethod !== undefined &&
//       !allowedPaymentMethods.includes(
//         paymentMethod
//       )
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Invalid payment method",
//       });
//     }

//     const bill =
//       await Bill.findById(id);

//     if (!bill) {
//       return res.status(404).json({
//         success: false,
//         message: "Bill not found",
//       });
//     }

//     bill.paymentStatus =
//       paymentStatus;

//     if (paymentMethod !== undefined) {
//       bill.paymentMethod =
//         paymentMethod;
//     }

//     await bill.save();

//     return res.status(200).json({
//       success: true,
//       message:
//         "Payment status updated successfully",
//       bill,
//     });
//   } catch (error) {
//     console.error(
//       "UPDATE PAYMENT STATUS ERROR:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message:
//         "Failed to update payment status",
//     });
//   }
// };

// // ========================================
// // GENERATE PROFESSIONAL INVOICE PDF
// // ========================================






























import Bill from "../models/Bill.js";
import Client from "../models/Client.js";
import Service from "../models/Service.js";
import Stylist from "../models/Stylist.js";

// ========================================
// GENERATE INVOICE NUMBER
// ========================================

const generateInvoiceNumber = async () => {
  const count = await Bill.countDocuments();

  const number = String(count + 1).padStart(5, "0");

  return `SAL-${new Date().getFullYear()}-${number}`;
};

// ========================================
// CREATE BILL
// POST /api/bills
// ========================================

export const createBill = async (req, res) => {
  try {
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
        message: "Client is required",
      });
    }

    // STAFF / STYLIST REQUIRED
    if (!stylistId) {
      return res.status(400).json({
        success: false,
        message: "Staff / Stylist is required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one service is required",
      });
    }

    // ========================================
    // FIND CLIENT
    // ========================================

    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    if (!client.isActive) {
      return res.status(400).json({
        success: false,
        message: "Client is inactive",
      });
    }

    // ========================================
    // FIND STYLIST
    // ========================================

    const stylist = await Stylist.findById(stylistId);

    if (!stylist) {
      return res.status(404).json({
        success: false,
        message: "Staff / Stylist not found",
      });
    }

    // Only ACTIVE stylist can be selected
    if (stylist.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Selected staff / stylist is inactive",
      });
    }

    // ========================================
    // GET SERVICES
    // ========================================

    const serviceIds = items.map(
      (item) => item.serviceId
    );

    const services = await Service.find({
      _id: { $in: serviceIds },
      isActive: true,
    });

    if (services.length !== serviceIds.length) {
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
      const service = services.find(
        (service) =>
          service._id.toString() ===
          String(item.serviceId)
      );

      if (!service) {
        return res.status(400).json({
          success: false,
          message: "Service not found",
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
          message: "Invalid service quantity",
        });
      }

      const total =
        Number(service.price) * quantity;

      billItems.push({
        service: service._id,
        serviceName: service.name,
        price: service.price,
        quantity,
        duration: service.duration,
        total,
      });
    }

    // ========================================
    // CALCULATE TOTALS
    // ========================================

    const subtotal = billItems.reduce(
      (sum, item) => sum + item.total,
      0
    );

    const numericDiscount = Number(discount);
    const numericTax = Number(tax);

    if (
      Number.isNaN(numericDiscount) ||
      numericDiscount < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid discount",
      });
    }

    if (
      Number.isNaN(numericTax) ||
      numericTax < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid tax",
      });
    }

    if (numericDiscount > subtotal) {
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
      "Partial",
    ];

    if (
      !allowedPaymentMethods.includes(
        paymentMethod
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    if (
      !allowedPaymentStatuses.includes(
        paymentStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status",
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

    const bill = await Bill.create({
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
      discount: numericDiscount,
      tax: numericTax,
      grandTotal,

      // PAYMENT
      paymentMethod,
      paymentStatus,

      // NOTES
      notes: String(notes).trim(),
    });

    // ========================================
    // UPDATE CLIENT VISIT
    // ========================================

    client.lastVisitAt = new Date();

    client.totalVisits =
      Number(client.totalVisits || 0) + 1;

    client.totalSpent =
      Number(client.totalSpent || 0) +
      grandTotal;

    await client.save();

    // ========================================
    // RESPONSE
    // ========================================

    return res.status(201).json({
      success: true,
      message: "Bill created successfully",
      bill,
    });
  } catch (error) {
    console.error(
      "CREATE BILL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create bill",
      error: error.message,
    });
  }
};

// ========================================
// GET ALL BILLS
// GET /api/bills
// ========================================

export const getBills = async (req, res) => {
  try {
    const {
      search = "",
      page = 1,
      limit = 20,
      paymentStatus = "",
    } = req.query;

    const currentPage = Math.max(
      Number(page) || 1,
      1
    );

    const perPage = Math.min(
      Math.max(
        Number(limit) || 20,
        1
      ),
      100
    );

    const query = {};

    // ========================================
    // PAYMENT STATUS FILTER
    // ========================================

    if (paymentStatus.trim()) {
      query.paymentStatus =
        paymentStatus.trim();
    }

    // ========================================
    // SEARCH
    // ========================================

    if (search.trim()) {
      const searchText = search.trim();

      query.$or = [
        {
          invoiceNumber: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          clientName: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          clientPhone: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          stylistName: {
            $regex: searchText,
            $options: "i",
          },
        },
      ];
    }

    // ========================================
    // PAGINATION
    // ========================================

    const skip =
      (currentPage - 1) * perPage;

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

    const totalPages = Math.ceil(
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
          currentPage < totalPages,

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
      message: "Failed to fetch bills",
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
    const { id } = req.params;

    const bill =
      await Bill.findById(id)
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
        message: "Bill not found",
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
      message: "Failed to fetch bill",
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
      const { invoiceNumber } =
        req.params;

      if (!invoiceNumber) {
        return res.status(400).json({
          success: false,
          message:
            "Invoice number is required",
        });
      }

      const bill =
        await Bill.findOne({
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
          message: "Invoice not found",
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

export const updatePaymentStatus = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const {
      paymentStatus,
      paymentMethod,
    } = req.body;

    const allowedStatuses = [
      "Paid",
      "Pending",
      "Partial",
      "Cancelled",
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
      paymentMethod !== undefined &&
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

    const bill =
      await Bill.findById(id);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    bill.paymentStatus =
      paymentStatus;

    if (paymentMethod !== undefined) {
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
    });
  }
};

// ========================================
// GET TOTAL REVENUE
// GET /api/bills/revenue
// ========================================

export const getTotalRevenue = async (req, res) => {
  try {
    const result = await Bill.aggregate([
      {
        $match: {
          paymentStatus: {
            $ne: "Cancelled",
          },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: "$grandTotal",
          },
          totalBills: {
            $sum: 1,
          },
        },
      },
    ]);

    const totalRevenue =
      result.length > 0
        ? Number(result[0].totalRevenue || 0)
        : 0;

    const totalBills =
      result.length > 0
        ? Number(result[0].totalBills || 0)
        : 0;

    return res.status(200).json({
      success: true,
      totalRevenue,
      totalBills,
    });
  } catch (error) {
    console.error(
      "GET TOTAL REVENUE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to calculate total revenue",
      totalRevenue: 0,
      totalBills: 0,
    });
  }
};