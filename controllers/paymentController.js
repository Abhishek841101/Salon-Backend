
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

import Payment from "../models/Payment.js";
import User from "../models/User.js";
import Salon from "../models/Salon.js";
import configuredCloudinary from "../config/cloudinary.js";

// Reuse the existing Cloudinary configuration.
const cloudinaryClient = configuredCloudinary || cloudinary;

const validPlans = ["basic", "professional", "premium"];

const uploadScreenshot = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinaryClient.uploader.upload_stream(
      {
        folder: "glow-salon/payment-proofs",
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });

const getSalonId = (user) => user?.salonId?._id || user?.salonId;

// Super Admin creates or updates a salon's negotiated offer.
export const createPaymentOffer = async (req, res) => {
  try {
    const { salonId } = req.params;
    const { plan, amount, durationDays } = req.body;

    if (!mongoose.Types.ObjectId.isValid(salonId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salon ID.",
      });
    }

    if (!validPlans.includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Select a valid subscription plan.",
      });
    }

    const parsedAmount = Number(amount);
    const parsedDays = Number(durationDays);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than zero.",
      });
    }

    if (
      !Number.isInteger(parsedDays) ||
      parsedDays < 1 ||
      parsedDays > 3660
    ) {
      return res.status(400).json({
        success: false,
        message: "Duration must be between 1 and 3660 days.",
      });
    }

    const salon = await Salon.findById(salonId);

    if (!salon) {
      return res.status(404).json({
        success: false,
        message: "Salon not found.",
      });
    }

    const admin = await User.findOne({
      salonId: salon._id,
      role: { $in: ["admin", "owner"] },
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Salon admin not found.",
      });
    }

    // Never change an offer while its payment is under review.
    const pendingPayment = await Payment.findOne({
      salonId: salon._id,
      status: "pending",
    });

    if (pendingPayment) {
      return res.status(409).json({
        success: false,
        message:
          "A payment is already pending review. Review it before creating another offer.",
      });
    }

    let offer = await Payment.findOne({
      salonId: salon._id,
      userId: admin._id,
      status: "offered",
    }).sort({ createdAt: -1 });

    if (offer) {
      offer.plan = plan;
      offer.amount = parsedAmount;
      offer.durationDays = parsedDays;
      offer.rejectionReason = "";
      await offer.save();
    } else {
      offer = await Payment.create({
        salonId: salon._id,
        userId: admin._id,
        plan,
        amount: parsedAmount,
        durationDays: parsedDays,
        status: "offered",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Subscription offer saved.",
      data: offer,
    });
  } catch (error) {
    console.error("createPaymentOffer:", error);
    return res.status(500).json({
      success: false,
      message: "Could not create subscription offer.",
    });
  }
};

// Salon Admin fetches their own current offer.
export const getMyPaymentOffer = async (req, res) => {
  try {
    const salonId = getSalonId(req.user);

    if (!salonId) {
      return res.status(400).json({
        success: false,
        message: "Your account is not linked to a salon.",
      });
    }

    const payment = await Payment.findOne({
      salonId,
      userId: req.user._id,
      status: { $in: ["offered", "pending", "rejected"] },
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("getMyPaymentOffer:", error);
    return res.status(500).json({
      success: false,
      message: "Could not fetch your payment offer.",
    });
  }
};

// Salon Admin submits the UPI transaction ID and screenshot.
export const submitPaymentProof = async (req, res) => {
  let uploadedPublicId = null;

  try {
    const { paymentId } = req.params;
    const { transactionId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment offer ID.",
      });
    }

    if (!["admin", "owner"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only salon admins can submit payment.",
      });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "Please upload your payment screenshot.",
      });
    }

    const cleanTransactionId = String(transactionId || "").trim();

    if (
      cleanTransactionId.length < 4 ||
      cleanTransactionId.length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid UPI transaction ID.",
      });
    }

    const payment = await Payment.findOne({
      _id: paymentId,
      userId: req.user._id,
      salonId: getSalonId(req.user),
      status: { $in: ["offered", "rejected"] },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message:
          "Payment offer not found, or it is already being reviewed.",
      });
    }

    const duplicate = await Payment.findOne({
      transactionId: cleanTransactionId,
      _id: { $ne: payment._id },
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "This transaction ID has already been submitted.",
      });
    }

    const uploadResult = await uploadScreenshot(req.file.buffer);
    uploadedPublicId = uploadResult.public_id;

    payment.transactionId = cleanTransactionId;
    payment.screenshotUrl = uploadResult.secure_url;
    payment.screenshotPublicId = uploadResult.public_id;
    payment.status = "pending";
    payment.rejectionReason = "";
    payment.reviewedBy = null;
    payment.reviewedAt = null;

    await payment.save();

    return res.status(200).json({
      success: true,
      message:
        "Payment proof submitted. Your subscription will activate after Super Admin verification.",
      data: payment,
    });
  } catch (error) {
    // Clean up the uploaded image if the database save failed.
    if (uploadedPublicId) {
      try {
        await cloudinaryClient.uploader.destroy(uploadedPublicId);
      } catch (cleanupError) {
        console.error("Screenshot cleanup failed:", cleanupError);
      }
    }

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This transaction ID has already been submitted.",
      });
    }

    console.error("submitPaymentProof:", error);
    return res.status(500).json({
      success: false,
      message: "Could not submit payment proof.",
    });
  }
};

