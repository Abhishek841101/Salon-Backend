import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

import User from "../models/User.js";

dotenv.config();

const createSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");

    const email = process.env.SUPERADMIN_EMAIL;
    const password = process.env.SUPERADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error(
        "SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD missing in .env"
      );
    }

    const existing = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existing) {
      console.log("Super Admin already exists.");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(
      password,
      12
    );

    const superAdmin = await User.create({
      name: "Super Admin",
      email: email.toLowerCase(),
      phone: `SUPERADMIN-${Date.now()}`,
      password: hashedPassword,
      role: "superadmin",
      salonId: null,
      isActive: true,
    });

    console.log("");
    console.log("=================================");
    console.log("SUPER ADMIN CREATED");
    console.log("=================================");
    console.log(`ID: ${superAdmin._id}`);
    console.log(`Email: ${superAdmin.email}`);
    console.log("Role: superadmin");
    console.log("=================================");
    console.log("");

    process.exit(0);
  } catch (error) {
    console.error(
      "SUPER ADMIN CREATION ERROR:",
      error
    );

    process.exit(1);
  }
};

createSuperAdmin();