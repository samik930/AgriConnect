import bcrypt from "bcryptjs";
import { query } from "../db/index.js";
import generateToken from "../utils/generateToken.js";
import sendEmail from "../utils/sendEmail.js";
import { formatUser } from "../utils/formatters.js";

// Generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendRegistrationOTP = async (req, res) => {
  try {
    const { email, phone } = req.body;

    const existingUser = await query(
      "SELECT id FROM users WHERE email = $1 OR phone = $2 LIMIT 1",
      [email, phone]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: "User already registered" });
    }

    const otp = generateOTP();
    await query("DELETE FROM otps WHERE email = $1", [email]);
    await query(
      "INSERT INTO otps (email, otp, expires_at) VALUES ($1, $2, NOW() + INTERVAL '5 minutes')",
      [email, otp]
    );

    const emailText = `Your OTP for registration is: ${otp}. It is valid for 5 minutes.`;
    await sendEmail(email, "Registration OTP", emailText, `<p>${emailText}</p>`);

    res.status(200).json({ message: "OTP sent successfully to email" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const register = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      role,
      state,
      district,
      address,
      pincode,
      location,
      otp,
    } = req.body;

    if (!otp) {
      return res.status(400).json({ message: "OTP is required for registration" });
    }

    if (role === "admin") {
      return res.status(403).json({ message: "Admin registration is not permitted. Only one system admin can exist." });
    }

    const assignedRole = role === "customer" ? "customer" : "farmer";

    const otpRes = await query(
      "SELECT * FROM otps WHERE email = $1 AND otp = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
      [email, otp]
    );

    if (otpRes.rows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const existingUser = await query(
      "SELECT id FROM users WHERE email = $1 OR phone = $2 LIMIT 1",
      [email, phone]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: "Already Registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let insertQuery;
    let params;

    if (
      location &&
      Array.isArray(location.coordinates) &&
      location.coordinates.length === 2
    ) {
      const [lng, lat] = location.coordinates;
      insertQuery = `
        INSERT INTO users (name, email, phone, password, role, state, district, address, pincode, location)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_SetSRID(ST_MakePoint($10, $11), 4326)::geography)
        RETURNING id, name, email, phone, role, state, district, address, pincode,
                  ST_X(location::geometry) AS location_lng,
                  ST_Y(location::geometry) AS location_lat,
                  created_at, updated_at
      `;
      params = [name, email, phone, hashedPassword, assignedRole, state, district, address, pincode, lng, lat];
    } else {
      insertQuery = `
        INSERT INTO users (name, email, phone, password, role, state, district, address, pincode)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, name, email, phone, role, state, district, address, pincode,
                  NULL AS location_lng, NULL AS location_lat,
                  created_at, updated_at
      `;
      params = [name, email, phone, hashedPassword, assignedRole, state, district, address, pincode];
    }

    const newUserRes = await query(insertQuery, params);
    const user = formatUser(newUserRes.rows[0]);

    // Cleanup used OTP
    await query("DELETE FROM otps WHERE email = $1", [email]);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      state: user.state,
      district: user.district,
      address: user.address,
      pincode: user.pincode,
      location: user.location,
      token: generateToken(res, user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const userRes = await query(
      `SELECT id, name, email, phone, password, role, state, district, address, pincode,
              ST_X(location::geometry) AS location_lng,
              ST_Y(location::geometry) AS location_lat,
              created_at, updated_at
       FROM users
       WHERE email = $1`,
      [email]
    );

    const rawUser = userRes.rows[0];

    if (rawUser && (await bcrypt.compare(password, rawUser.password))) {
      const user = formatUser(rawUser);
      return res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        state: user.state,
        district: user.district,
        address: user.address,
        pincode: user.pincode,
        location: user.location,
        token: generateToken(res, user._id),
      });
    }

    return res.status(401).json({
      message: "Invalid credentials",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const userRes = await query("SELECT id FROM users WHERE email = $1 LIMIT 1", [email]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: "User not found with this email" });
    }

    const otp = generateOTP();
    await query("DELETE FROM otps WHERE email = $1", [email]);
    await query(
      "INSERT INTO otps (email, otp, expires_at) VALUES ($1, $2, NOW() + INTERVAL '5 minutes')",
      [email, otp]
    );

    const emailText = `Your OTP to reset your password is: ${otp}. It is valid for 5 minutes.`;
    await sendEmail(email, "Password Reset OTP", emailText, `<p>${emailText}</p>`);

    res.status(200).json({ message: "Password reset OTP sent successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const otpRes = await query(
      "SELECT * FROM otps WHERE email = $1 AND otp = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
      [email, otp]
    );

    if (otpRes.rows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const userRes = await query("SELECT id FROM users WHERE email = $1 LIMIT 1", [email]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query(
      "UPDATE users SET password = $1, updated_at = NOW() WHERE email = $2",
      [hashedPassword, email]
    );

    await query("DELETE FROM otps WHERE email = $1", [email]);

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const logout = (req, res) => {
  res.cookie("jwt", "", {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ message: "Logged out successfully" });
};

export const updateProfile = async (req, res) => {
  try {
    const { location, state, district, address, pincode } = req.body;
    const userId = req.user._id || req.user.id;

    const setClauses = ["updated_at = NOW()"];
    const values = [];
    let idx = 1;

    if (state !== undefined) {
      setClauses.push(`state = $${idx++}`);
      values.push(state);
    }
    if (district !== undefined) {
      setClauses.push(`district = $${idx++}`);
      values.push(district);
    }
    if (address !== undefined) {
      setClauses.push(`address = $${idx++}`);
      values.push(address);
    }
    if (pincode !== undefined) {
      setClauses.push(`pincode = $${idx++}`);
      values.push(pincode);
    }

    if (
      location &&
      Array.isArray(location.coordinates) &&
      location.coordinates.length === 2
    ) {
      const [lng, lat] = location.coordinates;
      setClauses.push(`location = ST_SetSRID(ST_MakePoint($${idx++}, $${idx++}), 4326)::geography`);
      values.push(lng, lat);
    }

    values.push(userId);
    const updateSql = `
      UPDATE users
      SET ${setClauses.join(", ")}
      WHERE id = $${idx}
      RETURNING id, name, email, phone, role, state, district, address, pincode,
                ST_X(location::geometry) AS location_lng,
                ST_Y(location::geometry) AS location_lat,
                created_at, updated_at
    `;

    const result = await query(updateSql, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const updatedUser = formatUser(result.rows[0]);

    res.status(200).json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      role: updatedUser.role,
      state: updatedUser.state,
      district: updatedUser.district,
      address: updatedUser.address,
      pincode: updatedUser.pincode,
      location: updatedUser.location,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
