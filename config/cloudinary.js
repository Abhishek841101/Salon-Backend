import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

console.log("");
console.log("=================================");
console.log("       CLOUDINARY CONFIG");
console.log("=================================");
console.log(
  "Cloud Name:",
  cloudinaryConfig.cloud_name ? "Loaded" : "MISSING"
);
console.log(
  "API Key:",
  cloudinaryConfig.api_key ? "Loaded" : "MISSING"
);
console.log(
  "API Secret:",
  cloudinaryConfig.api_secret ? "Loaded" : "MISSING"
);
console.log("=================================");
console.log("");

cloudinary.config(cloudinaryConfig);

export default cloudinary;