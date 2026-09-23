import multer from "multer";

// ========================================
// MEMORY STORAGE
// ========================================

const storage = multer.memoryStorage();

// ========================================
// IMAGE FILTER
// ========================================

const fileFilter = (req, file, cb) => {
  console.log("\n========================================");
  console.log("           CLIENT IMAGE UPLOAD");
  console.log("========================================");
  console.log("Original Name :", file.originalname);
  console.log("MIME Type     :", file.mimetype);
  console.log("========================================");

  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
    "image/tiff",
    "image/jfif",
  ];

  const extension = file.originalname
    ?.split(".")
    .pop()
    ?.toLowerCase();

  const allowedExtensions = [
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "bmp",
    "tiff",
    "jfif",
  ];

  const valid =
    allowedMimeTypes.includes(file.mimetype) ||
    allowedExtensions.includes(extension);

  if (!valid) {
    return cb(new Error("Only image files are allowed"), false);
  }

  cb(null, true);
};

// ========================================
// MULTER
// ========================================

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export default upload;