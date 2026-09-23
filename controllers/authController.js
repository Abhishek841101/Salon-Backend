import jwt from "jsonwebtoken";

export const adminLogin = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Admin phone and password are required",
      });
    }

    const adminPhone = process.env.ADMIN_PHONE;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPhone || !adminPassword) {
      console.error(
        "ADMIN_PHONE or ADMIN_PASSWORD is missing in .env"
      );

      return res.status(500).json({
        success: false,
        message: "Admin authentication is not configured",
      });
    }

    if (
      phone.trim() !== adminPhone.trim() ||
      password !== adminPassword
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin phone or password",
      });
    }

    const token = jwt.sign(
      {
        id: "admin",
        role: "admin",
        phone: adminPhone.trim(),
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      }
    );

    return res.status(200).json({
      success: true,
      message: "Admin login successful",

      token,

      user: {
        id: "admin",
        name: "Salon Admin",
        phone: adminPhone.trim(),
        role: "admin",
      },
    });
  } catch (error) {
    console.error("ADMIN LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};