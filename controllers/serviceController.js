import Service from "../models/Service.js";
import cloudinary from "../config/cloudinary.js";

// ========================================
// CLOUDINARY DELETE HELPER
// ========================================

const deleteCloudinaryImage = async (publicId) => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
    console.log("CLOUDINARY IMAGE DELETED:", publicId);
  } catch (error) {
    console.error(
      "CLOUDINARY DELETE ERROR:",
      error.message
    );
  }
};

// ========================================
// ADD SERVICE
// ========================================

export const createService = async (req, res) => {
  try {
    const {
      name,
      category,
      price,
      duration,
      description,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Service name is required",
      });
    }

    if (price === undefined || price === "") {
      return res.status(400).json({
        success: false,
        message: "Service price is required",
      });
    }

    const numericPrice = Number(price);

    const numericDuration =
      duration === undefined || duration === ""
        ? 30
        : Number(duration);

    if (
      Number.isNaN(numericPrice) ||
      numericPrice < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid service price",
      });
    }

    if (
      Number.isNaN(numericDuration) ||
      numericDuration < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid service duration",
      });
    }

    // ========================================
    // IMAGE
    // ========================================

    let image = {
      url: "",
      publicId: "",
    };

    if (req.file) {
      console.log(
        "SERVICE IMAGE UPLOADED:",
        req.file.path
      );

      image = {
        url: req.file.path,
        publicId: req.file.filename,
      };
    }

    // ========================================
    // CREATE SERVICE
    // ========================================

    const service = await Service.create({
      name: name.trim(),

      category:
        category?.trim() || "",

      price: numericPrice,

      duration: numericDuration,

      description:
        description?.trim() || "",

      image,

      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Service added successfully",
      service,
    });
  } catch (error) {
    console.error(
      "CREATE SERVICE ERROR:",
      error
    );

    // If DB creation fails after image upload,
    // remove uploaded Cloudinary image.
    if (req.file?.filename) {
      await deleteCloudinaryImage(
        req.file.filename
      );
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create service",
      error: error.message,
    });
  }
};

// ========================================
// GET ALL SERVICES
// ========================================

export const getServices = async (req, res) => {
  try {
    const {
      search = "",
      page = 1,
      limit = 20,
      status = "active",
    } = req.query;

    const currentPage = Math.max(
      Number(page) || 1,
      1
    );

    const perPage = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const query = {};

    // ========================================
    // STATUS FILTER
    // ========================================

    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
    }

    // ========================================
    // SEARCH
    // ========================================

    if (
      typeof search === "string" &&
      search.trim()
    ) {
      const searchText = search.trim();

      query.$or = [
        {
          name: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          category: {
            $regex: searchText,
            $options: "i",
          },
        },
      ];
    }

    const skip =
      (currentPage - 1) * perPage;

    const [services, total] =
      await Promise.all([
        Service.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(perPage),

        Service.countDocuments(query),
      ]);

    const totalPages =
      Math.ceil(total / perPage);

    return res.status(200).json({
      success: true,

      services,

      pagination: {
        total,
        page: currentPage,
        limit: perPage,
        totalPages,

        hasNextPage:
          currentPage < totalPages,

        hasPreviousPage:
          currentPage > 1,
      },
    });
  } catch (error) {
    console.error(
      "GET SERVICES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch services",
      error: error.message,
    });
  }
};

// ========================================
// GET SINGLE SERVICE
// ========================================

export const getServiceById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const service =
      await Service.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.status(200).json({
      success: true,
      service,
    });
  } catch (error) {
    console.error(
      "GET SERVICE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch service",
      error: error.message,
    });
  }
};

// ========================================
// UPDATE SERVICE
// ========================================

export const updateService = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const service =
      await Service.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const {
      name,
      category,
      price,
      duration,
      description,
      isActive,
    } = req.body;

    // ========================================
    // NAME
    // ========================================

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        !name.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Service name cannot be empty",
        });
      }

      service.name = name.trim();
    }

    // ========================================
    // CATEGORY
    // ========================================

    if (category !== undefined) {
      service.category =
        String(category).trim();
    }

    // ========================================
    // PRICE
    // ========================================

    if (price !== undefined) {
      const numericPrice =
        Number(price);

      if (
        Number.isNaN(numericPrice) ||
        numericPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid service price",
        });
      }

      service.price = numericPrice;
    }

    // ========================================
    // DURATION
    // ========================================

    if (duration !== undefined) {
      const numericDuration =
        Number(duration);

      if (
        Number.isNaN(numericDuration) ||
        numericDuration < 1
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid service duration",
        });
      }

      service.duration =
        numericDuration;
    }

    // ========================================
    // DESCRIPTION
    // ========================================

    if (description !== undefined) {
      service.description =
        String(description).trim();
    }

    // ========================================
    // ACTIVE STATUS
    // ========================================

    if (isActive !== undefined) {
      if (
        isActive === true ||
        isActive === "true"
      ) {
        service.isActive = true;
      }

      if (
        isActive === false ||
        isActive === "false"
      ) {
        service.isActive = false;
      }
    }

    // ========================================
    // NEW IMAGE
    // ========================================

    if (req.file) {
      const oldPublicId =
        service.image?.publicId;

      service.image = {
        url: req.file.path,
        publicId: req.file.filename,
      };

      if (oldPublicId) {
        await deleteCloudinaryImage(
          oldPublicId
        );
      }
    }

    await service.save();

    return res.status(200).json({
      success: true,
      message: "Service updated successfully",
      service,
    });
  } catch (error) {
    console.error(
      "UPDATE SERVICE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update service",
      error: error.message,
    });
  }
};

// ========================================
// DEACTIVATE SERVICE
// ========================================

export const deactivateService = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const service =
      await Service.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    service.isActive = false;

    await service.save();

    return res.status(200).json({
      success: true,
      message:
        "Service deactivated successfully",
      service,
    });
  } catch (error) {
    console.error(
      "DEACTIVATE SERVICE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to deactivate service",
      error: error.message,
    });
  }
};

// ========================================
// REACTIVATE SERVICE
// ========================================

export const reactivateService = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const service =
      await Service.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    service.isActive = true;

    await service.save();

    return res.status(200).json({
      success: true,
      message:
        "Service reactivated successfully",
      service,
    });
  } catch (error) {
    console.error(
      "REACTIVATE SERVICE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to reactivate service",
      error: error.message,
    });
  }
};

// ========================================
// DELETE SERVICE
// ========================================

export const deleteService = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const service =
      await Service.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // ========================================
    // DELETE CLOUDINARY IMAGE
    // ========================================

    if (service.image?.publicId) {
      await deleteCloudinaryImage(
        service.image.publicId
      );
    }

    // ========================================
    // DELETE DATABASE RECORD
    // ========================================

    await Service.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message:
        "Service deleted permanently",
    });
  } catch (error) {
    console.error(
      "DELETE SERVICE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete service",
      error: error.message,
    });
  }
};