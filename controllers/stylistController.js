import mongoose from "mongoose";
import Stylist from "../models/Stylist.js";
import Booking from "../models/Booking.js";
import Bill from "../models/Bill.js";

// ======================================================
// CREATE STYLIST
// POST /api/stylists
// ======================================================

export const createStylist = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      specialization,
      experience,
      status,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name and phone are required",
      });
    }

    const stylist = await Stylist.create({
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim().toLowerCase() : "",
      specialization: specialization
        ? specialization.trim()
        : "",
      experience: Number(experience) || 0,
      status: status || "ACTIVE",
    });

    return res.status(201).json({
      success: true,
      message: "Stylist created successfully",
      stylist,
    });
  } catch (error) {
    console.error("CREATE STYLIST ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create stylist",
      error: error.message,
    });
  }
};

// ======================================================
// GET ALL STYLISTS
// GET /api/stylists
// ======================================================

export const getStylists = async (req, res) => {
  try {
    const stylists = await Stylist.find()
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: stylists.length,
      stylists,
    });
  } catch (error) {
    console.error("GET STYLISTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch stylists",
      error: error.message,
    });
  }
};

// ======================================================
// GET SINGLE STYLIST
// GET /api/stylists/:id
// ======================================================

export const getStylistById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid stylist ID",
      });
    }

    const stylist = await Stylist.findById(id).lean();

    if (!stylist) {
      return res.status(404).json({
        success: false,
        message: "Stylist not found",
      });
    }

    return res.status(200).json({
      success: true,
      stylist,
    });
  } catch (error) {
    console.error("GET STYLIST BY ID ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch stylist",
      error: error.message,
    });
  }
};

// ======================================================
// GET STYLIST PROFILE + PERFORMANCE
// GET /api/stylists/:id/profile
// ======================================================

export const getStylistProfile = async (req, res) => {
  try {
    const { id } = req.params;

    // --------------------------------------------------
    // Validate ID
    // --------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid stylist ID",
      });
    }

    // --------------------------------------------------
    // Get stylist
    // --------------------------------------------------

    const stylist = await Stylist.findById(id).lean();

    if (!stylist) {
      return res.status(404).json({
        success: false,
        message: "Stylist not found",
      });
    }

    const stylistId = new mongoose.Types.ObjectId(id);

    // ==================================================
    // BOOKING STATISTICS
    // ==================================================

    const bookingStats = await Booking.aggregate([
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
                  $eq: ["$status", "COMPLETED"],
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
                  $eq: ["$status", "CONFIRMED"],
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
                  $eq: ["$status", "CANCELLED"],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const bookingSummary = bookingStats[0] || {
      totalAppointments: 0,
      completedAppointments: 0,
      confirmedAppointments: 0,
      cancelledAppointments: 0,
    };

    // ==================================================
    // UNIQUE CLIENTS FROM BOOKINGS
    // ==================================================

    const bookingClients = await Booking.distinct(
      "client",
      {
        stylist: stylistId,
        client: {
          $ne: null,
        },
      }
    );

    // ==================================================
    // BILL STATISTICS
    // ==================================================

    const billStats = await Bill.aggregate([
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

          totalRevenue: {
            $sum: {
              $cond: [
                {
                  $eq: ["$paymentStatus", "Paid"],
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
                  $eq: ["$paymentStatus", "Pending"],
                },
                "$grandTotal",
                0,
              ],
            },
          },
        },
      },
    ]);

    const billSummary = billStats[0] || {
      totalBills: 0,
      totalRevenue: 0,
      pendingAmount: 0,
    };

    // ==================================================
    // UNIQUE CLIENTS FROM BILLS
    // ==================================================

    const billClients = await Bill.distinct(
      "client",
      {
        stylist: stylistId,
        client: {
          $ne: null,
        },
      }
    );

    // ==================================================
    // MERGE UNIQUE CLIENT IDS
    // ==================================================

    const uniqueClientIds = new Set();

    [...bookingClients, ...billClients].forEach(
      (clientId) => {
        if (clientId) {
          uniqueClientIds.add(clientId.toString());
        }
      }
    );

    const totalClients = uniqueClientIds.size;

    // ==================================================
    // AVERAGE SERVICE VALUE
    // ==================================================

    const totalRevenue = Number(
      billSummary.totalRevenue || 0
    );

    const totalBills = Number(
      billSummary.totalBills || 0
    );

    const averageServiceValue =
      totalBills > 0
        ? Math.round(totalRevenue / totalBills)
        : 0;

    // ==================================================
    // RECENT BOOKINGS
    // ==================================================

    const recentBookings = await Booking.find({
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

    const recentBills = await Bill.find({
      stylist: stylistId,
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

      stylist,

      stats: {
        totalClients,

        totalAppointments:
          bookingSummary.totalAppointments || 0,

        completedServices:
          bookingSummary.completedAppointments || 0,

        confirmedAppointments:
          bookingSummary.confirmedAppointments || 0,

        cancelledAppointments:
          bookingSummary.cancelledAppointments || 0,

        totalBills:
          billSummary.totalBills || 0,

        totalRevenue,

        pendingAmount:
          Number(billSummary.pendingAmount || 0),

        averageServiceValue,
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
      message: "Failed to fetch stylist profile",
      error: error.message,
    });
  }
};

// ======================================================
// UPDATE STYLIST
// PATCH /api/stylists/:id
// ======================================================

export const updateStylist = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid stylist ID",
      });
    }

    const {
      name,
      phone,
      email,
      specialization,
      experience,
      status,
    } = req.body;

    const updateData = {};

    if (name !== undefined) {
      updateData.name = name.trim();
    }

    if (phone !== undefined) {
      updateData.phone = phone.trim();
    }

    if (email !== undefined) {
      updateData.email = email
        ? email.trim().toLowerCase()
        : "";
    }

    if (specialization !== undefined) {
      updateData.specialization = specialization
        ? specialization.trim()
        : "";
    }

    if (experience !== undefined) {
      updateData.experience =
        Number(experience) || 0;
    }

    if (status !== undefined) {
      updateData.status = status;
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
        message: "Stylist not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Stylist updated successfully",
      stylist,
    });
  } catch (error) {
    console.error(
      "UPDATE STYLIST ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update stylist",
      error: error.message,
    });
  }
};

// ======================================================
// DELETE STYLIST
// DELETE /api/stylists/:id
// ======================================================

export const deleteStylist = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid stylist ID",
      });
    }

    const stylist =
      await Stylist.findByIdAndDelete(id);

    if (!stylist) {
      return res.status(404).json({
        success: false,
        message: "Stylist not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Stylist deleted successfully",
      stylist,
    });
  } catch (error) {
    console.error(
      "DELETE STYLIST ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete stylist",
      error: error.message,
    });
  }
};