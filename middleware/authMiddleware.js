import jwt from "jsonwebtoken";
import User from "../models/User.js";

// ========================================
// VERIFY JWT
// ========================================

export const protectAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is required",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format",
      });
    }

    const token = authHeader
      .substring(7)
      .trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is missing",
      });
    }

    // ========================================
    // VERIFY TOKEN
    // ========================================

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // ========================================
    // FIND USER
    // ========================================

    const user = await User.findById(
      decoded.id
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found",
      });
    }

    // ========================================
    // CHECK ACTIVE ACCOUNT
    // ========================================

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    // ========================================
    // ATTACH USER
    // ========================================

    req.user = user;
    req.auth = decoded;

    next();

  } catch (error) {
    // ========================================
    // DETAILED AUTH ERROR
    // ========================================

    console.error(
      "================================"
    );

    console.error(
      "AUTH ERROR NAME:",
      error.name
    );

    console.error(
      "AUTH ERROR MESSAGE:",
      error.message
    );

    console.error(
      "AUTH ERROR STACK:",
      error.stack
    );

    console.error(
      "================================"
    );

    // ========================================
    // TOKEN EXPIRED
    // ========================================

    if (
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        code: "TOKEN_EXPIRED",
        message:
          "Token has expired. Please login again",
      });
    }

    // ========================================
    // INVALID TOKEN
    // ========================================

    if (
      error.name === "JsonWebTokenError"
    ) {
      return res.status(401).json({
        success: false,
        code: "INVALID_TOKEN",
        message: "Invalid token",
      });
    }

    // ========================================
    // OTHER AUTH ERROR
    // ========================================

    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

// ========================================
// ADMIN ONLY
// ========================================

export const requireAdmin = (
  req,
  res,
  next
) => {
  if (
    !req.user ||
    !["admin", "owner"].includes(
      req.user.role
    )
  ) {
    return res.status(403).json({
      success: false,
      message:
        "Salon Admin access required",
    });
  }

  next();
};

// ========================================
// SUPER ADMIN ONLY
// ========================================

export const requireSuperAdmin = (
  req,
  res,
  next
) => {
  if (
    !req.user ||
    req.user.role !== "superadmin"
  ) {
    return res.status(403).json({
      success: false,
      message:
        "Super Admin access required",
    });
  }

  next();
};

// ========================================
// ADMIN OR SUPER ADMIN
// ========================================

export const requireAdminOrSuperAdmin = (
  req,
  res,
  next
) => {
  if (
    !req.user ||
    ![
      "admin",
      "owner",
      "superadmin",
    ].includes(req.user.role)
  ) {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

  next();
};

// ========================================
// BACKWARD COMPATIBILITY
// ========================================

export const protectAdmin = [
  protectAuth,
  requireAdmin,
];