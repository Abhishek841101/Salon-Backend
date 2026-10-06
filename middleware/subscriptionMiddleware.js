import User from "../models/User.js";

// ========================================
// CHECK SALON SUBSCRIPTION
// ========================================

export const requireActiveSubscription = async (
  req,
  res,
  next
) => {
  try {
    // Super Admin ko subscription ki zarurat nahi
    if (req.user?.role === "superadmin") {
      return next();
    }

    // Salon admin/staff ke liye user required
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await User.findById(
      req.user.id
    ).select(
      "role salonId isActive subscription"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_INACTIVE",
        message: "Your account is inactive",
      });
    }

    // ----------------------------------------
    // STAFF / OWNER WITHOUT SUBSCRIPTION
    // ----------------------------------------

    if (
      !user.subscription ||
      !user.subscription.status
    ) {
      return res.status(403).json({
        success: false,
        code: "SUBSCRIPTION_REQUIRED",
        message:
          "No active subscription found",
      });
    }

    const subscription =
      user.subscription;

    const now = new Date();

    // ----------------------------------------
    // TRIAL
    // ----------------------------------------

    if (subscription.status === "trial") {
      if (
        subscription.trialEndDate &&
        now <= new Date(
          subscription.trialEndDate
        )
      ) {
        req.subscription = {
          status: "trial",
          plan: null,
          trialEndDate:
            subscription.trialEndDate,
        };

        return next();
      }

      // Trial expired
      subscription.status = "expired";

      await user.save();

      return res.status(403).json({
        success: false,
        code: "SUBSCRIPTION_EXPIRED",
        status: "expired",
        message:
          "Your free trial has expired. Please connect with Super Admin to activate a plan.",
        trialEndDate:
          subscription.trialEndDate,
      });
    }

    // ----------------------------------------
    // ACTIVE PLAN
    // ----------------------------------------

    if (subscription.status === "active") {
      if (
        subscription.endDate &&
        now <= new Date(
          subscription.endDate
        )
      ) {
        req.subscription = {
          status: "active",
          plan: subscription.plan,
          startDate:
            subscription.startDate,
          endDate:
            subscription.endDate,
          amount:
            subscription.amount,
        };

        return next();
      }

      // Plan expired
      subscription.status = "expired";

      await user.save();

      return res.status(403).json({
        success: false,
        code: "SUBSCRIPTION_EXPIRED",
        status: "expired",
        message:
          "Your subscription has expired. Please connect with Super Admin to renew your plan.",
        endDate:
          subscription.endDate,
      });
    }

    // ----------------------------------------
    // EXPIRED
    // ----------------------------------------

    if (
      subscription.status === "expired"
    ) {
      return res.status(403).json({
        success: false,
        code: "SUBSCRIPTION_EXPIRED",
        status: "expired",
        message:
          "Your subscription has expired. Please connect with Super Admin to activate a plan.",
        endDate:
          subscription.endDate ||
          subscription.trialEndDate,
      });
    }

    // ----------------------------------------
    // CANCELLED
    // ----------------------------------------

    if (
      subscription.status === "cancelled"
    ) {
      return res.status(403).json({
        success: false,
        code: "SUBSCRIPTION_CANCELLED",
        status: "cancelled",
        message:
          "Your subscription has been cancelled.",
      });
    }

    return res.status(403).json({
      success: false,
      code: "SUBSCRIPTION_REQUIRED",
      message:
        "Valid subscription is required",
    });
  } catch (error) {
    console.error(
      "SUBSCRIPTION CHECK ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to verify subscription",
    });
  }
};