import multer from "multer";

// ========================================
// MEMORY STORAGE
// ========================================

const storage = multer.memoryStorage();

// ========================================
// FILE FILTER
// Supports:
// - Images
// - Excel XLSX
// - Excel XLS
// - CSV
// ========================================

const fileFilter = (req, file, cb) => {
  console.log("\n========================================");
  console.log("             FILE UPLOAD");
  console.log("========================================");
  console.log("Field Name    :", file.fieldname);
  console.log("Original Name :", file.originalname);
  console.log("MIME Type     :", file.mimetype);
  console.log("========================================");

  const extension = file.originalname
    ?.split(".")
    .pop()
    ?.toLowerCase();

  // ========================================
  // IMAGE TYPES
  // ========================================

  const allowedImageMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
    "image/tiff",
    "image/jfif",
  ];

  const allowedImageExtensions = [
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "bmp",
    "tiff",
    "jfif",
  ];

  // ========================================
  // EXCEL / CSV TYPES
  // ========================================

  const allowedDocumentMimeTypes = [
    // XLSX
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    // XLS
    "application/vnd.ms-excel",

    // CSV
    "text/csv",

    // Some browsers / clients send CSV as this
    "application/csv",

    // Generic binary type sometimes used for Excel
    "application/octet-stream",
  ];

  const allowedDocumentExtensions = [
    "xlsx",
    "xls",
    "csv",
  ];

  // ========================================
  // CHECK IMAGE
  // ========================================

  const isImage =
    allowedImageMimeTypes.includes(
      file.mimetype
    ) ||
    allowedImageExtensions.includes(
      extension
    );

  // ========================================
  // CHECK EXCEL / CSV
  // ========================================

  const isDocument =
    allowedDocumentMimeTypes.includes(
      file.mimetype
    ) ||
    allowedDocumentExtensions.includes(
      extension
    );

  // ========================================
  // FINAL VALIDATION
  // ========================================

  if (!isImage && !isDocument) {
    console.log(
      "❌ FILE REJECTED:",
      file.originalname
    );

    return cb(
      new Error(
        "Only image, Excel (.xlsx/.xls) and CSV files are allowed"
      ),
      false
    );
  }

  console.log(
    "✅ FILE ACCEPTED:",
    file.originalname
  );

  cb(null, true);
};

// ========================================
// MULTER
// ========================================

const upload = multer({
  storage,

  fileFilter,

  limits: {
    // 10 MB
    fileSize: 10 * 1024 * 1024,
  },
});

export default upload;