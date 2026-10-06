
import mongoose from "mongoose";

import Booking from "../models/Booking.js";
import Client from "../models/Client.js";
import Service from "../models/Service.js";
import Stylist from "../models/Stylist.js";

// ======================================================
// HELPERS
// ======================================================

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

const getDayRange = (dateString) => {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const start = new Date(date);

  start.setHours(
    0,
    0,
    0,
    0
  );

  const end = new Date(start);

  end.setDate(
    end.getDate() + 1
  );

  return {
    start,
    end,
  };
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// ======================================================
// CREATE BOOKING
//
// POST /api/bookings
// ======================================================

export const createBooking = async (
  req,
  res
) => {
  try {
    // ==================================================
    // SALON ACCESS
    // ==================================================

    const salonId =
      validateSalonAccess(
        req,
        res
      );

    if (!salonId) return;

    const {
      client,
      service,
      stylist,
      bookingDate,
      startTime,
      endTime,
      notes,
    } = req.body;

    // ==================================================
    // REQUIRED
    // ==================================================

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

    // ==================================================
    // CLIENT
    // IMPORTANT:
    // Client must belong to same salon
    // ==================================================

    const clientData =
      await Client.findOne({
        _id: client,
        salonId,
      });

    if (!clientData) {
      return res.status(404).json({
        success: false,
        message:
          "Client not found",
      });
    }

    if (
      clientData.isActive ===
      false
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Selected client is inactive",
      });
    }

    // ==================================================
    // SERVICE
    // IMPORTANT:
    // Service must belong to same salon
    // ==================================================

    const serviceData =
      await Service.findOne({
        _id: service,
        salonId,
      });

    if (!serviceData) {
      return res.status(404).json({
        success: false,
        message:
          "Service not found",
      });
    }

    if (
      serviceData.isActive ===
      false
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Selected service is inactive",
      });
    }

    // ==================================================
    // STYLIST
    // OPTIONAL
    // IMPORTANT:
    // Stylist must belong to same salon
    // ==================================================

    if (stylist) {
      const stylistData =
        await Stylist.findOne({
          _id: stylist,
          salonId,
        });

      if (!stylistData) {
        return res.status(404).json({
          success: false,
          message:
            "Stylist not found",
        });
      }

      // IMPORTANT:
      // Stylist model uses status,
      // NOT isActive.

      if (
        stylistData.status ===
        "INACTIVE"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Selected stylist is inactive",
        });
      }
    }

    // ==================================================
    // DATE
    // ==================================================

    const range =
      getDayRange(
        bookingDate
      );

    if (!range) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid booking date",
      });
    }

    // ==================================================
    // STYLIST CONFLICT
    // IMPORTANT:
    // salonId included
    // ==================================================

    if (stylist) {
      const stylistConflict =
        await Booking.findOne({
          salonId,
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

    // ==================================================
    // CREATE
    // ==================================================

    const booking =
      await Booking.create({
        salonId,

        client,

        service,

        stylist:
          stylist || null,

        bookingDate:
          range.start,

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

        notes:
          notes || "",
      });

    // ==================================================
    // POPULATE
    // ==================================================

    const populatedBooking =
      await Booking.findOne({
        _id: booking._id,
        salonId,
      })
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
          "name phone email specialization status"
        );

    return res.status(201).json({
      success: true,

      message:
        "Booking created successfully",

      booking:
        populatedBooking,
    });
  } catch (error) {
    console.error(
      "CREATE BOOKING ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create booking",
      error: error.message,
    });
  }
};

// ======================================================
// GET ALL BOOKINGS
//
// GET /api/bookings
// ======================================================

