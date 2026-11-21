import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
};

const sendEmail = async (to, subject, text, html) => {
  try {
    const mailClient = getTransporter();
    const mailOptions = {
      from: `"AgriConnect" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    };

    const info = await mailClient.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error(`[sendEmail] Error sending to ${to}:`, error.message);
    throw error;
  }
};

export default sendEmail;
