import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./config/db.js";

// Routes
import clientRoutes from "./routes/clientRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import billRoutes from "./routes/billRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import stylistRoutes from "./routes/stylistRoutes.js";
dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

// ========================================
// MIDDLEWARE
// ========================================

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ========================================
// HEALTH / TEST ROUTE
// ========================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Salon Backend API is running",
    status: "OK",
  });
});

// ========================================
// API HEALTH ROUTE
// ========================================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is healthy",
    database: "Connected",
    timestamp: new Date().toISOString(),
  });
});

// ========================================
// AUTH ROUTES
// ========================================

app.use("/api/auth", authRoutes);

// ========================================
// CLIENT ROUTES
// ========================================

app.use("/api/clients", clientRoutes);

app.use("/api/services", serviceRoutes);
app.use("/api/bills", billRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/stylists", stylistRoutes);
// ========================================
// 404 ROUTE
// ========================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// ========================================
// GLOBAL ERROR HANDLER
// ========================================

app.use((error, req, res, next) => {
  console.error("Server Error:", error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error",
  });
});

// ========================================
// START SERVER
// ========================================

const startServer = async () => {
  try {
    // Connect MongoDB first
    await connectDB();

    // Start Express server
    app.listen(PORT, () => {
      console.log("");
      console.log("========================================");
      console.log("       SALON BACKEND SERVER");
      console.log("========================================");
      console.log(`Server: http://localhost:${PORT}`);
      console.log(`API:    http://localhost:${PORT}/api`);
      console.log(
        `Health: http://localhost:${PORT}/api/health`
      );
      console.log("");
      console.log("Routes:");
      console.log(
        `Auth:    http://localhost:${PORT}/api/auth`
      );
      console.log(
        `Clients: http://localhost:${PORT}/api/clients`
      );
      console.log("");
      console.log("Database: Connected");
      console.log("========================================");
      console.log("");
    });
  } catch (error) {
    console.error("");
    console.error("========================================");
    console.error("       SERVER START FAILED");
    console.error("========================================");
    console.error(error.message);
    console.error("========================================");
    console.error("");

    process.exit(1);
  }
};

startServer();