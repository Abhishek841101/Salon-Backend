import Booking from "../models/Booking.js";
import Client from "../models/Client.js";
import Service from "../models/Service.js";
import Stylist from "../models/Stylist.js";

// ======================================================
// HELPER
// ======================================================

const getDayRange = (dateString) => {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    start,
    end,
  };
};

// ======================================================
// CREATE BOOKING
// POST /api/bookings
// ======================================================

export const createBooking = async (req, res) => {
  try {
    const {
      client,
      service,
      stylist,
      bookingDate,
      startTime,
      endTime,
      notes,
    } = req.body;

    // ==========================================
    // REQUIRED VALIDATION
    // ==========================================

    if (
      !client ||
      !service ||
      !bookingDate ||
      !startTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Client, service, booking date and start time are required",
      });
    }

    // ==========================================
    // CLIENT
    // ==========================================

    const clientData =
      await Client.findById(client);

    if (!clientData) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    if (clientData.isActive === false) {
      return res.status(400).json({
        success: false,
        message: "Selected client is inactive",
      });
    }

    // ==========================================
    // SERVICE
    // ==========================================

    const serviceData =
      await Service.findById(service);

    if (!serviceData) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    if (serviceData.isActive === false) {
      return res.status(400).json({
        success: false,
        message: "Selected service is inactive",
      });
    }

    // ==========================================
    // STYLIST - OPTIONAL
    // ==========================================

    let stylistData = null;

    if (stylist) {
      stylistData =
        await Stylist.findById(stylist);

      if (!stylistData) {
        return res.status(404).json({
          success: false,
          message: "Stylist not found",
        });
      }

      if (stylistData.isActive === false) {
        return res.status(400).json({
          success: false,
          message: "Selected stylist is inactive",
        });
      }
    }

    // ==========================================
    // DATE VALIDATION
    // ==========================================

    const range = getDayRange(bookingDate);

    if (!range) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking date",
      });
    }

    // ==========================================
    // CHECK STYLIST CONFLICT
    //
    // Only check if stylist selected.
    // Cancelled bookings don't block time.
    // ==========================================

    if (stylist) {
      const stylistConflict =
        await Booking.findOne({
          stylist,
          bookingDate: {
            $gte: range.start,
            $lt: range.end,
          },
          startTime,
          status: {
            $in: [
              "PENDING",
              "CONFIRMED",
            ],
          },
        });

      if (stylistConflict) {
        return res.status(409).json({
          success: false,
          message:
            "This stylist already has a booking at this time",
        });
      }
    }

    // ==========================================
    // CREATE BOOKING
    // ==========================================

    const booking =
      await Booking.create({
        client,
        service,
        stylist: stylist || null,
        bookingDate: range.start,
        startTime,
        endTime:
          endTime || null,
        duration:
          serviceData.duration ||
          serviceData.durationMinutes ||
          30,
        price:
          serviceData.price ||
          serviceData.salePrice ||
          0,
        status: "PENDING",
        notes: notes || "",
      });

    // ==========================================
    // POPULATE RESPONSE
    // ==========================================

    const populatedBooking =
      await Booking.findById(
        booking._id
      )
        .populate(
          "client",
          "name phone email profileImage"
        )
        .populate(
          "service",
          "name price duration image"
        )
        .populate(
          "stylist",
          "name phone image"
        );

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking: populatedBooking,
    });
  } catch (error) {
    console.error(
      "CREATE BOOKING ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: error.message,
    });
  }
};

// ======================================================
// GET ALL BOOKINGS
// GET /api/bookings
//
// Query:
// ?date=2026-09-22
// ?status=PENDING
// ?client=id
// ?stylist=id
// ======================================================

export const getBookings = async (
  req,
  res
) => {
  try {
    const {
      date,
      status,
      client,
      stylist,
    } = req.query;

    const filter = {};

    // ==========================================
    // DATE FILTER
    // ==========================================

    if (date) {
      const range = getDayRange(date);

      if (!range) {
        return res.status(400).json({
          success: false,
          message: "Invalid date",
        });
      }

      filter.bookingDate = {
        $gte: range.start,
        $lt: range.end,
      };
    }

    // ==========================================
    // STATUS
    // ==========================================

    if (status) {
      filter.status = status.toUpperCase();
    }

    // ==========================================
    // CLIENT
    // ==========================================

    if (client) {
      filter.client = client;
    }

    // ==========================================
    // STYLIST
    // ==========================================

    if (stylist) {
      filter.stylist = stylist;
    }

    // ==========================================
    // QUERY
    // ==========================================

    const bookings =
      await Booking.find(filter)
        .populate(
          "client",
          "name phone email profileImage"
        )
        .populate(
          "service",
          "name price duration image"
        )
        .populate(
          "stylist",
          "name phone image"
        )
        .populate(
          "bill",
          "invoiceNumber grandTotal paymentStatus"
        )
        .sort({
          bookingDate: 1,
          startTime: 1,
        });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error(
      "GET BOOKINGS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message,
    });
  }
};

// ======================================================
// GET BOOKING BY ID
// GET /api/bookings/:id
// ======================================================

export const getBookingById = async (
  req,
  res
) => {
  try {
    const booking =
      await Booking.findById(req.params.id)
        .populate(
          "client",
          "name phone email gender profileImage address"
        )
        .populate(
          "service",
          "name description price duration image"
        )
        .populate(
          "stylist",
          "name phone image"
        )
        .populate(
          "bill"
        );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error(
      "GET BOOKING ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch booking",
      error: error.message,
    });
  }
};

