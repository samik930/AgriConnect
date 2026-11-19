/**
 * MongoDB to PostgreSQL (Supabase) Data Migration Script
 * 
 * Usage:
 *   node scripts/migrateData.js
 * 
 * Requirements:
 *   - MONGO_URI in .env
 *   - DATABASE_URL in .env
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { query, pool } from "../src/db/index.js";
import runMigrations from "../src/db/migrate.js";

dotenv.config();

// Convert 24-character Mongo ObjectId into deterministic 36-character UUID
export const mongoIdToUUID = (mongoId) => {
  if (!mongoId) return null;
  const rawHex = mongoId.toString().replace(/[^0-9a-fA-F]/g, "").padStart(24, "0");
  const hex = "00000000" + rawHex; // 32 hex digits
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

async function migrateData() {
  console.log("=== Starting MongoDB to Supabase PostgreSQL Data Migration ===");

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI environment variable is missing.");
  }

  // 1. Ensure PostgreSQL schema is up-to-date
  await runMigrations();

  // 2. Connect to MongoDB
  console.log("Connecting to MongoDB...");
  const mongoConn = await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB successfully.");

  const db = mongoConn.connection.db;

  try {
    // 3. Migrate USERS
    console.log("\n--- Migrating Users ---");
    const mongoUsers = await db.collection("users").find({}).toArray();
    let usersMigrated = 0;

    for (const u of mongoUsers) {
      const id = mongoIdToUUID(u._id);
      const name = u.name || "User";
      const email = u.email;
      const phone = u.phone;
      const password = u.password;
      const role = u.role || "customer";
      const state = u.state || "Default";
      const district = u.district || null;
      const address = u.address || null;
      const pincode = u.pincode || null;
      const createdAt = u.createdAt || new Date();
      const updatedAt = u.updatedAt || new Date();

      let hasCoords = false;
      let lng = null, lat = null;
      if (u.location && Array.isArray(u.location.coordinates) && u.location.coordinates.length === 2) {
        lng = parseFloat(u.location.coordinates[0]);
        lat = parseFloat(u.location.coordinates[1]);
        if (!isNaN(lng) && !isNaN(lat)) {
          hasCoords = true;
        }
      }

      if (hasCoords) {
        await query(
          `
          INSERT INTO users (id, name, email, phone, password, role, state, district, address, pincode, location, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ST_SetSRID(ST_MakePoint($11, $12), 4326)::geography, $13, $14)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            phone = EXCLUDED.phone,
            password = EXCLUDED.password,
            role = EXCLUDED.role,
            state = EXCLUDED.state,
            district = EXCLUDED.district,
            address = EXCLUDED.address,
            pincode = EXCLUDED.pincode,
            location = EXCLUDED.location,
            updated_at = EXCLUDED.updated_at
          `,
          [id, name, email, phone, password, role, state, district, address, pincode, lng, lat, createdAt, updatedAt]
        );
      } else {
        await query(
          `
          INSERT INTO users (id, name, email, phone, password, role, state, district, address, pincode, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            phone = EXCLUDED.phone,
            password = EXCLUDED.password,
            role = EXCLUDED.role,
            state = EXCLUDED.state,
            district = EXCLUDED.district,
            address = EXCLUDED.address,
            pincode = EXCLUDED.pincode,
            updated_at = EXCLUDED.updated_at
          `,
          [id, name, email, phone, password, role, state, district, address, pincode, createdAt, updatedAt]
        );
      }
      usersMigrated++;
    }
    console.log(`Migrated ${usersMigrated} user(s).`);

    // Cache valid user IDs in memory for foreign key checks
    const validUsersRes = await query("SELECT id, role FROM users");
    const validUserIds = new Set(validUsersRes.rows.map((r) => r.id));
    const fallbackAdminId = validUsersRes.rows.find((r) => r.role === "admin")?.id || validUsersRes.rows[0]?.id;

    // 4. Migrate PRODUCTS
    console.log("\n--- Migrating Products ---");
    const mongoProducts = await db.collection("products").find({}).toArray();
    let productsMigrated = 0;
    let productsSkipped = 0;

    for (const p of mongoProducts) {
      const id = mongoIdToUUID(p._id);
      let farmerId = mongoIdToUUID(p.farmer);

      if (!validUserIds.has(farmerId)) {
        console.warn(`⚠️ Warning: Product "${p.name}" (ID: ${p._id}) references non-existent farmer (${p.farmer}). Skipping.`);
        productsSkipped++;
        continue;
      }

      const name = p.name || "Product";
      const category = p.category || "General";
      const description = p.description || null;
      const price = parseFloat(p.price || 0);
      const stock = parseInt(p.stock || 0, 10);
      const unit = p.unit || "kg";
      const createdAt = p.createdAt || new Date();
      const updatedAt = p.updatedAt || new Date();

      await query(
        `
        INSERT INTO products (id, farmer_id, name, category, description, price, stock, unit, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          price = EXCLUDED.price,
          stock = EXCLUDED.stock,
          unit = EXCLUDED.unit,
          updated_at = EXCLUDED.updated_at
        `,
        [id, farmerId, name, category, description, price, stock, unit, createdAt, updatedAt]
      );
      productsMigrated++;
    }
    console.log(`Migrated ${productsMigrated} product(s) (${productsSkipped} orphaned product(s) skipped).`);

    // Cache valid product IDs
    const validProductsRes = await query("SELECT id FROM products");
    const validProductIds = new Set(validProductsRes.rows.map((r) => r.id));

    // 5. Migrate CARTS & CART ITEMS
    console.log("\n--- Migrating Carts ---");
    const mongoCarts = await db.collection("carts").find({}).toArray();
    let cartsMigrated = 0;
    let cartItemsMigrated = 0;

    for (const c of mongoCarts) {
      const cartId = mongoIdToUUID(c._id);
      const customerId = mongoIdToUUID(c.customer);

      if (!validUserIds.has(customerId)) {
        continue;
      }

      await query(
        `
        INSERT INTO carts (id, customer_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (customer_id) DO UPDATE SET updated_at = EXCLUDED.updated_at
        `,
        [cartId, customerId, c.createdAt || new Date(), c.updatedAt || new Date()]
      );
      cartsMigrated++;

      if (Array.isArray(c.items)) {
        for (const item of c.items) {
          if (item && item.product) {
            const productId = mongoIdToUUID(item.product);
            if (!validProductIds.has(productId)) continue;

            const quantity = parseInt(item.quantity || 1, 10);

            await query(
              `
              INSERT INTO cart_items (cart_id, product_id, quantity)
              VALUES ($1, $2, $3)
              ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity
              `,
              [cartId, productId, quantity]
            );
            cartItemsMigrated++;
          }
        }
      }
    }
    console.log(`Migrated ${cartsMigrated} cart(s) with ${cartItemsMigrated} item(s).`);

    // 6. Migrate ORDERS & ORDER ITEMS
    console.log("\n--- Migrating Orders ---");
    const mongoOrders = await db.collection("orders").find({}).toArray();
    let ordersMigrated = 0;
    let orderItemsMigrated = 0;

    for (const o of mongoOrders) {
      const orderId = mongoIdToUUID(o._id);
      const customerId = mongoIdToUUID(o.customer);

      if (!validUserIds.has(customerId)) {
        console.warn(`⚠️ Warning: Order "${orderId}" references non-existent customer. Skipping.`);
        continue;
      }

      const totalAmount = parseFloat(o.totalAmount || 0);
      const deliveryAddress = o.deliveryAddress || "Not specified";
      const paymentStatus = ["Pending", "Paid", "Failed"].includes(o.paymentStatus) ? o.paymentStatus : "Pending";
      const orderStatus = ["Pending", "Accepted", "Packed", "Delivered", "Cancelled"].includes(o.orderStatus) ? o.orderStatus : "Pending";

      await query(
        `
        INSERT INTO orders (id, customer_id, total_amount, delivery_address, payment_status, order_status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          payment_status = EXCLUDED.payment_status,
          order_status = EXCLUDED.order_status,
          updated_at = EXCLUDED.updated_at
        `,
        [orderId, customerId, totalAmount, deliveryAddress, paymentStatus, orderStatus, o.createdAt || new Date(), o.updatedAt || new Date()]
      );
      ordersMigrated++;

      if (Array.isArray(o.items)) {
        for (const item of o.items) {
          const productId = item.product && validProductIds.has(mongoIdToUUID(item.product)) ? mongoIdToUUID(item.product) : null;
          const farmerId = item.farmer && validUserIds.has(mongoIdToUUID(item.farmer)) ? mongoIdToUUID(item.farmer) : null;
          const quantity = parseInt(item.quantity || 1, 10);
          const price = parseFloat(item.price || 0);
          const subtotal = parseFloat(item.subtotal || price * quantity);

          await query(
            `
            INSERT INTO order_items (order_id, product_id, farmer_id, quantity, price, subtotal)
            VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [orderId, productId, farmerId, quantity, price, subtotal]
          );
          orderItemsMigrated++;
        }
      }
    }
    console.log(`Migrated ${ordersMigrated} order(s) with ${orderItemsMigrated} order item(s).`);

    // 7. Migrate REVIEWS
    console.log("\n--- Migrating Reviews ---");
    const mongoReviews = await db.collection("reviews").find({}).toArray();
    let reviewsMigrated = 0;

    for (const r of mongoReviews) {
      const id = mongoIdToUUID(r._id);
      const customerId = mongoIdToUUID(r.customer);
      const productId = mongoIdToUUID(r.product);

      if (!validUserIds.has(customerId) || !validProductIds.has(productId)) {
        continue;
      }

      const rating = parseInt(r.rating || 5, 10);
      const comment = r.comment || null;

      await query(
        `
        INSERT INTO reviews (id, customer_id, product_id, rating, comment, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (customer_id, product_id) DO UPDATE SET
          rating = EXCLUDED.rating,
          comment = EXCLUDED.comment,
          updated_at = EXCLUDED.updated_at
        `,
        [id, customerId, productId, rating, comment, r.createdAt || new Date(), r.updatedAt || new Date()]
      );
      reviewsMigrated++;
    }
    console.log(`Migrated ${reviewsMigrated} review(s).`);

    // 8. Migrate SCHEMES
    console.log("\n--- Migrating Schemes ---");
    const mongoSchemes = await db.collection("schemes").find({}).toArray();
    let schemesMigrated = 0;

    for (const s of mongoSchemes) {
      const id = mongoIdToUUID(s._id);
      const title = s.title || "Scheme";
      const description = s.description || "";
      const state = s.state || "All";
      const district = s.district || null;
      const eligibility = s.eligibility || null;
      const applicationLink = s.applicationLink || null;
      let publishedBy = mongoIdToUUID(s.publishedBy);
      if (!validUserIds.has(publishedBy)) {
        publishedBy = fallbackAdminId;
      }

      await query(
        `
        INSERT INTO schemes (id, title, description, state, district, eligibility, application_link, published_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          state = EXCLUDED.state,
          district = EXCLUDED.district,
          eligibility = EXCLUDED.eligibility,
          application_link = EXCLUDED.application_link,
          updated_at = EXCLUDED.updated_at
        `,
        [id, title, description, state, district, eligibility, applicationLink, publishedBy, s.createdAt || new Date(), s.updatedAt || new Date()]
      );
      schemesMigrated++;
    }
    console.log(`Migrated ${schemesMigrated} scheme(s).`);

    // 9. Migrate TECHNOLOGIES
    console.log("\n--- Migrating Technologies ---");
    const mongoTechs = await db.collection("technologies").find({}).toArray();
    let techsMigrated = 0;

    for (const t of mongoTechs) {
      const id = mongoIdToUUID(t._id);
      const title = t.title || "Technology";
      const description = t.description || "";
      const state = t.state || "All";
      const district = t.district || null;
      const resourceLink = t.resourceLink || null;
      let publishedBy = mongoIdToUUID(t.publishedBy);
      if (!validUserIds.has(publishedBy)) {
        publishedBy = fallbackAdminId;
      }

      await query(
        `
        INSERT INTO technologies (id, title, description, state, district, resource_link, published_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          state = EXCLUDED.state,
          district = EXCLUDED.district,
          resource_link = EXCLUDED.resource_link,
          updated_at = EXCLUDED.updated_at
        `,
        [id, title, description, state, district, resourceLink, publishedBy, t.createdAt || new Date(), t.updatedAt || new Date()]
      );
      techsMigrated++;
    }
    console.log(`Migrated ${techsMigrated} technology(ies).`);

    console.log("\n=== Migration Completed Successfully! ===");
  } catch (err) {
    console.error("Migration failed:", err);
    throw err;
  } finally {
    await mongoose.disconnect();
    await pool.end();
  }
}

migrateData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