export const getBookings = async (
  req,
  res
) => {
  try {
    // ==================================================
    // SALON ACCESS
    // ==================================================

    const salonId =
      validateSalonAccess(
        req,
        res
      );

    if (!salonId) return;

    const {
      date,
      status,
      client,
      stylist,
    } = req.query;

    // IMPORTANT:
    // Every query starts with salonId.
    const filter = {
      salonId,
    };

    // ==================================================
    // DATE
    // ==================================================

    if (date) {
      const range =
        getDayRange(date);

      if (!range) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid date",
        });
      }

      filter.bookingDate = {
        $gte: range.start,
        $lt: range.end,
      };
    }

    // ==================================================
    // STATUS
    // ==================================================

    if (status) {
      filter.status =
        String(status).toUpperCase();
    }

    // ==================================================
    // CLIENT
    // ==================================================

    if (client) {
      filter.client = client;
    }

    // ==================================================
    // STYLIST
    // ==================================================

    if (stylist) {
      filter.stylist = stylist;
    }

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
          "name phone email specialization status"
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
      count:
        bookings.length,
      bookings,
    });
  } catch (error) {
    console.error(
      "GET BOOKINGS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch bookings",
      error: error.message,
    });
  }
};

// ======================================================
// GET BOOKING BY ID
//
// GET /api/bookings/:id
// ======================================================

export const getBookingById =
  async (req, res) => {
    try {
      // ==================================================
      // SALON ACCESS
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
            "Invalid booking ID",
        });
      }

      // IMPORTANT:
      // Booking must belong to same salon.
      const booking =
        await Booking.findOne({
          _id: id,
          salonId,
        })
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
            "name phone email specialization status"
          )
          .populate("bill");

      if (!booking) {
        return res.status(404).json({
          success: false,
          message:
            "Booking not found",
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
        message:
          "Failed to fetch booking",
        error: error.message,
      });
    }
  };

// ======================================================
// CONFIRM BOOKING
//
// PATCH /api/bookings/:id/confirm
// ======================================================

export const confirmBooking =
  async (req, res) => {
    try {
      // ==================================================
      // SALON ACCESS
      // ==================================================

      const salonId =
        validateSalonAccess(
          req,
          res
        );

      if (!salonId) return;

      const booking =
        await Booking.findOne({
          _id: req.params.id,
          salonId,
        });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message:
            "Booking not found",
        });
      }

      if (
        booking.status ===
        "CANCELLED"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Cancelled booking cannot be confirmed",
        });
      }

      if (
        booking.status ===
        "COMPLETED"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Completed booking cannot be confirmed",
        });
      }

      // ==================================================
      // CHECK STYLIST STILL ACTIVE
      // ==================================================

      if (booking.stylist) {
        const stylist =
          await Stylist.findOne({
            _id: booking.stylist,
            salonId,
          });

        if (
          stylist &&
          stylist.status ===
            "INACTIVE"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Selected stylist is inactive",
          });
        }
      }

      booking.status =
        "CONFIRMED";

      await booking.save();

      const updatedBooking =
        await Booking.findOne({
          _id: booking._id,
          salonId,
        })
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
            "name phone email specialization status"
          );

      return res.status(200).json({
        success: true,
        message:
          "Booking confirmed successfully",
        booking:
          updatedBooking,
      });
    } catch (error) {
      console.error(
        "CONFIRM BOOKING ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to confirm booking",
        error: error.message,
      });
    }
  };

// ======================================================
// COMPLETE BOOKING
//
// PATCH /api/bookings/:id/complete
// ======================================================

export const completeBooking =
  async (req, res) => {
    try {
      // ==================================================
      // SALON ACCESS
      // ==================================================

      const salonId =
        validateSalonAccess(
          req,
          res
        );

      if (!salonId) return;

      const booking =
        await Booking.findOne({
          _id: req.params.id,
          salonId,
        });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message:
            "Booking not found",
        });
      }

      if (
        booking.status ===
        "CANCELLED"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Cancelled booking cannot be completed",
        });
      }

      if (
        booking.status ===
        "COMPLETED"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Booking is already completed",
        });
      }

      booking.status =
        "COMPLETED";

      booking.completedAt =
        new Date();

      await booking.save();

      const updatedBooking =
        await Booking.findOne({
          _id: booking._id,
          salonId,
        })
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
            "name phone email specialization status"
          );

      return res.status(200).json({
        success: true,
        message:
          "Booking marked as completed",
        booking:
          updatedBooking,
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
//
// PATCH /api/bookings/:id/cancel
// ======================================================

export const cancelBooking =
  async (req, res) => {
    try {
      // ==================================================
      // SALON ACCESS
      // ==================================================

      const salonId =
        validateSalonAccess(
          req,
          res
        );

      if (!salonId) return;

      const { reason } =
        req.body;

      const booking =
        await Booking.findOne({
          _id: req.params.id,
          salonId,
        });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message:
            "Booking not found",
        });
      }

      if (
        booking.status ===
        "COMPLETED"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Completed booking cannot be cancelled",
        });
      }

      if (
        booking.status ===
        "CANCELLED"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Booking is already cancelled",
        });
      }

      booking.status =
        "CANCELLED";

      booking.cancelledAt =
        new Date();

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
//
// PUT /api/bookings/:id
// ======================================================

