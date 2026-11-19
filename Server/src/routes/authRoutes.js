import express from "express";
import {
  register,
  login,
  sendRegistrationOTP,
  forgotPassword,
  resetPassword,
  logout,
  updateProfile
} from "../controllers/authController.js";
import protect from "../middleware/auth.js";

const router = express.Router();

router.post("/send-otp", sendRegistrationOTP);
router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/logout", logout);
router.put("/profile", protect, updateProfile);

export default router;