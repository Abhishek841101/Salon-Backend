import Client from "../models/Client.js";
import Bill from "../models/Bill.js";
import XLSX from "xlsx";
import cloudinary from "../config/cloudinary.js";

// ========================================
// CLOUDINARY BUFFER UPLOAD
// ========================================

const uploadToCloudinary = (
  buffer,
  folder = "salon/clients"
) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    stream.end(buffer);
  });
};

// ========================================
// DELETE CLOUDINARY IMAGE
// ========================================

const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("CLOUDINARY DELETE ERROR:", error.message);
  }
};

// ========================================
// GET SALON ID
// ========================================

const getSalonId = (req) => {
  return req.user?.salonId || null;
};

// ========================================
// ADD CLIENT
// ========================================

export const createClient = async (req, res) => {
  try {
    console.log("\n========================================");
    console.log("          CREATE CLIENT");
    console.log("========================================");
    console.log("REQ BODY :", req.body);
    console.log(
      "REQ FILE :",
      req.file ? "IMAGE RECEIVED" : "NO IMAGE"
    );

    const salonId = getSalonId(req);

    if (!salonId) {
      return res.status(403).json({
        success: false,
        message: "Salon ID is missing from authenticated user",
      });
    }

    const body = req.body || {};

    const {
      name,
      phone,
      email = "",
      gender = "",
      dateOfBirth = null,
      anniversaryDate = null,
      address = "",
      notes = "",
    } = body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Client name is required",
      });
    }

    if (!phone || !String(phone).trim()) {
      return res.status(400).json({
        success: false,
        message: "Client phone number is required",
      });
    }

    const normalizedPhone = String(phone).trim();

    const existingClient = await Client.findOne({
      salonId,
      phone: normalizedPhone,
    });

    if (existingClient) {
      return res.status(409).json({
        success: false,
        message: "Client with this phone number already exists",
      });
    }

    let profileImage = {
      url: "",
      publicId: "",
    };

    if (req.file) {
      console.log("Uploading image to Cloudinary...");

      const result = await uploadToCloudinary(req.file.buffer);

      profileImage = {
        url: result.secure_url,
        publicId: result.public_id,
      };

      console.log("Cloudinary URL :", result.secure_url);
      console.log("Cloudinary ID  :", result.public_id);
    }

    const client = await Client.create({
      salonId,
      name: String(name).trim(),
      phone: normalizedPhone,
      email: email ? String(email).trim().toLowerCase() : "",
      gender: gender || "",
      dateOfBirth:
        dateOfBirth && dateOfBirth !== ""
          ? new Date(dateOfBirth)
          : null,
      anniversaryDate:
        anniversaryDate && anniversaryDate !== ""
          ? new Date(anniversaryDate)
          : null,
      address: address ? String(address).trim() : "",
      profileImage,
      notes: notes ? String(notes).trim() : "",
      isActive: true,
      lastVisitAt: null,
      totalVisits: 0,
      totalSpent: 0,
    });

    console.log("CLIENT CREATED :", client._id);

    return res.status(201).json({
      success: true,
      message: "Client created successfully",
      client,
    });
  } catch (error) {
    console.error("\n========================================");
    console.error("       CREATE CLIENT ERROR");
    console.error("========================================");
    console.error(error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Client with this phone number already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create client",
      error: error.message,
    });
  }
};

// ========================================
// BULK IMPORT HELPERS
// ========================================

const normalizeImportHeader = (header) => {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
};

const parseImportDate = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  // Excel dates may be stored as serial numbers.
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (!parsed) return null;

    return new Date(
      Date.UTC(parsed.y, parsed.m - 1, parsed.d)
    );
  }

  const text = String(value).trim();

  if (!text) return null;

  // Support YYYY-MM-DD and common date strings.
  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

// ========================================
// BULK ADD CLIENTS FROM EXCEL / CSV
// POST /api/clients/bulk
// ========================================

