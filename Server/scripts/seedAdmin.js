import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { query, pool } from "../src/db/index.js";

dotenv.config();

const ADMIN_EMAIL = "admin@agriconnect.com";
const ADMIN_PASSWORD = "Admin@Agri2026!";
const ADMIN_NAME = "System Administrator";
const ADMIN_PHONE = "+910000000000";

async function seedAdmin() {
  console.log("=== Checking / Creating Single Admin User ===");

  try {
    // 1. Check if an admin already exists
    const existingAdminRes = await query(
      "SELECT id, name, email, role FROM users WHERE role = 'admin' LIMIT 1"
    );

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    if (existingAdminRes.rows.length > 0) {
      const current = existingAdminRes.rows[0];
      console.log(`An admin user already exists: ${current.email} (ID: ${current.id}).`);
      console.log(`Updating password and credentials for: ${ADMIN_EMAIL}...`);

      const updateRes = await query(
        `
        UPDATE users
        SET email = $1, password = $2, name = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING id, name, email, role
        `,
        [ADMIN_EMAIL, hashedPassword, ADMIN_NAME, current.id]
      );

      console.log("Admin user credentials updated successfully!");
    } else {
      console.log(`No admin found. Creating new admin user: ${ADMIN_EMAIL}...`);

      const insertRes = await query(
        `
        INSERT INTO users (name, email, phone, password, role, state, district, address, pincode)
        VALUES ($1, $2, $3, $4, 'admin', 'West Bengal', 'Kolkata', 'AgriConnect HQ', '700001')
        RETURNING id, name, email, role
        `,
        [ADMIN_NAME, ADMIN_EMAIL, ADMIN_PHONE, hashedPassword]
      );

      console.log("Admin user created successfully! ID:", insertRes.rows[0].id);
    }

    console.log("\n==============================================");
    console.log("   ADMIN LOGIN CREDENTIALS:");
    console.log("   Email:    " + ADMIN_EMAIL);
    console.log("   Password: " + ADMIN_PASSWORD);
    console.log("==============================================\n");
  } catch (error) {
    console.error("Error seeding admin:", error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

seedAdmin()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