export const updateBooking =
  async (req, res) => {
    try {
      // ==================================================
      // SALON ACCESS
      // ==================================================

      const salonId =
        validateSalonAccess(
          req,
          res
        );

      if (!salonId) return;

      const {
        client,
        service,
        stylist,
        bookingDate,
        startTime,
        endTime,
        notes,
      } = req.body;

      // ==================================================
      // GET BOOKING
      // IMPORTANT:
      // Same salon only
      // ==================================================

      const booking =
        await Booking.findOne({
          _id: req.params.id,
          salonId,
        });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message:
            "Booking not found",
        });
      }

      if (
        booking.status ===
        "COMPLETED"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Completed booking cannot be edited",
        });
      }

      if (
        booking.status ===
        "CANCELLED"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Cancelled booking cannot be edited",
        });
      }

      // ==================================================
      // CLIENT
      // ==================================================

      if (client) {
        const clientData =
          await Client.findOne({
            _id: client,
            salonId,
          });

        if (!clientData) {
          return res.status(404).json({
            success: false,
            message:
              "Client not found",
          });
        }

        if (
          clientData.isActive ===
          false
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Selected client is inactive",
          });
        }

        booking.client =
          client;
      }

      // ==================================================
      // SERVICE
      // ==================================================

      if (service) {
        const serviceData =
          await Service.findOne({
            _id: service,
            salonId,
          });

        if (!serviceData) {
          return res.status(404).json({
            success: false,
            message:
              "Service not found",
          });
        }

        if (
          serviceData.isActive ===
          false
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Selected service is inactive",
          });
        }

        booking.service =
          service;

        booking.price =
          serviceData.price ||
          serviceData.salePrice ||
          0;

        booking.duration =
          serviceData.duration ||
          serviceData.durationMinutes ||
          30;
      }

      // ==================================================
      // STYLIST
      // ==================================================

      if (
        stylist !== undefined
      ) {
        if (
          stylist === null ||
          stylist === ""
        ) {
          booking.stylist =
            null;
        } else {
          const stylistData =
            await Stylist.findOne({
              _id: stylist,
              salonId,
            });

          if (!stylistData) {
            return res.status(404).json({
              success: false,
              message:
                "Stylist not found",
            });
          }

          if (
            stylistData.status ===
            "INACTIVE"
          ) {
            return res.status(400).json({
              success: false,
              message:
                "Selected stylist is inactive",
            });
          }

          booking.stylist =
            stylist;
        }
      }

      // ==================================================
      // DATE
      // ==================================================

      if (bookingDate) {
        const range =
          getDayRange(
            bookingDate
          );

        if (!range) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid booking date",
          });
        }

        booking.bookingDate =
          range.start;
      }

      // ==================================================
      // TIME
      // ==================================================

      if (startTime) {
        booking.startTime =
          startTime;
      }

      if (
        endTime !== undefined
      ) {
        booking.endTime =
          endTime || null;
      }

      // ==================================================
      // NOTES
      // ==================================================

      if (
        notes !== undefined
      ) {
        booking.notes =
          notes;
      }

      await booking.save();

      // ==================================================
      // POPULATE
      // ==================================================

      const updatedBooking =
        await Booking.findOne({
          _id: booking._id,
          salonId,
        })
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
            "name phone email specialization status"
          );

      return res.status(200).json({
        success: true,
        message:
          "Booking updated successfully",
        booking:
          updatedBooking,
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
