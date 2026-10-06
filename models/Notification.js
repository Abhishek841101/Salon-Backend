
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    // ========================================
    // TENANT
    // ========================================
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: [true, "Salon ID is required"],
      index: true,
    },

    // ========================================
    // TYPE
    // ========================================
    type: {
      type: String,
      enum: ["birthday", "anniversary"],
      required: true,
      index: true,
    },

    // ========================================
    // CLIENT
    // ========================================
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },

    // ========================================
    // CONTENT
    // ========================================
    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    // ========================================
    // EVENT
    // ========================================
    eventDate: {
      type: Date,
      required: true,
      index: true,
    },

    daysBefore: {
      type: Number,
      default: 3,
    },

    // ========================================
    // READ STATUS
    // ========================================
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ========================================
// TENANT-SCOPED INDEXES
// ========================================

// Same salon + client + event + date
// cannot create duplicate notification.
notificationSchema.index(
  {
    salonId: 1,
    type: 1,
    client: 1,
    eventDate: 1,
  },
  {
    unique: true,
  }
);

notificationSchema.index({
  salonId: 1,
  isRead: 1,
  createdAt: -1,
});

notificationSchema.index({
  salonId: 1,
  eventDate: 1,
});

const Notification =
  mongoose.models.Notification ||
  mongoose.model(
    "Notification",
    notificationSchema
  );

export default Notification;
