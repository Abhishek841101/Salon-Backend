import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import User from "../models/User.js";
import Salon from "../models/Salon.js";

// ========================================
// CREATE JWT
// ========================================

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id.toString(),

      role: user.role,

      salonId: user.salonId
        ? user.salonId.toString()
        : null,
    },

    process.env.JWT_SECRET,

    {
      expiresIn:
        process.env.JWT_EXPIRES_IN || "7d",
    }
  );
};

// ========================================
// GET CURRENT SUBSCRIPTION STATUS
// ========================================

const getCurrentSubscription = (user) => {
  const subscription =
    user.subscription || {};

  const now = new Date();

  // ========================================
  // TRIAL
  // ========================================

  if (
    subscription.status === "trial" &&
    subscription.trialEndDate
  ) {
    // Trial expired
    if (
      now >
      new Date(subscription.trialEndDate)
    ) {
      return {
        status: "expired",
        plan: null,

        trialStartDate:
          subscription.trialStartDate || null,

        trialEndDate:
          subscription.trialEndDate,

        startDate: null,
        endDate: null,

        amount: 0,
      };
    }

    // Trial still active
    return {
      status: "trial",
      plan: null,

      trialStartDate:
        subscription.trialStartDate || null,

      trialEndDate:
        subscription.trialEndDate,

      startDate: null,
      endDate: null,

      amount: 0,
    };
  }

  // ========================================
  // ACTIVE PLAN
  // ========================================

  if (
    subscription.status === "active"
  ) {
    // Plan expired
    if (
      subscription.endDate &&
      now >
        new Date(subscription.endDate)
    ) {
      return {
        status: "expired",

        plan:
          subscription.plan || null,

        trialStartDate:
          subscription.trialStartDate ||
          null,

        trialEndDate:
          subscription.trialEndDate ||
          null,

        startDate:
          subscription.startDate ||
          null,

        endDate:
          subscription.endDate,

        amount:
          subscription.amount || 0,
      };
    }

    // Plan active
    return {
      status: "active",

      plan:
        subscription.plan || null,

      trialStartDate:
        subscription.trialStartDate ||
        null,

      trialEndDate:
        subscription.trialEndDate ||
        null,

      startDate:
        subscription.startDate || null,

      endDate:
        subscription.endDate || null,

      amount:
        subscription.amount || 0,
    };
  }

  // ========================================
  // EXPIRED / CANCELLED / OTHER
  // ========================================

  return {
    status:
      subscription.status ||
      "expired",

    plan:
      subscription.plan || null,

    trialStartDate:
      subscription.trialStartDate ||
      null,

    trialEndDate:
      subscription.trialEndDate ||
      null,

    startDate:
      subscription.startDate || null,

    endDate:
      subscription.endDate || null,

    amount:
      subscription.amount || 0,
  };
};

// ========================================
// LOGIN
// ========================================
// Supports:
//
// Email + Password
// OR
// Phone + Password
//
// Roles:
// superadmin
// admin
// owner
// staff
// ========================================

export const login = async (
  req,
  res
) => {
  try {
    const {
      phone,
      email,
      password,
    } = req.body;

    // ========================================
    // VALIDATION
    // ========================================

    if (
      (!phone && !email) ||
      !password
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Phone/email and password are required",
      });
    }

    // ========================================
    // NORMALIZE LOGIN VALUE
    // ========================================

    const loginValue = (
      phone || email
    ).trim();

    // ========================================
    // FIND USER
    // ========================================

    const query = phone
      ? {
          phone: loginValue,
        }
      : {
          email:
            loginValue.toLowerCase(),
        };

    const user =
      await User.findOne(query).select(
        "+password"
      );

    if (!user) {
      return res.status(401).json({
        success: false,

        message:
          "Invalid login credentials",
      });
    }

    // ========================================
    // ACCOUNT ACTIVE CHECK
    // ========================================

    if (!user.isActive) {
      return res.status(403).json({
        success: false,

        code: "ACCOUNT_INACTIVE",

        message:
          "Your account has been deactivated",
      });
    }

    // ========================================
    // PASSWORD CHECK
    // ========================================

    const passwordMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,

        message:
          "Invalid login credentials",
      });
    }

    // ========================================
    // SUBSCRIPTION
    // ========================================

    let subscription = null;

    // Super Admin does not need subscription
    if (
      user.role === "admin" ||
      user.role === "owner"
    ) {
      subscription =
        getCurrentSubscription(user);

      // ----------------------------------------
      // Save changed subscription status
      // ----------------------------------------

      if (
        user.subscription &&
        user.subscription.status !==
          subscription.status
      ) {
        user.subscription.status =
          subscription.status;

        await user.save();
      }
    }

    // ========================================
    // CREATE JWT
    // ========================================

    const token =
      generateToken(user);

    // ========================================
    // RESPONSE
    // ========================================

    return res.status(200).json({
      success: true,

      message: "Login successful",

      token,

      user: {
        id: user._id,

        name: user.name,

        email: user.email,

        phone: user.phone,

        role: user.role,

        salonId:
          user.salonId || null,

        isActive: user.isActive,

        subscription,
      },
    });
  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Internal server error",
    });
  }
};

