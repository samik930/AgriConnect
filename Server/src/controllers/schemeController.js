import { query } from "../db/index.js";
import { formatScheme } from "../utils/formatters.js";
import { broadcastNewScheme } from "../utils/emailNotifier.js";

export const CreateScheme = async (req, res) => {
  try {
    const { title, description, state, district, eligibility, applicationLink } = req.body;
    const publishedBy = req.user?._id || req.user?.id;

    const result = await query(
      `
      INSERT INTO schemes (title, description, state, district, eligibility, application_link, published_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        title,
        description,
        state,
        district || null,
        eligibility || null,
        applicationLink || null,
        publishedBy,
      ]
    );

    const formatted = formatScheme(result.rows[0]);

    // Send real-time Gmail notification to all registered farmers
    broadcastNewScheme(formatted);

    res.status(201).json({
      success: true,
      scheme: formatted,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getAllSchemes = async (req, res) => {
  try {
    const result = await query("SELECT * FROM schemes ORDER BY created_at DESC");
    const schemes = result.rows.map(formatScheme);

    res.status(200).json({
      success: true,
      schemes,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getSchemeById = async (req, res) => {
  try {
    const result = await query("SELECT * FROM schemes WHERE id = $1", [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Scheme not found",
      });
    }

    res.status(200).json({
      success: true,
      scheme: formatScheme(result.rows[0]),
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const updateScheme = async (req, res) => {
  try {
    const { title, description, state, district, eligibility, applicationLink } = req.body;

    const setClauses = ["updated_at = NOW()"];
    const values = [];
    let idx = 1;

    if (title !== undefined) {
      setClauses.push(`title = $${idx++}`);
      values.push(title);
    }
    if (description !== undefined) {
      setClauses.push(`description = $${idx++}`);
      values.push(description);
    }
    if (state !== undefined) {
      setClauses.push(`state = $${idx++}`);
      values.push(state);
    }
    if (district !== undefined) {
      setClauses.push(`district = $${idx++}`);
      values.push(district);
    }
    if (eligibility !== undefined) {
      setClauses.push(`eligibility = $${idx++}`);
      values.push(eligibility);
    }
    if (applicationLink !== undefined) {
      setClauses.push(`application_link = $${idx++}`);
      values.push(applicationLink);
    }

    values.push(req.params.id);

    const updateSql = `
      UPDATE schemes
      SET ${setClauses.join(", ")}
      WHERE id = $${idx}
      RETURNING *
    `;

    const result = await query(updateSql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Scheme Not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Scheme updated",
      scheme: formatScheme(result.rows[0]),
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const deleteScheme = async (req, res) => {
  try {
    const result = await query("DELETE FROM schemes WHERE id = $1 RETURNING id", [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Scheme not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Scheme deleted",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
