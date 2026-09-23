import Stylist from "../models/Stylist.js";

// ======================================================
// CREATE STYLIST
// POST /api/stylists
// ======================================================

export const createStylist = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      specialization,
      experience,
      status,
    } = req.body;

    // Required fields
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name and phone are required",
      });
    }

    // Create stylist
    const stylist = await Stylist.create({
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim().toLowerCase() : "",
      specialization: specialization
        ? specialization.trim()
        : "",
      experience: Number(experience) || 0,
      status: status || "ACTIVE",
    });

    return res.status(201).json({
      success: true,
      message: "Stylist created successfully",
      stylist,
    });
  } catch (error) {
    console.error("CREATE STYLIST ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create stylist",
      error: error.message,
    });
  }
};

// ======================================================
// GET ALL STYLISTS
// GET /api/stylists
// ======================================================

export const getStylists = async (req, res) => {
  try {
    const stylists = await Stylist.find()
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: stylists.length,
      stylists,
    });
  } catch (error) {
    console.error("GET STYLISTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch stylists",
      error: error.message,
    });
  }
};

// ======================================================
// GET SINGLE STYLIST
// GET /api/stylists/:id
// ======================================================

export const getStylistById = async (req, res) => {
  try {
    const { id } = req.params;

    const stylist = await Stylist.findById(id).lean();

    if (!stylist) {
      return res.status(404).json({
        success: false,
        message: "Stylist not found",
      });
    }

    return res.status(200).json({
      success: true,
      stylist,
    });
  } catch (error) {
    console.error("GET STYLIST BY ID ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch stylist",
      error: error.message,
    });
  }
};

// ======================================================
// UPDATE STYLIST
// PATCH /api/stylists/:id
// ======================================================

export const updateStylist = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      phone,
      email,
      specialization,
      experience,
      status,
    } = req.body;

    const updateData = {};

    if (name !== undefined) {
      updateData.name = name.trim();
    }

    if (phone !== undefined) {
      updateData.phone = phone.trim();
    }

    if (email !== undefined) {
      updateData.email = email
        ? email.trim().toLowerCase()
        : "";
    }

    if (specialization !== undefined) {
      updateData.specialization = specialization
        ? specialization.trim()
        : "";
    }

    if (experience !== undefined) {
      updateData.experience =
        Number(experience) || 0;
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    const stylist =
      await Stylist.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true,
        }
      );

    if (!stylist) {
      return res.status(404).json({
        success: false,
        message: "Stylist not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Stylist updated successfully",
      stylist,
    });
  } catch (error) {
    console.error("UPDATE STYLIST ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update stylist",
      error: error.message,
    });
  }
};

// ======================================================
// DELETE STYLIST
// DELETE /api/stylists/:id
// ======================================================

export const deleteStylist = async (req, res) => {
  try {
    const { id } = req.params;

    const stylist =
      await Stylist.findByIdAndDelete(id);

    if (!stylist) {
      return res.status(404).json({
        success: false,
        message: "Stylist not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Stylist deleted successfully",
      stylist,
    });
  } catch (error) {
    console.error("DELETE STYLIST ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete stylist",
      error: error.message,
    });
  }
};