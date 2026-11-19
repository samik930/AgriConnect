import { query } from "../db/index.js";
import { formatTechnology } from "../utils/formatters.js";

export const addTechnology = async (req, res) => {
  try {
    const { title, description, state, district, resourceLink } = req.body;
    const publishedBy = req.user?._id || req.user?.id;

    const result = await query(
      `
      INSERT INTO technologies (title, description, state, district, resource_link, published_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        title,
        description,
        state || "All",
        district || null,
        resourceLink || null,
        publishedBy,
      ]
    );

    res.status(201).json({
      success: true,
      technology: formatTechnology(result.rows[0]),
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const showAllTechs = async (req, res) => {
  try {
    const result = await query("SELECT * FROM technologies ORDER BY created_at DESC");
    const technologies = result.rows.map(formatTechnology);

    res.status(200).json({
      success: true,
      technologies,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getTechById = async (req, res) => {
  try {
    const result = await query("SELECT * FROM technologies WHERE id = $1", [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No technology found",
      });
    }

    res.status(200).json({
      success: true,
      technology: formatTechnology(result.rows[0]),
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const updateTechnology = async (req, res) => {
  try {
    const { title, description, state, district, resourceLink } = req.body;

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
    if (resourceLink !== undefined) {
      setClauses.push(`resource_link = $${idx++}`);
      values.push(resourceLink);
    }

    values.push(req.params.id);

    const updateSql = `
      UPDATE technologies
      SET ${setClauses.join(", ")}
      WHERE id = $${idx}
      RETURNING *
    `;

    const result = await query(updateSql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No technology found",
      });
    }

    res.status(200).json({
      success: true,
      technology: formatTechnology(result.rows[0]),
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const deleteTechnology = async (req, res) => {
  try {
    const result = await query(
      "DELETE FROM technologies WHERE id = $1 RETURNING id",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No technology found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Technology deleted",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
