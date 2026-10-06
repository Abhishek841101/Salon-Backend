import mongoose from "mongoose";
import Salon from "../models/Salon.js";
import User from "../models/User.js";

// ========================================
// GET SUPER ADMIN DASHBOARD
// ========================================

export const getSuperAdminDashboard = async (req, res) => {
  try {
    const users = await User.find({
      role: "admin",
      salonId: { $ne: null },
    }).select("salonId subscription");

    let totalSalons = 0;
    let activeSalons = 0;
    let trialSalons = 0;
    let expiredSalons = 0;
    let totalRevenue = 0;

    const salonIds = users
      .map((user) => user.salonId)
      .filter(Boolean);

    totalSalons = new Set(
      salonIds.map((id) => id.toString())
    ).size;

    for (const user of users) {
      const subscription = user.subscription;

      if (!subscription) {
        continue;
      }

      // Check trial expiry
      if (
        subscription.status === "trial" &&
        subscription.trialEndDate &&
        new Date() > new Date(subscription.trialEndDate)
      ) {
        expiredSalons++;
        continue;
      }

      if (subscription.status === "trial") {
        trialSalons++;
      }

      if (subscription.status === "active") {
        activeSalons++;

        totalRevenue += Number(
          subscription.amount || 0
        );
      }

      if (subscription.status === "expired") {
        expiredSalons++;
      }
    }

    return res.status(200).json({
      success: true,
      dashboard: {
        totalSalons,
        activeSalons,
        trialSalons,
        expiredSalons,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error(
      "SUPER ADMIN DASHBOARD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard",
    });
  }
};

// ========================================
// GET ALL SALONS
// ========================================

export const getAllSalons = async (req, res) => {
  try {
    const salons = await Salon.find()
      .sort({ createdAt: -1 })
      .lean();

    const salonIds = salons.map((salon) => salon._id);

    const users = await User.find({
      role: "admin",
      salonId: { $in: salonIds },
    })
      .select(
        "name email phone role salonId subscription createdAt"
      )
      .lean();

    const result = salons.map((salon) => {
      const admin = users.find(
        (user) =>
          user.salonId?.toString() ===
          salon._id.toString()
      );

      let subscription = admin?.subscription || {
        status: "expired",
        plan: null,
        amount: 0,
      };

      // Dynamically mark expired trial
      if (
        subscription.status === "trial" &&
        subscription.trialEndDate &&
        new Date() > new Date(subscription.trialEndDate)
      ) {
        subscription = {
          ...subscription,
          status: "expired",
        };
      }

      return {
        id: salon._id,
        name: salon.name,
        ownerName: salon.ownerName,
        email: salon.email,
        phone: salon.phone,
        isActive: salon.isActive,

        admin: admin
          ? {
              id: admin._id,
              name: admin.name,
              email: admin.email,
              phone: admin.phone,
            }
          : null,

        subscription,
        createdAt: salon.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      count: result.length,
      salons: result,
    });
  } catch (error) {
    console.error(
      "GET ALL SALONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load salons",
    });
  }
};

// ========================================
// ACTIVATE / ASSIGN PLAN
// ========================================

export const activateSalonPlan = async (req, res) => {
  try {
    const { salonId } = req.params;

    const {
      plan,
      amount,
      durationDays,
    } = req.body;

    // ----------------------------------------
    // VALIDATION
    // ----------------------------------------

    if (!mongoose.Types.ObjectId.isValid(salonId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salon ID",
      });
    }

    const allowedPlans = [
      "basic",
      "professional",
      "premium",
    ];

    if (!allowedPlans.includes(plan)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid plan. Use basic, professional or premium",
      });
    }

    const numericAmount = Number(amount);

    if (
      Number.isNaN(numericAmount) ||
      numericAmount < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required",
      });
    }

    const days = Number(durationDays);

    if (
      Number.isNaN(days) ||
      days <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "durationDays must be greater than 0",
      });
    }

    // ----------------------------------------
    // FIND SALON
    // ----------------------------------------

    const salon = await Salon.findById(salonId);

    if (!salon) {
      return res.status(404).json({
        success: false,
        message: "Salon not found",
      });
    }

    // ----------------------------------------
    // FIND SALON ADMIN
    // ----------------------------------------

    const admin = await User.findOne({
      salonId: salon._id,
      role: "admin",
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message:
          "Salon admin not found",
      });
    }

    // ----------------------------------------
    // SUBSCRIPTION DATES
    // ----------------------------------------

    const startDate = new Date();

    const endDate = new Date(startDate);

    endDate.setDate(
      endDate.getDate() + days
    );

    // ----------------------------------------
    // ACTIVATE PLAN
    // ----------------------------------------

    admin.subscription = {
      status: "active",
      plan,

      trialStartDate:
        admin.subscription?.trialStartDate || null,

      trialEndDate:
        admin.subscription?.trialEndDate || null,

      startDate,
      endDate,

      amount: numericAmount,
    };

    admin.isActive = true;

    await admin.save();

    salon.isActive = true;

    await salon.save();

    // ----------------------------------------
    // RESPONSE
    // ----------------------------------------

    return res.status(200).json({
      success: true,
      message:
        "Salon plan activated successfully",

      salon: {
        id: salon._id,
        name: salon.name,
      },

      subscription: {
        status: "active",
        plan,
        amount: numericAmount,
        startDate,
        endDate,
        durationDays: days,
      },
    });
  } catch (error) {
    console.error(
      "ACTIVATE SALON PLAN ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to activate salon plan",
    });
  }
};