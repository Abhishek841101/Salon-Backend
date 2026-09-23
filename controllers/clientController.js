import Client from "../models/Client.js";
import Bill from "../models/Bill.js";
import cloudinary from "../config/cloudinary.js";

// ========================================
// CLOUDINARY BUFFER UPLOAD
// ========================================

const uploadToCloudinary = (buffer, folder = "salon/clients") => {
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
    console.error(
      "CLOUDINARY DELETE ERROR:",
      error.message
    );
  }
};

// ========================================
// ADD CLIENT
// ========================================

// export const createClient = async (req, res) => {
//   try {
//     const {
//       name,
//       phone,
//       email,
//       gender,
//       dateOfBirth,
//       address,
//       notes,
//     } = req.body;

//     // Required fields
//     if (!name || !phone) {
//       return res.status(400).json({
//         success: false,
//         message: "Client name and phone number are required",
//       });
//     }

//     const normalizedPhone = phone.trim();

//     // Check duplicate phone
//     const existingClient = await Client.findOne({
//       phone: normalizedPhone,
//     });

//     if (existingClient) {
//       return res.status(409).json({
//         success: false,
//         message:
//           "A client with this phone number already exists",
//         client: existingClient,
//       });
//     }

//     // ========================================
//     // PROFILE IMAGE
//     // ========================================

//     let profileImage = {
//       url: "",
//       publicId: "",
//     };

//     if (req.file) {
//       const uploadedImage = await uploadToCloudinary(
//         req.file.buffer
//       );

//       profileImage = {
//         url: uploadedImage.secure_url,
//         publicId: uploadedImage.public_id,
//       };
//     }

//     // ========================================
//     // CREATE CLIENT
//     // ========================================

//     const client = await Client.create({
//       name: name.trim(),
//       phone: normalizedPhone,
//       email: email?.trim().toLowerCase() || "",
//       gender: gender || "",
//       dateOfBirth: dateOfBirth || null,
//       address: address?.trim() || "",
//       notes: notes?.trim() || "",
//       profileImage,
//     });

//     return res.status(201).json({
//       success: true,
//       message: "Client added successfully",
//       client,
//     });
//   } catch (error) {
//     console.error("CREATE CLIENT ERROR:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to create client",
//       error: error.message,
//     });
//   }
// };
export const createClient = async (req, res) => {
  try {
    console.log("\n========================================");
    console.log("          CREATE CLIENT");
    console.log("========================================");

    console.log("REQ BODY :", req.body);
    console.log("REQ FILE :", req.file ? "IMAGE RECEIVED" : "NO IMAGE");

    // ========================================
    // SAFE BODY
    // ========================================

    const body = req.body || {};

    const {
      name,
      phone,
      email = "",
      gender = "",
      dateOfBirth = null,
      address = "",
      notes = "",
    } = body;

    // ========================================
    // REQUIRED FIELDS
    // ========================================

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

    // ========================================
    // CHECK DUPLICATE PHONE
    // ========================================

    const existingClient = await Client.findOne({
      phone: String(phone).trim(),
    });

    if (existingClient) {
      return res.status(409).json({
        success: false,
        message: "Client with this phone number already exists",
      });
    }

    // ========================================
    // IMAGE
    // ========================================

    let profileImage = {
      url: "",
      publicId: "",
    };

    if (req.file) {
      console.log("Uploading image to Cloudinary...");

      /*
        IMPORTANT:
        Yahan apna existing Cloudinary upload function use karo.
        
        Example:
        const result = await uploadToCloudinary(req.file.buffer);

        profileImage = {
          url: result.secure_url,
          publicId: result.public_id,
        };
      */

      const result = await uploadToCloudinary(req.file.buffer);

      profileImage = {
        url: result.secure_url,
        publicId: result.public_id,
      };

      console.log("Cloudinary URL :", result.secure_url);
      console.log("Cloudinary ID  :", result.public_id);
    }

    // ========================================
    // CREATE CLIENT
    // ========================================

    const client = await Client.create({
      name: String(name).trim(),

      phone: String(phone).trim(),

      email: email
        ? String(email).trim().toLowerCase()
        : "",

      gender: gender || "",

      dateOfBirth:
        dateOfBirth && dateOfBirth !== ""
          ? new Date(dateOfBirth)
          : null,

      address: address
        ? String(address).trim()
        : "",

      profileImage,

      notes: notes
        ? String(notes).trim()
        : "",

      isActive: true,

      lastVisitAt: null,

      totalVisits: 0,

      totalSpent: 0,
    });

    // ========================================
    // RESPONSE
    // ========================================

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
    console.error("========================================");

    // Duplicate phone
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
// GET ALL CLIENTS
// ========================================

export const getClients = async (req, res) => {
  try {
    const {
      search = "",
      page = 1,
      limit = 20,
      status = "active",
    } = req.query;

    const currentPage = Math.max(Number(page), 1);

    const perPage = Math.min(
      Math.max(Number(limit), 1),
      100
    );

    const query = {};

    // Status filter
    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
    }

    // Search
    if (search.trim()) {
      const searchText = search.trim();

      query.$or = [
        {
          name: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          phone: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          email: {
            $regex: searchText,
            $options: "i",
          },
        },
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

    return res.status(200).json({
      success: true,
      clients,

      pagination: {
        total,
        page: currentPage,
        limit: perPage,
        totalPages: Math.ceil(total / perPage),
        hasNextPage:
          currentPage < Math.ceil(total / perPage),
        hasPreviousPage: currentPage > 1,
      },
    });
  } catch (error) {
    console.error("GET CLIENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch clients",
    });
  }
};

// ========================================
// GET SINGLE CLIENT
// ========================================

export const getClientById = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findById(id);

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
    });
  }
};