export const bulkImportClients = async (req, res) => {
  try {
    const salonId = getSalonId(req);

    if (!salonId) {
      return res.status(403).json({
        success: false,
        message: "Salon ID is missing from authenticated user",
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "Please upload an Excel or CSV file using field name 'file'",
      });
    }

    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      cellDates: true,
    });

    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return res.status(400).json({
        success: false,
        message: "The uploaded file does not contain a worksheet",
      });
    }

    const worksheet = workbook.Sheets[firstSheetName];

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
      raw: false,
    });

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "The uploaded file is empty",
      });
    }

    const MAX_ROWS = 5000;

    if (rows.length > MAX_ROWS) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_ROWS} client rows are allowed per import`,
      });
    }

    const errors = [];
    const validRows = [];
    const seenPhones = new Set();

    const getValue = (row, aliases) => {
      const normalizedRow = {};

      for (const [key, value] of Object.entries(row)) {
        normalizedRow[normalizeImportHeader(key)] = value;
      }

      for (const alias of aliases) {
        const key = normalizeImportHeader(alias);

        if (
          normalizedRow[key] !== undefined &&
          normalizedRow[key] !== null
        ) {
          return normalizedRow[key];
        }
      }

      return "";
    };

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;

      const name = String(
        getValue(row, ["name", "client name", "client"])
      ).trim();

      const phone = String(
        getValue(row, [
          "phone",
          "mobile",
          "mobile number",
          "phone number",
        ])
      ).trim();

      const email = String(
        getValue(row, ["email", "email address"])
      ).trim().toLowerCase();

      const gender = String(
        getValue(row, ["gender"])
      ).trim();

      const address = String(
        getValue(row, ["address"])
      ).trim();

      const notes = String(
        getValue(row, ["notes", "note"])
      ).trim();

      const rawDob = getValue(row, [
        "dateOfBirth",
        "date of birth",
        "dob",
        "birth date",
      ]);

      const rawAnniversary = getValue(row, [
        "anniversaryDate",
        "anniversary date",
        "anniversary",
      ]);

      if (!name) {
        errors.push({
          row: rowNumber,
          phone,
          message: "Client name is required",
        });
        continue;
      }

      if (!phone) {
        errors.push({
          row: rowNumber,
          name,
          message: "Phone number is required",
        });
        continue;
      }

      if (name.length > 100) {
        errors.push({
          row: rowNumber,
          name,
          phone,
          message: "Name cannot exceed 100 characters",
        });
        continue;
      }

      if (notes.length > 1000) {
        errors.push({
          row: rowNumber,
          name,
          phone,
          message: "Notes cannot exceed 1000 characters",
        });
        continue;
      }

      if (
        gender &&
        !["Male", "Female", "Other"].includes(gender)
      ) {
        errors.push({
          row: rowNumber,
          name,
          phone,
          message: "Gender must be Male, Female, or Other",
        });
        continue;
      }

      if (seenPhones.has(phone)) {
        errors.push({
          row: rowNumber,
          name,
          phone,
          message: "Duplicate phone number in uploaded file",
        });
        continue;
      }

      seenPhones.add(phone);

      const dateOfBirth = parseImportDate(rawDob);
      const anniversaryDate = parseImportDate(rawAnniversary);

      if (rawDob && !dateOfBirth) {
        errors.push({
          row: rowNumber,
          name,
          phone,
          message: "Invalid date of birth",
        });
        continue;
      }

      if (rawAnniversary && !anniversaryDate) {
        errors.push({
          row: rowNumber,
          name,
          phone,
          message: "Invalid anniversary date",
        });
        continue;
      }

      validRows.push({
        rowNumber,
        name,
        phone,
        email,
        gender,
        address,
        notes,
        dateOfBirth,
        anniversaryDate,
      });
    }

    if (!validRows.length) {
      return res.status(200).json({
        success: true,
        message: "No valid clients found to import",
        summary: {
          totalRows: rows.length,
          imported: 0,
          skipped: errors.length,
        },
        clients: [],
        errors,
      });
    }

    const phones = validRows.map((row) => row.phone);

    const existingClients = await Client.find({
      salonId,
      phone: { $in: phones },
    }).select("phone");

    const existingPhones = new Set(
      existingClients.map((client) => String(client.phone).trim())
    );

    const clientsToCreate = [];

    for (const row of validRows) {
      if (existingPhones.has(row.phone)) {
        errors.push({
          row: row.rowNumber,
          name: row.name,
          phone: row.phone,
          message: "Phone number already exists in this salon",
        });
        continue;
      }

      clientsToCreate.push({
        salonId,
        name: row.name,
        phone: row.phone,
        email: row.email,
        gender: row.gender || "",
        dateOfBirth: row.dateOfBirth,
        anniversaryDate: row.anniversaryDate,
        address: row.address,
        notes: row.notes,
        profileImage: {
          url: "",
          publicId: "",
        },
        isActive: true,
        lastVisitAt: null,
        totalVisits: 0,
        totalSpent: 0,
      });
    }

    let importedClients = [];

    if (clientsToCreate.length) {
      try {
        importedClients = await Client.insertMany(
          clientsToCreate,
          { ordered: false }
        );
      } catch (insertError) {
        // With ordered:false, MongoDB may insert valid documents
        // and report duplicate/invalid documents in writeErrors.
        importedClients = insertError.insertedDocs || [];

        if (!importedClients.length && !insertError.writeErrors) {
          throw insertError;
        }

        const writeErrors = insertError.writeErrors || [];

        for (const writeError of writeErrors) {
          const failedIndex =
            writeError.index !== undefined
              ? writeError.index
              : -1;

          const failedRow =
            failedIndex >= 0
              ? clientsToCreate[failedIndex]
              : null;

          errors.push({
            name: failedRow?.name || "",
            phone: failedRow?.phone || "",
            message:
              writeError.errmsg ||
              writeError.message ||
              "Client could not be imported",
          });
        }
      }
    }

    const skipped = Math.max(
      rows.length - importedClients.length,
      errors.length
    );

    return res.status(200).json({
      success: true,
      message: "Bulk client import completed",
      summary: {
        totalRows: rows.length,
        imported: importedClients.length,
        skipped,
      },
      clients: importedClients,
      errors,
    });
  } catch (error) {
    console.error("BULK IMPORT CLIENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to import clients",
      error: error.message,
    });
  }
};
// ========================================
// GET ALL CLIENTS
// ========================================

export const getClients = async (req, res) => {
  try {
    const salonId = getSalonId(req);

    if (!salonId) {
      return res.status(403).json({
        success: false,
        message: "Salon ID is missing from authenticated user",
      });
    }

    const {
      search = "",
      page = 1,
      limit = 20,
      status = "active",
    } = req.query;

    const currentPage = Math.max(Number(page) || 1, 1);
    const perPage = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const query = { salonId };

    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
    }

    if (String(search).trim()) {
      const searchText = String(search).trim();

      query.$or = [
        { name: { $regex: searchText, $options: "i" } },
        { phone: { $regex: searchText, $options: "i" } },
        { email: { $regex: searchText, $options: "i" } },
      ];
    }

    const skip = (currentPage - 1) * perPage;

    const [clients, total] = await Promise.all([
      Client.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(perPage),
      Client.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return res.status(200).json({
      success: true,
      clients,
      pagination: {
        total,
        page: currentPage,
        limit: perPage,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
    });
  } catch (error) {
    console.error("GET CLIENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch clients",
      error: error.message,
    });
  }
};

// ========================================
// GET SINGLE CLIENT
// ========================================

export const getClientById = async (req, res) => {
  try {
    const salonId = getSalonId(req);

    if (!salonId) {
      return res.status(403).json({
        success: false,
        message: "Salon ID is missing from authenticated user",
      });
    }

    const { id } = req.params;

    const client = await Client.findOne({
      _id: id,
      salonId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    return res.status(200).json({
      success: true,
      client,
    });
  } catch (error) {
    console.error("GET CLIENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch client",
      error: error.message,
    });
  }
};

// ========================================
// GET CLIENT VISIT HISTORY
// ========================================

export const getClientHistory = async (req, res) => {
  try {
    const salonId = getSalonId(req);

    if (!salonId) {
      return res.status(403).json({
        success: false,
        message: "Salon ID is missing from authenticated user",
      });
    }

    const { id } = req.params;

    const client = await Client.findOne({
      _id: id,
      salonId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const bills = await Bill.find({
      salonId,
      client: id,
    })
      .sort({ billDate: -1 })
      .select(
        "invoiceNumber items subtotal discount tax grandTotal paymentMethod paymentStatus notes billDate createdAt"
      );

    const visits = bills.map((bill) => ({
      billId: bill._id,
      invoiceNumber: bill.invoiceNumber,
      date: bill.billDate,
      services: (bill.items || []).map((item) => ({
        serviceId: item.service,
        serviceName: item.serviceName,
        price: item.price,
        quantity: item.quantity,
        duration: item.duration,
        total: item.total,
      })),
      subtotal: bill.subtotal,
      discount: bill.discount,
      tax: bill.tax,
      grandTotal: bill.grandTotal,
      paymentMethod: bill.paymentMethod,
      paymentStatus: bill.paymentStatus,
      notes: bill.notes,
    }));

    return res.status(200).json({
      success: true,
      client: {
        id: client._id,
        name: client.name,
        phone: client.phone,
        email: client.email,
        gender: client.gender,
        dateOfBirth: client.dateOfBirth,
        anniversaryDate: client.anniversaryDate,
        address: client.address,
        profileImage: client.profileImage,
        isActive: client.isActive,
        lastVisitAt: client.lastVisitAt,
        totalVisits: client.totalVisits,
        totalSpent: client.totalSpent,
      },
      summary: {
        totalVisits: client.totalVisits,
        totalSpent: client.totalSpent,
        lastVisitAt: client.lastVisitAt,
        totalBills: bills.length,
      },
      visits,
    });
  } catch (error) {
    console.error("GET CLIENT HISTORY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch client history",
      error: error.message,
    });
  }
};

// ========================================
// UPDATE CLIENT
// ========================================

export const updateClient = async (req, res) => {
  try {
    const salonId = getSalonId(req);

    if (!salonId) {
      return res.status(403).json({
        success: false,
        message: "Salon ID is missing from authenticated user",
      });
    }

    const { id } = req.params;

    const {
      name,
      phone,
      email,
      gender,
      dateOfBirth,
      anniversaryDate,
      address,
      notes,
      isActive,
    } = req.body;

    const client = await Client.findOne({
      _id: id,
      salonId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    if (phone !== undefined) {
      const normalizedPhone = String(phone).trim();

      if (!normalizedPhone) {
        return res.status(400).json({
          success: false,
          message: "Client phone number cannot be empty",
        });
      }

      const phoneExists = await Client.findOne({
        salonId,
        phone: normalizedPhone,
        _id: { $ne: id },
      });

      if (phoneExists) {
        return res.status(409).json({
          success: false,
          message: "Another client already uses this phone number",
        });
      }

      client.phone = normalizedPhone;
    }

    if (name !== undefined) {
      const normalizedName = String(name).trim();

      if (!normalizedName) {
        return res.status(400).json({
          success: false,
          message: "Client name cannot be empty",
        });
      }

      client.name = normalizedName;
    }

    if (email !== undefined) {
      client.email = email
        ? String(email).trim().toLowerCase()
        : "";
    }

    if (gender !== undefined) {
      client.gender = gender || "";
    }

    if (dateOfBirth !== undefined) {
      client.dateOfBirth = dateOfBirth
        ? new Date(dateOfBirth)
        : null;
    }

    if (anniversaryDate !== undefined) {
      client.anniversaryDate = anniversaryDate
        ? new Date(anniversaryDate)
        : null;
    }

    if (address !== undefined) {
      client.address = address ? String(address).trim() : "";
    }

    if (notes !== undefined) {
      client.notes = notes ? String(notes).trim() : "";
    }

    if (isActive !== undefined) {
      client.isActive = Boolean(isActive);
    }

    if (req.file) {
      const uploadedImage = await uploadToCloudinary(req.file.buffer);

      if (client.profileImage?.publicId) {
        await deleteFromCloudinary(client.profileImage.publicId);
      }

      client.profileImage = {
        url: uploadedImage.secure_url,
        publicId: uploadedImage.public_id,
      };
    }

    await client.save();

    return res.status(200).json({
      success: true,
      message: "Client updated successfully",
      client,
    });
  } catch (error) {
    console.error("UPDATE CLIENT ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Phone number already exists in this salon",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update client",
      error: error.message,
    });
  }
};
// ========================================
// DEACTIVATE CLIENT
// ========================================

export const deactivateClient = async (req, res) => {
  try {
    const salonId = getSalonId(req);

    if (!salonId) {
      return res.status(403).json({
        success: false,
        message: "Salon ID is missing from authenticated user",
      });
    }

    const { id } = req.params;

    const client = await Client.findOne({
      _id: id,
      salonId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    client.isActive = false;
    await client.save();

    return res.status(200).json({
      success: true,
      message: "Client deactivated successfully",
      client,
    });
  } catch (error) {
    console.error("DEACTIVATE CLIENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to deactivate client",
      error: error.message,
    });
  }
};

// ========================================
// REACTIVATE CLIENT
// ========================================

export const reactivateClient = async (req, res) => {
  try {
    const salonId = getSalonId(req);

    if (!salonId) {
      return res.status(403).json({
        success: false,
        message: "Salon ID is missing from authenticated user",
      });
    }

    const { id } = req.params;

    const client = await Client.findOne({
      _id: id,
      salonId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    client.isActive = true;
    await client.save();

    return res.status(200).json({
      success: true,
      message: "Client reactivated successfully",
      client,
    });
  } catch (error) {
    console.error("REACTIVATE CLIENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reactivate client",
      error: error.message,
    });
  }
};

// ========================================
// DELETE CLIENT PERMANENTLY
// ========================================

export const deleteClient = async (req, res) => {
  try {
    const salonId = getSalonId(req);

    if (!salonId) {
      return res.status(403).json({
        success: false,
        message: "Salon ID is missing from authenticated user",
      });
    }

    const { id } = req.params;

    const client = await Client.findOne({
      _id: id,
      salonId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    if (client.profileImage?.publicId) {
      await deleteFromCloudinary(client.profileImage.publicId);
    }

    await Client.deleteOne({
      _id: id,
      salonId,
    });

    return res.status(200).json({
      success: true,
      message: "Client deleted permanently",
    });
  } catch (error) {
    console.error("DELETE CLIENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete client",
      error: error.message,
    });
  }
};