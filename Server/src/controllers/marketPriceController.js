import { query } from "../db/index.js";
import { formatMarketPrice } from "../utils/formatters.js";

/**
 * 1. Create APMC / Mandi Benchmark Market Price (Admin only)
 */
export const createMarketPrice = async (req, res) => {
  try {
    const { cropName, district, marketPrice, unit } = req.body;

    if (!cropName || !district || marketPrice === undefined) {
      return res.status(400).json({
        message: "Crop name, district, and benchmark market price are required fields.",
      });
    }

    const price = parseFloat(marketPrice);
    if (isNaN(price) || price < 0) {
      return res.status(400).json({
        message: "Market price must be a valid non-negative number.",
      });
    }

    const result = await query(
      `
      INSERT INTO market_prices (crop_name, district, market_price, unit, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
      `,
      [cropName.trim(), district.trim(), price, unit || "kg"]
    );

    res.status(201).json({
      success: true,
      message: "Benchmark APMC market price created successfully",
      marketPrice: formatMarketPrice(result.rows[0]),
    });
  } catch (error) {
    console.error("Create market price error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * 2. Get All APMC / Mandi Market Prices (Public)
 * Allows optional filtering by ?crop=... and ?district=...
 */
export const getAllMarketPrices = async (req, res) => {
  try {
    const { crop, district } = req.query;
    const conditions = [];
    const values = [];
    let idx = 1;

    if (crop) {
      conditions.push(`crop_name ILIKE $${idx++}`);
      values.push(`%${crop.trim()}%`);
    }

    if (district) {
      conditions.push(`district ILIKE $${idx++}`);
      values.push(`%${district.trim()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT * FROM market_prices ${whereClause} ORDER BY crop_name ASC, district ASC`;

    const result = await query(sql, values);
    const marketPrices = result.rows.map(formatMarketPrice);

    res.status(200).json({
      success: true,
      count: marketPrices.length,
      marketPrices,
    });
  } catch (error) {
    console.error("Get market prices error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * 3. Get Single Market Price by ID
 */
export const getMarketPriceById = async (req, res) => {
  try {
    const result = await query("SELECT * FROM market_prices WHERE id = $1", [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Market price benchmark not found",
      });
    }

    res.status(200).json({
      success: true,
      marketPrice: formatMarketPrice(result.rows[0]),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 4. Update Market Price (Admin only)
 */
export const updateMarketPrice = async (req, res) => {
  try {
    const { cropName, district, marketPrice, unit } = req.body;

    const setClauses = ["updated_at = NOW()"];
    const values = [];
    let idx = 1;

    if (cropName !== undefined) {
      setClauses.push(`crop_name = $${idx++}`);
      values.push(cropName.trim());
    }
    if (district !== undefined) {
      setClauses.push(`district = $${idx++}`);
      values.push(district.trim());
    }
    if (marketPrice !== undefined) {
      const price = parseFloat(marketPrice);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ message: "Market price must be a valid non-negative number." });
      }
      setClauses.push(`market_price = $${idx++}`);
      values.push(price);
    }
    if (unit !== undefined) {
      setClauses.push(`unit = $${idx++}`);
      values.push(unit);
    }

    values.push(req.params.id);

    const updateSql = `
      UPDATE market_prices
      SET ${setClauses.join(", ")}
      WHERE id = $${idx}
      RETURNING *
    `;

    const result = await query(updateSql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Market price benchmark not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Benchmark APMC market price updated successfully",
      marketPrice: formatMarketPrice(result.rows[0]),
    });
  } catch (error) {
    console.error("Update market price error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * 5. Delete Market Price (Admin only)
 */
export const deleteMarketPrice = async (req, res) => {
  try {
    const result = await query("DELETE FROM market_prices WHERE id = $1 RETURNING id", [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Market price benchmark not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Benchmark market price deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

