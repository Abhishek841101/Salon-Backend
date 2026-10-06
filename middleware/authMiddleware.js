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

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is missing",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    req.user = user;
    req.auth = decoded;

    next();
  } catch (error) {
    console.error("AUTH ERROR:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please login again",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

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
    !["admin", "owner"].includes(req.user.role)
  ) {
    return res.status(403).json({
      success: false,
      message: "Salon Admin access required",
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
      message: "Super Admin access required",
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
    !["admin", "owner", "superadmin"].includes(
      req.user.role
    )
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