// Super Admin views submitted payment proofs.
export const getAllPayments = async (req, res) => {
  try {
    const allowedStatuses = ["offered", "pending", "approved", "rejected"];
    const status = req.query.status;

    const filter = {};

    if (status) {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment status filter.",
        });
      }

      filter.status = status;
    }

    const payments = await Payment.find(filter)
      .populate("userId", "name email phone role")
      .populate("salonId")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    console.error("getAllPayments:", error);
    return res.status(500).json({
      success: false,
      message: "Could not fetch payments.",
    });
  }
};

// IMPORTANT: Super Admin must verify actual bank/UPI credit before calling this.

export const approvePayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID.",
      });
    }

    const payment = await Payment.findOne({
      _id: paymentId,
      status: "pending",
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Pending payment not found or already reviewed.",
      });
    }

    // Always verify the actual bank/UPI credit before calling this API.
    const admin = await User.findOne({
      _id: payment.userId,
      salonId: payment.salonId,
      role: { $in: ["admin", "owner"] },
    });

    const salon = await Salon.findById(payment.salonId);

    if (!admin || !salon) {
      return res.status(404).json({
        success: false,
        message: "Salon or salon admin not found.",
      });
    }

    const now = new Date();
    const currentEnd = admin.subscription?.endDate
      ? new Date(admin.subscription.endDate)
      : null;

    const startDate =
      currentEnd && currentEnd > now ? currentEnd : now;

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + payment.durationDays);

    admin.subscription = {
      ...(admin.subscription?.toObject?.() || admin.subscription || {}),
      status: "active",
      plan: payment.plan,
      startDate,
      endDate,
      amount: payment.amount,
    };

    admin.isActive = true;
    salon.isActive = true;

    await admin.save();
    await salon.save();

    // Only mark approved after activation saves succeed.
    const approvedPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, status: "pending" },
      {
        $set: {
          status: "approved",
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!approvedPayment) {
      return res.status(409).json({
        success: false,
        message:
          "Payment was reviewed concurrently. Please verify subscription status.",
      });
    }

    return res.json({
      success: true,
      message: "Payment approved and subscription activated.",
      data: {
        paymentId: approvedPayment._id,
        plan: payment.plan,
        amount: payment.amount,
        startDate,
        endDate,
      },
    });
  } catch (error) {
    console.error("approvePayment:", error);

    return res.status(500).json({
      success: false,
      message: "Could not approve payment. Check backend logs.",
    });
  }
};

// Super Admin rejects a submitted payment.
export const rejectPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const reason = String(req.body?.reason || "").trim();

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID.",
      });
    }

    const payment = await Payment.findOneAndUpdate(
      { _id: paymentId, status: "pending" },
      {
        $set: {
          status: "rejected",
          rejectionReason: reason || "Payment could not be verified.",
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Pending payment not found or already reviewed.",
      });
    }

    return res.json({
      success: true,
      message: "Payment rejected.",
      data: payment,
    });
  } catch (error) {
    console.error("rejectPayment:", error);
    return res.status(500).json({
      success: false,
      message: "Could not reject payment.",
    });
  }
};