// ========================================
// GET CURRENT LOGGED-IN USER
// ========================================

export const getMe = async (
  req,
  res
) => {
  try {
    // ========================================
    // FIND USER
    // ========================================

    const user =
      await User.findById(
        req.user.id
      );

    if (!user) {
      return res.status(404).json({
        success: false,

        message:
          "User not found",
      });
    }

    // ========================================
    // ACCOUNT ACTIVE CHECK
    // ========================================

    if (!user.isActive) {
      return res.status(403).json({
        success: false,

        code: "ACCOUNT_INACTIVE",

        message:
          "Your account has been deactivated",
      });
    }

    // ========================================
    // SUBSCRIPTION
    // ========================================

    let subscription = null;

    // Super Admin has no subscription
    if (
      user.role === "admin" ||
      user.role === "owner"
    ) {
      subscription =
        getCurrentSubscription(user);

      // ----------------------------------------
      // Save changed status
      // ----------------------------------------

      if (
        user.subscription &&
        user.subscription.status !==
          subscription.status
      ) {
        user.subscription.status =
          subscription.status;

        await user.save();
      }
    }

    // ========================================
    // RESPONSE
    // ========================================

    return res.status(200).json({
      success: true,

      user: {
        id: user._id,

        name: user.name,

        email: user.email,

        phone: user.phone,

        role: user.role,

        salonId:
          user.salonId || null,

        isActive: user.isActive,

        subscription,
      },
    });
  } catch (error) {
    console.error(
      "GET ME ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Internal server error",
    });
  }
};

// ========================================
// CREATE NEW SALON + SALON ADMIN
// ========================================
// Public registration
//
// New salon gets:
// 3 DAYS FREE TRIAL
//
// Role:
// admin
// ========================================

export const registerSalon =
  async (req, res) => {
    try {
      const {
        salonName,
        ownerName,
        email,
        phone,
        password,
      } = req.body;

      // ========================================
      // VALIDATION
      // ========================================

      if (
        !salonName ||
        !ownerName ||
        !email ||
        !phone ||
        !password
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Salon name, owner name, email, phone and password are required",
        });
      }

      if (
        password.length < 6
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Password must be at least 6 characters",
        });
      }

      // ========================================
      // NORMALIZE DATA
      // ========================================

      const normalizedEmail =
        email.trim().toLowerCase();

      const normalizedPhone =
        phone.trim();

      // ========================================
      // CHECK EXISTING USER
      // ========================================

      const existingUser =
        await User.findOne({
          $or: [
            {
              email:
                normalizedEmail,
            },

            {
              phone:
                normalizedPhone,
            },
          ],
        });

      if (existingUser) {
        return res.status(409).json({
          success: false,

          message:
            "An account already exists with this email or phone",
        });
      }

      // ========================================
      // CHECK EXISTING SALON
      // ========================================

      const existingSalon =
        await Salon.findOne({
          $or: [
            {
              email:
                normalizedEmail,
            },

            {
              phone:
                normalizedPhone,
            },
          ],
        });

      if (existingSalon) {
        return res.status(409).json({
          success: false,

          message:
            "A salon already exists with this email or phone",
        });
      }

      // ========================================
      // CREATE SALON
      // ========================================

      const salon =
        await Salon.create({
          name: salonName.trim(),

          ownerName:
            ownerName.trim(),

          email:
            normalizedEmail,

          phone:
            normalizedPhone,

          isActive: true,
        });

      // ========================================
      // HASH PASSWORD
      // ========================================

      const hashedPassword =
        await bcrypt.hash(
          password,
          12
        );

      // ========================================
      // 3 DAYS FREE TRIAL
      // ========================================

      const trialStartDate =
        new Date();

      const trialEndDate =
        new Date(
          trialStartDate
        );

      trialEndDate.setDate(
        trialEndDate.getDate() +
          3
      );

      // ========================================
      // CREATE SALON ADMIN
      // ========================================

      const user =
        await User.create({
          name:
            ownerName.trim(),

          email:
            normalizedEmail,

          phone:
            normalizedPhone,

          password:
            hashedPassword,

          role: "admin",

          salonId:
            salon._id,

          isActive: true,

          subscription: {
            status: "trial",

            plan: null,

            trialStartDate,

            trialEndDate,

            startDate: null,

            endDate: null,

            amount: 0,
          },
        });

      // ========================================
      // RESPONSE
      // ========================================

      return res.status(201).json({
        success: true,

        message:
          "Salon created successfully",

        salon: {
          id: salon._id,

          name: salon.name,

          ownerName:
            salon.ownerName,

          email: salon.email,

          phone: salon.phone,
        },

        user: {
          id: user._id,

          name: user.name,

          email: user.email,

          phone: user.phone,

          role: user.role,

          salonId:
            user.salonId,
        },

        trial: {
          status: "trial",

          trialStartDate,

          trialEndDate,

          trialDays: 3,
        },
      });
    } catch (error) {
      console.error(
        "REGISTER SALON ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to create salon",

        error:
          error.message,
      });
    }
  };