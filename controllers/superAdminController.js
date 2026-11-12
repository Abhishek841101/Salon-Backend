import mongoose from "mongoose";
import Salon from "../models/Salon.js";
import User from "../models/User.js";



// ========================================
// AUTO EXPIRE SUBSCRIPTIONS
// ========================================


const expireSubscriptions = async () => {
  const now = new Date();

  // Expire paid subscriptions
  await User.updateMany(
    {
      role: "admin",
      "subscription.status": "active",
      "subscription.endDate": { $lte: now },
    },
    {
      $set: {
        "subscription.status": "expired",
      },
    }
  );

  // Expire trial subscriptions
  await User.updateMany(
    {
      role: "admin",
      "subscription.status": "trial",
      "subscription.trialEndDate": { $lte: now },
    },
    {
      $set: {
        "subscription.status": "expired",
      },
    }
  );
};

// ========================================
// GET SUPER ADMIN DASHBOARD
// ========================================



export const getSuperAdminDashboard = async (req, res) => {
  try {
    // Automatically expire subscriptions
    await expireSubscriptions();

    const users = await User.find({
      role: "admin",
      salonId: { $ne: null },
    }).select("salonId subscription");

    let activeSalons = 0;
    let trialSalons = 0;
    let expiredSalons = 0;
    let totalRevenue = 0;

    const salonIds = users
      .map((user) => user.salonId)
      .filter(Boolean);

    const totalSalons = new Set(
      salonIds.map((id) => id.toString())
    ).size;

    for (const user of users) {
      const subscription = user.subscription;

      if (!subscription) {
        expiredSalons++;
        continue;
      }

      if (subscription.status === "trial") {
        trialSalons++;
      } else if (subscription.status === "active") {
        activeSalons++;

        totalRevenue += Number(
          subscription.amount || 0
        );
      } else if (subscription.status === "expired") {
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
    console.error("SUPER ADMIN DASHBOARD ERROR:", error);

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
    // Automatically expire subscriptions
    await expireSubscriptions();

    // Fetch all salons
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

    // Prepare salon response
    const result = salons.map((salon) => {
      const admin = users.find(
        (user) =>
          user.salonId?.toString() ===
          salon._id.toString()
      );

      const subscription = admin?.subscription || {
        status: "expired",
        plan: null,
        amount: 0,
      };

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
    console.error("GET ALL SALONS ERROR:", error);

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
    const { plan, amount, durationDays } = req.body;

    if (!mongoose.Types.ObjectId.isValid(salonId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salon ID",
      });
    }

    const allowedPlans = ["basic", "professional", "premium"];

    if (!allowedPlans.includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan",
      });
    }

    const numericAmount = Number(amount);
    const days = Number(durationDays);

    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required",
      });
    }

    if (!Number.isInteger(days) || days <= 0 || days > 3650) {
      return res.status(400).json({
        success: false,
        message: "Duration must be between 1 and 3650 days",
      });
    }

    const salon = await Salon.findById(salonId);

    if (!salon) {
      return res.status(404).json({
        success: false,
        message: "Salon not found",
      });
    }

    const admin = await User.findOne({
      salonId: salon._id,
      role: "admin",
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Salon admin not found",
      });
    }

    const now = new Date();
    const endDate = new Date(now);

    endDate.setUTCDate(endDate.getUTCDate() + days);

    // Update individual fields.
    // Preserve existing extension histories.
    admin.subscription.status = "active";
    admin.subscription.plan = plan;
    admin.subscription.startDate = now;
    admin.subscription.endDate = endDate;
    admin.subscription.amount = numericAmount;

    // Paid plan replaces temporary free access.
    admin.subscription.temporaryAccessEndDate = null;

    admin.isActive = true;

    await admin.save();

    salon.isActive = true;
    await salon.save();

    return res.status(200).json({
      success: true,
      message: "Salon plan activated successfully",
      salon: {
        id: salon._id,
        name: salon.name,
      },
      subscription: {
        status: "active",
        plan,
        amount: numericAmount,
        startDate: now,
        endDate,
        durationDays: days,
      },
    });

  } catch (error) {
    console.error("ACTIVATE SALON PLAN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to activate salon plan",
    });
  }
};


// ========================================
// EXTEND SALON FREE ACCESS
// ========================================


