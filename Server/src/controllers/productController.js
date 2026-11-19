import { query } from "../db/index.js";
import { formatProduct } from "../utils/formatters.js";
import { uploadImage } from "../config/cloudinary.js";

const DELIVERY_RADIUS_KM = 50;

// Upload standalone product image to Cloudinary (or Data-URI fallback)
export const uploadProductImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided." });
    }
    const imageUrl = await uploadImage(req.file.buffer, req.file.mimetype);
    return res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      url: imageUrl,
      imageUrl,
    });
  } catch (error) {
    console.error("Cloudinary upload controller error:", error);
    return res.status(500).json({ message: error.message || "Failed to upload image." });
  }
};

// Get products from farmers within delivery radius of given coordinates
// Query: GET /api/products/nearby?lat=22.5726&lng=88.3639
export const getNearbyProducts = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        message: "lat and lng query parameters are required",
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    // Find nearby products from farmers within 50 km using PostGIS ST_DWithin
    const productsRes = await query(
      `
      SELECT 
        p.id, p.farmer_id, p.name, p.category, p.description, p.price, p.stock, p.unit, p.image_url, p.created_at, p.updated_at,
        u.name AS farmer_name, u.email AS farmer_email, u.state AS farmer_state, u.district AS farmer_district,
        ST_X(u.location::geometry) AS farmer_lng,
        ST_Y(u.location::geometry) AS farmer_lat,
        ROUND((ST_Distance(u.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000)::numeric, 1) AS distance_km
      FROM products p
      JOIN users u ON p.farmer_id = u.id
      WHERE u.role = 'farmer'
        AND u.location IS NOT NULL
        AND ST_DWithin(u.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
      ORDER BY distance_km ASC, p.created_at DESC
      `,
      [longitude, latitude, DELIVERY_RADIUS_KM * 1000]
    );

    const formattedProducts = productsRes.rows.map(formatProduct);
    const uniqueFarmers = new Set(productsRes.rows.map((r) => r.farmer_id));

    res.json({
      totalNearbyFarmers: uniqueFarmers.size,
      totalProducts: formattedProducts.length,
      radiusKm: DELIVERY_RADIUS_KM,
      products: formattedProducts,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const createProduct = async (req, res) => {
  try {
    const { name, category, description, price, stock, unit, image, imageUrl, image_url } = req.body;
    const farmerId = req.user._id || req.user.id;

    let finalImageUrl = image_url || imageUrl || image || null;

    if (req.file) {
      try {
        finalImageUrl = await uploadImage(req.file.buffer, req.file.mimetype);
      } catch (uploadErr) {
        console.error("Image upload failed:", uploadErr);
        return res.status(500).json({ message: "Failed to upload product image to Cloudinary." });
      }
    }

    const result = await query(
      `
      INSERT INTO products (farmer_id, name, category, description, price, stock, unit, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [farmerId, name, category, description || null, price, stock, unit || "kg", finalImageUrl]
    );

    res.status(201).json(formatProduct(result.rows[0]));
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        p.id, p.farmer_id, p.name, p.category, p.description, p.price, p.stock, p.unit, p.image_url, p.created_at, p.updated_at,
        u.name AS farmer_name, u.email AS farmer_email, u.district AS farmer_district, u.state AS farmer_state,
        ST_X(u.location::geometry) AS farmer_lng,
        ST_Y(u.location::geometry) AS farmer_lat
      FROM products p
      JOIN users u ON p.farmer_id = u.id
      ORDER BY p.created_at DESC
    `);

    const products = result.rows.map(formatProduct);
    res.json(products);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getProductById = async (req, res) => {
  try {
    const result = await query(
      `
      SELECT 
        p.id, p.farmer_id, p.name, p.category, p.description, p.price, p.stock, p.unit, p.image_url, p.created_at, p.updated_at,
        u.name AS farmer_name, u.email AS farmer_email, u.district AS farmer_district, u.state AS farmer_state,
        ST_X(u.location::geometry) AS farmer_lng,
        ST_Y(u.location::geometry) AS farmer_lat
      FROM products p
      JOIN users u ON p.farmer_id = u.id
      WHERE p.id = $1
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    res.json(formatProduct(result.rows[0]));
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const prodRes = await query("SELECT * FROM products WHERE id = $1", [req.params.id]);

    if (prodRes.rows.length === 0) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    const prod = prodRes.rows[0];
    if (prod.farmer_id !== userId) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    const { name, category, description, price, stock, unit, image, imageUrl, image_url } = req.body;
    const setClauses = ["updated_at = NOW()"];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      values.push(name);
    }
    if (category !== undefined) {
      setClauses.push(`category = $${idx++}`);
      values.push(category);
    }
    if (description !== undefined) {
      setClauses.push(`description = $${idx++}`);
      values.push(description);
    }
    if (price !== undefined) {
      setClauses.push(`price = $${idx++}`);
      values.push(price);
    }
    if (stock !== undefined) {
      setClauses.push(`stock = $${idx++}`);
      values.push(stock);
    }
    if (unit !== undefined) {
      setClauses.push(`unit = $${idx++}`);
      values.push(unit);
    }

    let finalImageUrl = image_url !== undefined ? image_url : (imageUrl !== undefined ? imageUrl : image);

    if (req.file) {
      try {
        finalImageUrl = await uploadImage(req.file.buffer, req.file.mimetype);
      } catch (uploadErr) {
        console.error("Image upload failed:", uploadErr);
        return res.status(500).json({ message: "Failed to upload product image to Cloudinary." });
      }
    }

    if (finalImageUrl !== undefined) {
      setClauses.push(`image_url = $${idx++}`);
      values.push(finalImageUrl);
    }

    values.push(req.params.id);
    const updateSql = `
      UPDATE products
      SET ${setClauses.join(", ")}
      WHERE id = $${idx}
      RETURNING *
    `;

    const updatedRes = await query(updateSql, values);
    res.json(formatProduct(updatedRes.rows[0]));
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const prodRes = await query("SELECT * FROM products WHERE id = $1", [req.params.id]);

    if (prodRes.rows.length === 0) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    const prod = prodRes.rows[0];
    if (prod.farmer_id !== userId && req.user.role !== "admin") {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    await query("DELETE FROM products WHERE id = $1", [req.params.id]);

    res.json({
      message: "Product Deleted",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
