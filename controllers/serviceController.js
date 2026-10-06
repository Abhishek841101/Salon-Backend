
import Service from "../models/Service.js";
import cloudinary from "../config/cloudinary.js";

/* =========================================================
   HELPERS
========================================================= */

const getSalonId = (req) => {
  return req.user?.salonId || null;
};

const validateSalonAccess = (req, res) => {
  const salonId = getSalonId(req);

  if (!salonId) {
    res.status(403).json({
      success: false,
      message: "Salon access is required",
    });

    return null;
  }

  return salonId;
};

const deleteCloudinaryImage = async (publicId) => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
    console.log("Cloudinary image deleted:", publicId);
  } catch (error) {
    console.error(
      "Cloudinary image delete error:",
      error?.message || error
    );
  }
};

/* =========================================================
   CREATE SERVICE
   POST /api/services
========================================================= */

export const createService = async (req, res) => {
  let uploadedPublicId = null;

  try {
    const salonId = validateSalonAccess(req, res);

    if (!salonId) return;

    const {
      name,
      category,
      price,
      duration,
      description,
    } = req.body;

    /* -----------------------------
       VALIDATION
    ----------------------------- */

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Service name is required",
      });
    }

    if (price === undefined || price === null || price === "") {
      return res.status(400).json({
        success: false,
        message: "Service price is required",
      });
    }

    const numericPrice = Number(price);

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Service price must be a valid non-negative number",
      });
    }

    const numericDuration =
      duration === undefined ||
      duration === null ||
      duration === ""
        ? 30
        : Number(duration);

    if (
      Number.isNaN(numericDuration) ||
      numericDuration <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Service duration must be greater than 0",
      });
    }

    /* -----------------------------
       IMAGE
    ----------------------------- */

    let image = {
      url: "",
      publicId: "",
    };

    if (req.file) {
      image = {
        url: req.file.path || "",
        publicId: req.file.filename || "",
      };

      uploadedPublicId = req.file.filename || null;
    }

    /* -----------------------------
       CREATE
    ----------------------------- */

    const service = await Service.create({
      salonId,

      name: name.trim(),

      category:
        typeof category === "string"
          ? category.trim()
          : "",

      price: numericPrice,

      duration: numericDuration,

      description:
        typeof description === "string"
          ? description.trim()
          : "",

      image,

      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Service created successfully",
      service,
    });
  } catch (error) {
    console.error("CREATE SERVICE ERROR:", error);

    /* -----------------------------
       CLEANUP UPLOADED IMAGE
    ----------------------------- */

    if (uploadedPublicId) {
      await deleteCloudinaryImage(uploadedPublicId);
    }

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Service already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create service",
      error: error.message,
    });
  }
};

/* =========================================================
   GET ALL SERVICES
   GET /api/services
========================================================= */

export const getServices = async (req, res) => {
  try {
    const salonId = validateSalonAccess(req, res);

    if (!salonId) return;

    const {
      search,
      category,
      isActive,
      page = 1,
      limit = 50,
    } = req.query;

    /* -----------------------------
       TENANT FILTER
    ----------------------------- */

    const query = {
      salonId,
    };

    /* -----------------------------
       ACTIVE / INACTIVE FILTER
    ----------------------------- */

    if (
      isActive !== undefined &&
      isActive !== ""
    ) {
      query.isActive =
        String(isActive).toLowerCase() === "true";
    }

    /* -----------------------------
       CATEGORY FILTER
    ----------------------------- */

    if (
      category &&
      String(category).trim()
    ) {
      query.category = String(category).trim();
    }

    /* -----------------------------
       SEARCH
    ----------------------------- */

    if (
      search &&
      String(search).trim()
    ) {
      const searchValue = String(search).trim();

      query.$or = [
        {
          name: {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          category: {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          description: {
            $regex: searchValue,
            $options: "i",
          },
        },
      ];
    }

    /* -----------------------------
       PAGINATION
    ----------------------------- */

    const pageNumber =
      Math.max(Number(page) || 1, 1);

    const limitNumber =
      Math.min(
        Math.max(Number(limit) || 50, 1),
        100
      );

    const skip =
      (pageNumber - 1) * limitNumber;

    const [
      services,
      total,
    ] = await Promise.all([
      Service.find(query)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNumber),

      Service.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: services.length,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages:
        Math.ceil(total / limitNumber),

      services,
    });
  } catch (error) {
    console.error("GET SERVICES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch services",
      error: error.message,
    });
  }
};

/* =========================================================
   GET SERVICE BY ID
   GET /api/services/:id
========================================================= */

export const getServiceById = async (req, res) => {
  try {
    const salonId = validateSalonAccess(req, res);

    if (!salonId) return;

    const { id } = req.params;

    const service = await Service.findOne({
      _id: id,
      salonId,
    });

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
      "GET SERVICE BY ID ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch service",
      error: error.message,
    });
  }
};

/* =========================================================
   UPDATE SERVICE
   PUT /api/services/:id
========================================================= */