export const extendSalonTrial = async (req, res) => {
  try {
    const { salonId } = req.params;
    const { durationDays, reason = "" } = req.body;

    // Validate salon ID
    if (!mongoose.Types.ObjectId.isValid(salonId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salon ID",
      });
    }

    // Validate days
    const days = Number(durationDays);

    if (!Number.isInteger(days) || days <= 0 || days > 365) {
      return res.status(400).json({
        success: false,
        message: "Extension must be between 1 and 365 days",
      });
    }

    const superAdminId = req.user?._id;

    if (!superAdminId) {
      return res.status(401).json({
        success: false,
        message: "Super Admin authentication required",
      });
    }

    const salon = await Salon.findById(salonId);

    if (!salon) {
      return res.status(404).json({
        success: false,
        message: "Salon not found",
      });
    }

    const admin = await User.findOne({
      salonId: salon._id,
      role: "admin",
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Salon admin not found",
      });
    }

    const subscription = admin.subscription;

    if (!subscription) {
      return res.status(400).json({
        success: false,
        message: "Subscription not found",
      });
    }

    const now = new Date();

    const reasonText =
      typeof reason === "string"
        ? reason.trim().slice(0, 500)
        : "";

    // Cancelled subscriptions are not eligible
    if (subscription.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cancelled subscription cannot be extended",
      });
    }

    // ----------------------------------------
    // CASE 1: ACTIVE PAID PLAN PROTECTION
    // ----------------------------------------

    if (
      subscription.status === "active" &&
      (
        !subscription.endDate ||
        new Date(subscription.endDate) > now
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Active paid plan cannot receive free extension",
      });
    }

    // ----------------------------------------
    // CASE 2: EXPIRED PAID PLAN
    // ----------------------------------------

    const hasPaidPlan =
      Boolean(subscription.plan && subscription.endDate);

    const isExpiredPaidPlan =
      hasPaidPlan &&
      (
        subscription.status === "expired" ||
        (
          subscription.status === "active" &&
          new Date(subscription.endDate) <= now
        )
      );

    if (isExpiredPaidPlan) {
      const previousEndDate =
        subscription.temporaryAccessEndDate || null;

      let extensionStartDate = now;

      if (
        previousEndDate &&
        new Date(previousEndDate) > now
      ) {
        extensionStartDate = new Date(previousEndDate);
      }

      const newEndDate = new Date(extensionStartDate);

      newEndDate.setUTCDate(
        newEndDate.getUTCDate() + days
      );

      // Keep original paid plan untouched.
      subscription.status = "expired";

      subscription.temporaryAccessEndDate = newEndDate;

      if (!subscription.temporaryAccessHistory) {
        subscription.temporaryAccessHistory = [];
      }

      subscription.temporaryAccessHistory.push({
        days,
        previousEndDate,
        newEndDate,
        extendedBy: superAdminId,
        extendedAt: now,
        reason: reasonText,
      });

      admin.isActive = true;

      await admin.save();

      salon.isActive = true;
      await salon.save();

      return res.status(200).json({
        success: true,
        message: `Temporary free access granted for ${days} days`,

        accessType: "temporary_free",

        salon: {
          id: salon._id,
          name: salon.name,
        },

        subscription: {
          status: subscription.status,
          originalPlan: subscription.plan,
          originalAmount: subscription.amount,
          originalStartDate: subscription.startDate,
          originalEndDate: subscription.endDate,
          temporaryAccessEndDate: newEndDate,
          durationDays: days,
        },
      });
    }

    // ----------------------------------------
    // CASE 3: TRIAL EXTENSION
    // ----------------------------------------

    const isTrial =
      subscription.status === "trial" ||
      (
        subscription.status === "expired" &&
        !subscription.plan &&
        subscription.trialEndDate
      );

    if (!isTrial) {
      return res.status(400).json({
        success: false,
        message: "This subscription is not eligible for free extension",
      });
    }

    const previousEndDate =
      subscription.trialEndDate || null;

    let extensionStartDate = now;

    if (
      previousEndDate &&
      new Date(previousEndDate) > now
    ) {
      extensionStartDate = new Date(previousEndDate);
    }

    const newEndDate = new Date(extensionStartDate);

    newEndDate.setUTCDate(
      newEndDate.getUTCDate() + days
    );

    subscription.status = "trial";

    subscription.trialStartDate =
      subscription.trialStartDate || now;

    subscription.trialEndDate = newEndDate;

    subscription.trialExtensionDays =
      Number(subscription.trialExtensionDays || 0) + days;

    subscription.trialExtensionCount =
      Number(subscription.trialExtensionCount || 0) + 1;

    subscription.lastTrialExtendedAt = now;
    subscription.lastTrialExtendedBy = superAdminId;

    if (!subscription.trialExtensionHistory) {
      subscription.trialExtensionHistory = [];
    }

    subscription.trialExtensionHistory.push({
      days,
      previousEndDate,
      newEndDate,
      extendedBy: superAdminId,
      extendedAt: now,
      reason: reasonText,
    });

    admin.isActive = true;

    await admin.save();

    salon.isActive = true;
    await salon.save();

    return res.status(200).json({
      success: true,
      message: `Trial extended successfully by ${days} days`,

      accessType: "trial",

      salon: {
        id: salon._id,
        name: salon.name,
      },

      subscription: {
        status: "trial",
        trialEndDate: newEndDate,
        trialExtensionDays: subscription.trialExtensionDays,
        trialExtensionCount: subscription.trialExtensionCount,
        durationDays: days,
      },
    });

  } catch (error) {
    console.error("EXTEND SALON TRIAL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to extend salon free access",
    });
  }
};
