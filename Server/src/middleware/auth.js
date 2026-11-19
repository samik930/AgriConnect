import jwt from "jsonwebtoken";
import { query } from "../db/index.js";
import { formatUser } from "../utils/formatters.js";

const protect = async (req, res, next) => {
  try {
    let token = req.cookies?.jwt;
    if (!token && req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userRes = await query(
      `SELECT id, name, email, phone, role, state, district, address, pincode,
              ST_X(location::geometry) AS location_lng,
              ST_Y(location::geometry) AS location_lat,
              created_at, updated_at
       FROM users
       WHERE id = $1`,
      [decoded.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        message: "User no longer exists",
      });
    }

    req.user = formatUser(userRes.rows[0]);
    next();
  } catch (error) {
    res.status(401).json({
      message: "Invalid Token",
    });
  }
};

export const optionalProtect = async (req, res, next) => {
  try {
    let token = req.cookies?.jwt;
    if (!token && req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userRes = await query(
      `SELECT id, name, email, phone, role, state, district, address, pincode,
              ST_X(location::geometry) AS location_lng,
              ST_Y(location::geometry) AS location_lat,
              created_at, updated_at
       FROM users
       WHERE id = $1`,
      [decoded.id]
    );

    if (userRes.rows.length > 0) {
      req.user = formatUser(userRes.rows[0]);
    }
    next();
  } catch {
    next();
  }
};

export default protect;