// ======================================================
// CONFIRM BOOKING
// PATCH /api/bookings/:id/confirm
// ======================================================

export const confirmBooking = async (
  req,
  res
) => {
  try {
    const booking =
      await Booking.findById(
        req.params.id
      );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message:
          "Cancelled booking cannot be confirmed",
      });
    }

    if (booking.status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        message:
          "Completed booking cannot be confirmed",
      });
    }

    booking.status = "CONFIRMED";

    await booking.save();

    const updatedBooking =
      await Booking.findById(
        booking._id
      )
        .populate(
          "client",
          "name phone email profileImage"
        )
        .populate(
          "service",
          "name price duration image"
        )
        .populate(
          "stylist",
          "name phone image"
        );

    return res.status(200).json({
      success: true,
      message:
        "Booking confirmed successfully",
      booking: updatedBooking,
    });
  } catch (error) {
    console.error(
      "CONFIRM BOOKING ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to confirm booking",
      error: error.message,
    });
  }
};

// ======================================================
// COMPLETE BOOKING
// PATCH /api/bookings/:id/complete
//
// IMPORTANT:
// Only COMPLETED booking can move to billing.
// ======================================================

export const completeBooking = async (
  req,
  res
) => {
  try {
    const booking =
      await Booking.findById(
        req.params.id
      );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message:
          "Cancelled booking cannot be completed",
      });
    }

    if (booking.status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        message:
          "Booking is already completed",
      });
    }

    booking.status = "COMPLETED";
    booking.completedAt = new Date();

    await booking.save();

    const updatedBooking =
      await Booking.findById(
        booking._id
      )
        .populate(
          "client",
          "name phone email profileImage"
        )
        .populate(
          "service",
          "name price duration image"
        )
        .populate(
          "stylist",
          "name phone image"
        );

    return res.status(200).json({
      success: true,
      message:
        "Booking marked as completed",
      booking: updatedBooking,
    });
  } catch (error) {
    console.error(
      "COMPLETE BOOKING ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to complete booking",
      error: error.message,
    });
  }
};

// ======================================================
// CANCEL BOOKING
// PATCH /api/bookings/:id/cancel
// ======================================================

export const cancelBooking = async (
  req,
  res
) => {
  try {
    const { reason } = req.body;

    const booking =
      await Booking.findById(
        req.params.id
      );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        message:
          "Completed booking cannot be cancelled",
      });
    }

    if (booking.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message:
          "Booking is already cancelled",
      });
    }

    booking.status = "CANCELLED";
    booking.cancelledAt = new Date();
    booking.cancellationReason =
      reason || "";

    await booking.save();

    return res.status(200).json({
      success: true,
      message:
        "Booking cancelled successfully",
      booking,
    });
  } catch (error) {
    console.error(
      "CANCEL BOOKING ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to cancel booking",
      error: error.message,
    });
  }
};

// ======================================================
// UPDATE BOOKING
// PUT /api/bookings/:id
// ======================================================

export const updateBooking = async (
  req,
  res
) => {
  try {
    const {
      client,
      service,
      stylist,
      bookingDate,
      startTime,
      endTime,
      notes,
    } = req.body;

    const booking =
      await Booking.findById(
        req.params.id
      );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (
      booking.status === "COMPLETED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Completed booking cannot be edited",
      });
    }

    if (
      booking.status === "CANCELLED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Cancelled booking cannot be edited",
      });
    }

    // ==========================================
    // CLIENT
    // ==========================================

    if (client) {
      const clientData =
        await Client.findById(client);

      if (!clientData) {
        return res.status(404).json({
          success: false,
          message: "Client not found",
        });
      }

      booking.client = client;
    }

    // ==========================================
    // SERVICE
    // ==========================================

    if (service) {
      const serviceData =
        await Service.findById(service);

      if (!serviceData) {
        return res.status(404).json({
          success: false,
          message: "Service not found",
        });
      }

      booking.service = service;

      booking.price =
        serviceData.price ||
        serviceData.salePrice ||
        0;

      booking.duration =
        serviceData.duration ||
        serviceData.durationMinutes ||
        30;
    }

    // ==========================================
    // STYLIST
    // ==========================================

    if (stylist !== undefined) {
      if (stylist === null || stylist === "") {
        booking.stylist = null;
      } else {
        const stylistData =
          await Stylist.findById(
            stylist
          );

        if (!stylistData) {
          return res.status(404).json({
            success: false,
            message: "Stylist not found",
          });
        }

        booking.stylist = stylist;
      }
    }

    // ==========================================
    // DATE
    // ==========================================

    if (bookingDate) {
      const range =
        getDayRange(bookingDate);

      if (!range) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking date",
        });
      }

      booking.bookingDate =
        range.start;
    }

    // ==========================================
    // TIME
    // ==========================================

    if (startTime) {
      booking.startTime = startTime;
    }

    if (endTime !== undefined) {
      booking.endTime =
        endTime || null;
    }

    // ==========================================
    // NOTES
    // ==========================================

    if (notes !== undefined) {
      booking.notes = notes;
    }

    await booking.save();

    const updatedBooking =
      await Booking.findById(
        booking._id
      )
        .populate(
          "client",
          "name phone email profileImage"
        )
        .populate(
          "service",
          "name price duration image"
        )
        .populate(
          "stylist",
          "name phone image"
        );

    return res.status(200).json({
      success: true,
      message:
        "Booking updated successfully",
      booking: updatedBooking,
    });
  } catch (error) {
    console.error(
      "UPDATE BOOKING ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update booking",
      error: error.message,
    });
  }
};