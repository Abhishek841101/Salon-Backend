import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    // ==========================================
    // CLIENT
    // ==========================================

    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },

    // ==========================================
    // SERVICE
    // ==========================================

    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },

    // ==========================================
    // STYLIST - OPTIONAL
    // ==========================================

    stylist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stylist",
      default: null,
    },

    // ==========================================
    // BOOKING DATE
    // ==========================================

    bookingDate: {
      type: Date,
      required: true,
    },

    // ==========================================
    // TIME
    // Example: 10:30 AM
    // ==========================================

    startTime: {
      type: String,
      required: true,
      trim: true,
    },

    endTime: {
      type: String,
      default: null,
      trim: true,
    },

    // ==========================================
    // SERVICE DURATION
    // Snapshot from service
    // ==========================================

    duration: {
      type: Number,
      required: true,
      min: 1,
    },

    // ==========================================
    // PRICE SNAPSHOT
    // Important:
    // Future service price changes should not
    // change old booking price.
    // ==========================================

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    // ==========================================
    // STATUS
    // ==========================================

    status: {
      type: String,
      enum: [
        "PENDING",
        "CONFIRMED",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "PENDING",
      index: true,
    },

    // ==========================================
    // NOTES
    // ==========================================

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    // ==========================================
    // COMPLETION
    // ==========================================

    completedAt: {
      type: Date,
      default: null,
    },

    // ==========================================
    // CANCELLATION
    // ==========================================

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancellationReason: {
      type: String,
      trim: true,
      default: "",
    },

    // ==========================================
    // BILL REFERENCE
    //
    // Bill will be generated only after
    // booking becomes COMPLETED.
    // ==========================================

    bill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================
// INDEXES
// ==========================================

bookingSchema.index({
  bookingDate: 1,
  status: 1,
});

bookingSchema.index({
  client: 1,
  bookingDate: -1,
});

bookingSchema.index({
  service: 1,
  bookingDate: -1,
});

bookingSchema.index({
  stylist: 1,
  bookingDate: 1,
});

const Booking = mongoose.model(
  "Booking",
  bookingSchema
);

export default Booking;