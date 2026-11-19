import Razorpay from "razorpay";
import dotenv from "dotenv";

dotenv.config();

const keyId = process.env.RAZORPAY_KEY_ID || "";
const keySecret = process.env.RAZORPAY_KEY_SECRET || "";

// Credentials are considered configured if present and not default placeholders
const isConfigured = Boolean(
  keyId &&
  keySecret &&
  !keyId.includes("placeholder") &&
  !keySecret.includes("placeholder")
);

let razorpayInstance = null;
if (isConfigured) {
  try {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
    console.log("💳 Razorpay payment gateway initialized successfully with live/test key.");
  } catch (err) {
    console.warn("⚠️ Razorpay initialization warning:", err.message);
  }
} else {
  console.log("ℹ️ Razorpay running in Developer/Test Simulation mode (Credentials pending in .env).");
}

export { razorpayInstance, isConfigured, keyId, keySecret };
export default razorpayInstance;