// ========================================
// GET CLIENT VISIT HISTORY
// ========================================

export const getClientHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const bills = await Bill.find({
      client: id,
    })
      .sort({
        billDate: -1,
      })
      .select(
        "invoiceNumber items subtotal discount tax grandTotal paymentMethod paymentStatus notes billDate createdAt"
      );

    const visits = bills.map((bill) => ({
      billId: bill._id,
      invoiceNumber: bill.invoiceNumber,
      date: bill.billDate,

      services: bill.items.map((item) => ({
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
    console.error(
      "GET CLIENT HISTORY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch client history",
    });
  }
};

// ========================================
// UPDATE CLIENT
// ========================================

export const updateClient = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      phone,
      email,
      gender,
      dateOfBirth,
      address,
      notes,
      isActive,
    } = req.body;

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // ========================================
    // PHONE CHANGE
    // ========================================

    if (phone !== undefined) {
      const normalizedPhone = phone.trim();

      const phoneExists = await Client.findOne({
        phone: normalizedPhone,
        _id: { $ne: id },
      });

      if (phoneExists) {
        return res.status(409).json({
          success: false,
          message:
            "Another client already uses this phone number",
        });
      }

      client.phone = normalizedPhone;
    }

    // ========================================
    // UPDATE FIELDS
    // ========================================

    if (name !== undefined) {
      client.name = name.trim();
    }

    if (email !== undefined) {
      client.email = email.trim().toLowerCase();
    }

    if (gender !== undefined) {
      client.gender = gender;
    }

    if (dateOfBirth !== undefined) {
      client.dateOfBirth = dateOfBirth || null;
    }

    if (address !== undefined) {
      client.address = address.trim();
    }

    if (notes !== undefined) {
      client.notes = notes.trim();
    }

    if (isActive !== undefined) {
      client.isActive = Boolean(isActive);
    }

    // ========================================
    // UPDATE PROFILE IMAGE
    // ========================================

    if (req.file) {
      // Upload new image
      const uploadedImage = await uploadToCloudinary(
        req.file.buffer
      );

      // Delete old image
      if (client.profileImage?.publicId) {
        await deleteFromCloudinary(
          client.profileImage.publicId
        );
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
        message: "Phone number already exists",
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
    const { id } = req.params;

    const client = await Client.findById(id);

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
    console.error(
      "DEACTIVATE CLIENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to deactivate client",
    });
  }
};

// ========================================
// REACTIVATE CLIENT
// ========================================

export const reactivateClient = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findById(id);

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
    console.error(
      "REACTIVATE CLIENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to reactivate client",
    });
  }
};

// ========================================
// DELETE CLIENT PERMANENTLY
// ========================================

export const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Delete Cloudinary profile image
    if (client.profileImage?.publicId) {
      await deleteFromCloudinary(
        client.profileImage.publicId
      );
    }

    await Client.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Client deleted permanently",
    });
  } catch (error) {
    console.error("DELETE CLIENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete client",
    });
  }
};