import Service from "../models/Service.js";
import cloudinary from "../config/cloudinary.js";
import XLSX from "xlsx";

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
   NORMALIZE SERVICE GROUP
========================================================= */

const normalizeServiceGroup = (value) => {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return "General";
  }

  return String(value).trim();
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
      serviceGroup,
      category,
      price,
      duration,
      description,
    } = req.body;

    /* -----------------------------
       VALIDATION
    ----------------------------- */

    if (!name || !String(name).trim()) {
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
        message:
          "Service price must be a valid non-negative number",
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

      name: String(name).trim(),

      serviceGroup: normalizeServiceGroup(
        serviceGroup
      ),

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
      await deleteCloudinaryImage(
        uploadedPublicId
      );
    }

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Service with the same name already exists in this group",
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
      serviceGroup,
      isActive,
      status,
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

       Supports both:
       ?isActive=true
       ?status=active
    ----------------------------- */

    if (
      isActive !== undefined &&
      isActive !== ""
    ) {
      query.isActive =
        String(isActive).toLowerCase() === "true";
    } else if (
      status !== undefined &&
      status !== ""
    ) {
      const normalizedStatus =
        String(status).toLowerCase();

      if (normalizedStatus === "active") {
        query.isActive = true;
      }

      if (normalizedStatus === "inactive") {
        query.isActive = false;
      }

      if (normalizedStatus === "all") {
        // Do not apply isActive filter.
      }
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
       SERVICE GROUP FILTER
    ----------------------------- */

    if (
      serviceGroup &&
      String(serviceGroup).trim()
    ) {
      query.serviceGroup =
        String(serviceGroup).trim();
    }

    /* -----------------------------
       SEARCH
    ----------------------------- */

    if (
      search &&
      String(search).trim()
    ) {
      const searchValue =
        String(search).trim();

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
          serviceGroup: {
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
          serviceGroup: 1,
          category: 1,
          name: 1,
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

/* =========================================================
   GET SERVICE BY ID
   GET /api/services/:id
========================================================= */

export const getServiceById = async (
  req,
  res
) => {
  try {
    const salonId = validateSalonAccess(
      req,
      res
    );

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

export const updateService = async (
  req,
  res
) => {
  let uploadedPublicId = null;

  try {
    const salonId = validateSalonAccess(
      req,
      res
    );

    if (!salonId) return;

    const { id } = req.params;

    const {
      name,
      serviceGroup,
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
      if (!String(name).trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Service name cannot be empty",
        });
      }

      service.name =
        String(name).trim();
    }

    /* -----------------------------
       SERVICE GROUP
    ----------------------------- */

    if (serviceGroup !== undefined) {
      service.serviceGroup =
        normalizeServiceGroup(
          serviceGroup
        );
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
        publicId:
          req.file.filename || "",
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
        oldPublicId !==
          uploadedPublicId
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
      message:
        "Service updated successfully",
      service,
    });
  } catch (error) {
    console.error(
      "UPDATE SERVICE ERROR:",
      error
    );

    /* -----------------------------
       CLEANUP NEW IMAGE
    ----------------------------- */

    if (uploadedPublicId) {
      await deleteCloudinaryImage(
        uploadedPublicId
      );
    }

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Service with the same name already exists in this group",
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
   BULK UPLOAD SERVICES
   POST /api/services/bulk-upload

   Supported:
   - .xlsx
   - .xls
   - .csv

   Expected columns:

   serviceGroup
   name
   category
   price
   duration
   description
========================================================= */

export const bulkUploadServices = async (
  req,
  res
) => {
  try {
    const salonId = validateSalonAccess(
      req,
      res
    );

    if (!salonId) return;

    /* -----------------------------
       FILE VALIDATION
    ----------------------------- */

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          "Excel or CSV file is required",
      });
    }

    const originalName =
      req.file.originalname || "";

    const extension =
      originalName
        .split(".")
        .pop()
        ?.toLowerCase();

    const allowedExtensions = [
      "xlsx",
      "xls",
      "csv",
    ];

    if (
      !allowedExtensions.includes(
        extension
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only XLSX, XLS and CSV files are supported",
      });
    }

    /* -----------------------------
       READ FILE

       multer memoryStorage is
       recommended for this endpoint.
    ----------------------------- */

    if (!req.file.buffer) {
      return res.status(400).json({
        success: false,
        message:
          "Uploaded file data is not available",
      });
    }

    const workbook =
      XLSX.read(req.file.buffer, {
        type: "buffer",
      });

    const sheetName =
      workbook.SheetNames[0];

    if (!sheetName) {
      return res.status(400).json({
        success: false,
        message:
          "No worksheet found in uploaded file",
      });
    }

    const worksheet =
      workbook.Sheets[sheetName];

    const rows =
      XLSX.utils.sheet_to_json(
        worksheet,
        {
          defval: "",
          raw: false,
        }
      );

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message:
          "Uploaded file does not contain any service rows",
      });
    }

    /* -----------------------------
       RESULT COUNTERS
    ----------------------------- */

    let created = 0;
    let duplicates = 0;
    let failed = 0;

    const createdServices = [];
    const duplicateRows = [];
    const failedRows = [];

    /* -----------------------------
       PROCESS EACH ROW
    ----------------------------- */

    for (
      let index = 0;
      index < rows.length;
      index++
    ) {
      const row = rows[index];

      const rowNumber =
        index + 2;

      try {
        /* -----------------------------
           SUPPORT DIFFERENT HEADER CASES
        ----------------------------- */

        const name =
          row.name ??
          row.Name ??
          row["Service Name"] ??
          row.serviceName ??
          "";

        const serviceGroup =
          row.serviceGroup ??
          row.ServiceGroup ??
          row["Service Group"] ??
          row.group ??
          row.Group ??
          "General";

        const category =
          row.category ??
          row.Category ??
          "";

        const price =
          row.price ??
          row.Price ??
          row["Service Price"] ??
          "";

        const duration =
          row.duration ??
          row.Duration ??
          row["Duration (min)"] ??
          row["Duration"] ??
          "";

        const description =
          row.description ??
          row.Description ??
          "";

        /* -----------------------------
           REQUIRED NAME
        ----------------------------- */

        if (
          !String(name).trim()
        ) {
          failed++;

          failedRows.push({
            row: rowNumber,
            name: "",
            reason:
              "Service name is required",
          });

          continue;
        }

        /* -----------------------------
           PRICE
        ----------------------------- */

        if (
          price === "" ||
          price === null ||
          price === undefined
        ) {
          failed++;

          failedRows.push({
            row: rowNumber,
            name: String(name).trim(),
            reason:
              "Service price is required",
          });

          continue;
        }

        const numericPrice =
          Number(
            String(price)
              .replace(/,/g, "")
              .replace(/₹/g, "")
              .trim()
          );

        if (
          Number.isNaN(numericPrice) ||
          numericPrice < 0
        ) {
          failed++;

          failedRows.push({
            row: rowNumber,
            name: String(name).trim(),
            reason:
              "Invalid service price",
          });

          continue;
        }

        /* -----------------------------
           DURATION
        ----------------------------- */

        let numericDuration = 30;

        if (
          duration !== "" &&
          duration !== null &&
          duration !== undefined
        ) {
          numericDuration =
            Number(
              String(duration)
                .replace(/min/gi, "")
                .trim()
            );
        }

        if (
          Number.isNaN(
            numericDuration
          ) ||
          numericDuration <= 0
        ) {
          failed++;

          failedRows.push({
            row: rowNumber,
            name: String(name).trim(),
            reason:
              "Invalid service duration",
          });

          continue;
        }

        /* -----------------------------
           NORMALIZE VALUES
        ----------------------------- */

        const normalizedName =
          String(name).trim();

        const normalizedGroup =
          normalizeServiceGroup(
            serviceGroup
          );

        const normalizedCategory =
          String(category || "").trim();

        const normalizedDescription =
          String(description || "").trim();

        /* -----------------------------
           DUPLICATE CHECK

           Duplicate means same:
           salon + serviceGroup + name
        ----------------------------- */

        const existingService =
          await Service.findOne({
            salonId,
            serviceGroup:
              normalizedGroup,
            name: {
              $regex:
                `^${normalizedName.replace(
                  /[.*+?^${}()|[\]\\]/g,
                  "\\$&"
                )}$`,
              $options: "i",
            },
          });

        if (existingService) {
          duplicates++;

          duplicateRows.push({
            row: rowNumber,
            name: normalizedName,
            serviceGroup:
              normalizedGroup,
            reason:
              "Service already exists in this group",
            serviceId:
              existingService._id,
          });

          continue;
        }

        /* -----------------------------
           CREATE SERVICE
        ----------------------------- */

        const service =
          await Service.create({
            salonId,

            name: normalizedName,

            serviceGroup:
              normalizedGroup,

            category:
              normalizedCategory,

            price:
              numericPrice,

            duration:
              numericDuration,

            description:
              normalizedDescription,

            image: {
              url: "",
              publicId: "",
            },

            isActive: true,
          });

        created++;

        createdServices.push(
          service
        );
      } catch (rowError) {
        console.error(
          `BULK SERVICE ROW ${rowNumber} ERROR:`,
          rowError
        );

        /* -----------------------------
           HANDLE DUPLICATE RACE
        ----------------------------- */

        if (
          rowError?.code === 11000
        ) {
          duplicates++;

          duplicateRows.push({
            row: rowNumber,
            name:
              String(
                row.name ??
                  row.Name ??
                  row["Service Name"] ??
                  ""
              ).trim(),
            serviceGroup:
              normalizeServiceGroup(
                row.serviceGroup ??
                  row.ServiceGroup ??
                  row["Service Group"] ??
                  row.group ??
                  row.Group ??
                  "General"
              ),
            reason:
              "Duplicate service",
          });

          continue;
        }

        failed++;

        failedRows.push({
          row: rowNumber,
          name:
            String(
              row.name ??
                row.Name ??
                row["Service Name"] ??
                ""
            ).trim(),
          reason:
            rowError?.message ||
            "Failed to create service",
        });
      }
    }

    /* -----------------------------
       RESPONSE
    ----------------------------- */

    return res.status(200).json({
      success: true,

      message:
        "Service import completed",

      totalRows:
        rows.length,

      created,

      duplicates,

      failed,

      services:
        createdServices,

      duplicateRows,

      failedRows,
    });
  } catch (error) {
    console.error(
      "BULK UPLOAD SERVICES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to import services",
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
    const salonId = validateSalonAccess(
      req,
      res
    );

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

/* =========================================================
   REACTIVATE SERVICE
   PATCH /api/services/:id/reactivate
========================================================= */

export const reactivateService = async (
  req,
  res
) => {
  try {
    const salonId = validateSalonAccess(
      req,
      res
    );

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

/* =========================================================
   DELETE SERVICE
   DELETE /api/services/:id
========================================================= */

export const deleteService = async (
  req,
  res
) => {
  try {
    const salonId = validateSalonAccess(
      req,
      res
    );

    if (!salonId) return;

    const { id } = req.params;

    /* -----------------------------
       FIND ONLY WITHIN CURRENT SALON
    ----------------------------- */

    const service =
      await Service.findOne({
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
      message:
        "Service deleted successfully",
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