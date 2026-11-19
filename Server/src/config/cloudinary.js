import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
const apiKey = process.env.CLOUDINARY_API_KEY || "";
const apiSecret = process.env.CLOUDINARY_API_SECRET || "";

const isConfigured = Boolean(
  cloudName &&
  apiKey &&
  apiSecret &&
  !cloudName.includes("your_") &&
  !apiKey.includes("your_") &&
  !apiSecret.includes("your_")
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  console.log("☁️ Cloudinary SDK configured successfully with live credentials.");
} else {
  console.log("ℹ️ Cloudinary running in Developer Simulation mode (Credentials pending in .env).");
}

/**
 * Upload image buffer to Cloudinary (or fallback to Data URI when keys are pending)
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - e.g. 'image/jpeg', 'image/png'
 * @param {string} folder - Destination folder on Cloudinary
 * @returns {Promise<string>} Image URL
 */
export const uploadImage = async (buffer, mimeType = "image/jpeg", folder = "agriconnect_products") => {
  if (isConfigured) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "image",
          transformation: [{ width: 800, height: 800, crop: "limit", quality: "auto" }],
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return reject(error);
          }
          resolve(result.secure_url);
        }
      );
      uploadStream.end(buffer);
    });
  }

  // Developer simulation fallback: convert to base64 Data URI so images render directly in the UI
  const base64Data = buffer.toString("base64");
  return `data:${mimeType};base64,${base64Data}`;
};

export { cloudinary, isConfigured };
export default cloudinary;