export const updateService = async (req, res) => {
  let uploadedPublicId = null;

  try {
    const salonId = validateSalonAccess(req, res);

    if (!salonId) return;

    const { id } = req.params;

    const {
      name,
      category,
      price,
      duration,
      description,
      isActive,
    } = req.body;

    /* -----------------------------
       FIND ONLY WITHIN SALON
    ----------------------------- */

    const service = await Service.findOne({
      _id: id,
      salonId,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    /* -----------------------------
       NAME
    ----------------------------- */

    if (name !== undefined) {
      if (
        !String(name).trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Service name cannot be empty",
        });
      }

      service.name =
        String(name).trim();
    }

    /* -----------------------------
       CATEGORY
    ----------------------------- */

    if (category !== undefined) {
      service.category =
        String(category).trim();
    }

    /* -----------------------------
       PRICE
    ----------------------------- */

    if (
      price !== undefined &&
      price !== null &&
      price !== ""
    ) {
      const numericPrice =
        Number(price);

      if (
        Number.isNaN(numericPrice) ||
        numericPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Service price must be a valid non-negative number",
        });
      }

      service.price =
        numericPrice;
    }

    /* -----------------------------
       DURATION
    ----------------------------- */

    if (
      duration !== undefined &&
      duration !== null &&
      duration !== ""
    ) {
      const numericDuration =
        Number(duration);

      if (
        Number.isNaN(numericDuration) ||
        numericDuration <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Service duration must be greater than 0",
        });
      }

      service.duration =
        numericDuration;
    }

    /* -----------------------------
       DESCRIPTION
    ----------------------------- */

    if (description !== undefined) {
      service.description =
        String(description).trim();
    }

    /* -----------------------------
       ACTIVE STATUS
    ----------------------------- */

    if (isActive !== undefined) {
      if (
        typeof isActive === "boolean"
      ) {
        service.isActive =
          isActive;
      } else {
        service.isActive =
          String(isActive).toLowerCase() ===
          "true";
      }
    }

    /* -----------------------------
       NEW IMAGE
    ----------------------------- */

    if (req.file) {
      const oldPublicId =
        service.image?.publicId || "";

      service.image = {
        url: req.file.path || "",
        publicId: req.file.filename || "",
      };

      uploadedPublicId =
        req.file.filename || null;

      /* -----------------------------
         SAVE FIRST
      ----------------------------- */

      await service.save();

      /* -----------------------------
         DELETE OLD IMAGE
      ----------------------------- */

      if (
        oldPublicId &&
        oldPublicId !== uploadedPublicId
      ) {
        await deleteCloudinaryImage(
          oldPublicId
        );
      }
    } else {
      await service.save();
    }

    return res.status(200).json({
      success: true,
      message: "Service updated successfully",
      service,
    });
  } catch (error) {
    console.error("UPDATE SERVICE ERROR:", error);

    /* -----------------------------
       CLEANUP NEW IMAGE IF SAVE FAILED
    ----------------------------- */

    if (uploadedPublicId) {
      await deleteCloudinaryImage(
        uploadedPublicId
      );
    }

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Service already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update service",
      error: error.message,
    });
  }
};

/* =========================================================
   DEACTIVATE SERVICE
   PATCH /api/services/:id/deactivate
========================================================= */

export const deactivateService = async (
  req,
  res
) => {
  try {
    const salonId = validateSalonAccess(req, res);

    if (!salonId) return;

    const { id } = req.params;

    const service =
      await Service.findOneAndUpdate(
        {
          _id: id,
          salonId,
        },
        {
          $set: {
            isActive: false,
          },
        },
        {
          new: true,
        }
      );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Service deactivated successfully",
      service,
    });
  } catch (error) {
    console.error(
      "DEACTIVATE SERVICE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to deactivate service",
      error: error.message,
    });
  }
};

/* =========================================================
   REACTIVATE SERVICE
   PATCH /api/services/:id/reactivate
========================================================= */

export const reactivateService = async (
  req,
  res
) => {
  try {
    const salonId = validateSalonAccess(req, res);

    if (!salonId) return;

    const { id } = req.params;

    const service =
      await Service.findOneAndUpdate(
        {
          _id: id,
          salonId,
        },
        {
          $set: {
            isActive: true,
          },
        },
        {
          new: true,
        }
      );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Service reactivated successfully",
      service,
    });
  } catch (error) {
    console.error(
      "REACTIVATE SERVICE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to reactivate service",
      error: error.message,
    });
  }
};

/* =========================================================
   DELETE SERVICE
   DELETE /api/services/:id
========================================================= */

export const deleteService = async (
  req,
  res
) => {
  try {
    const salonId = validateSalonAccess(req, res);

    if (!salonId) return;

    const { id } = req.params;

    /* -----------------------------
       FIND ONLY WITHIN CURRENT SALON
    ----------------------------- */

    const service = await Service.findOne({
      _id: id,
      salonId,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    /* -----------------------------
       DELETE DATABASE RECORD
    ----------------------------- */

    await Service.deleteOne({
      _id: id,
      salonId,
    });

    /* -----------------------------
       DELETE CLOUDINARY IMAGE
    ----------------------------- */

    if (service.image?.publicId) {
      await deleteCloudinaryImage(
        service.image.publicId
      );
    }

    return res.status(200).json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE SERVICE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete service",
      error: error.message,
    });
  }
};

