import { query } from "../db/index.js";
import { formatScheme, formatTechnology } from "../utils/formatters.js";

export const Notifyfarmers = async (req, res) => {
  try {
    const farmerId = req.user._id || req.user.id;

    const farmerRes = await query("SELECT id, name, state FROM users WHERE id = $1", [farmerId]);
    if (farmerRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Farmer not found",
      });
    }

    const farmer = farmerRes.rows[0];

    const schemesRes = await query(
      "SELECT * FROM schemes WHERE state = $1 OR state = 'All' ORDER BY created_at DESC",
      [farmer.state]
    );

    const techRes = await query(
      "SELECT * FROM technologies WHERE state = $1 OR state = 'All' ORDER BY created_at DESC",
      [farmer.state]
    );

    return res.status(200).json({
      farmer: farmer.name,
      schemes: schemesRes.rows.map(formatScheme),
      technologies: techRes.rows.map(formatTechnology),
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
