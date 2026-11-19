import { query } from "../db/index.js";
import { formatTraining } from "../utils/formatters.js";

/**
 * 1. Create Training (Admin only)
 */
export const createTraining = async (req, res) => {
  try {
    const { title, organizer, date, location, registrationLink } = req.body;

    if (!title || !organizer || !date) {
      return res.status(400).json({
        message: "Title, Organizer, and Workshop Date are required fields.",
      });
    }

    const result = await query(
      `
      INSERT INTO trainings (title, organizer, date, location, registration_link)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [title, organizer, new Date(date), location || null, registrationLink || null]
    );

    res.status(201).json({
      success: true,
      message: "Training workshop created successfully",
      training: formatTraining(result.rows[0]),
    });
  } catch (error) {
    console.error("Create training error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * 2. Get All Trainings (Public for farmers & admins)
 */
export const getAllTrainings = async (req, res) => {
  try {
    const result = await query("SELECT * FROM trainings ORDER BY date ASC");
    const trainings = result.rows.map(formatTraining);

    res.status(200).json({
      success: true,
      trainings,
    });
  } catch (error) {
    console.error("Get trainings error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * 3. Get Single Training by ID
 */
export const getTrainingById = async (req, res) => {
  try {
    const result = await query("SELECT * FROM trainings WHERE id = $1", [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Training workshop not found",
      });
    }

    res.status(200).json({
      success: true,
      training: formatTraining(result.rows[0]),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 4. Update Training (Admin only)
 */
export const updateTraining = async (req, res) => {
  try {
    const { title, organizer, date, location, registrationLink } = req.body;

    const setClauses = ["updated_at = NOW()"];
    const values = [];
    let idx = 1;

    if (title !== undefined) {
      setClauses.push(`title = $${idx++}`);
      values.push(title);
    }
    if (organizer !== undefined) {
      setClauses.push(`organizer = $${idx++}`);
      values.push(organizer);
    }
    if (date !== undefined) {
      setClauses.push(`date = $${idx++}`);
      values.push(new Date(date));
    }
    if (location !== undefined) {
      setClauses.push(`location = $${idx++}`);
      values.push(location);
    }
    if (registrationLink !== undefined) {
      setClauses.push(`registration_link = $${idx++}`);
      values.push(registrationLink);
    }

    values.push(req.params.id);

    const updateSql = `
      UPDATE trainings
      SET ${setClauses.join(", ")}
      WHERE id = $${idx}
      RETURNING *
    `;

    const result = await query(updateSql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Training workshop not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Training workshop updated successfully",
      training: formatTraining(result.rows[0]),
    });
  } catch (error) {
    console.error("Update training error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * 5. Delete Training (Admin only)
 */
export const deleteTraining = async (req, res) => {
  try {
    const result = await query("DELETE FROM trainings WHERE id = $1 RETURNING id", [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Training workshop not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Training workshop deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

