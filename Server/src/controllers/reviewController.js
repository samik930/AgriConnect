import { query } from "../db/index.js";
import { formatReview } from "../utils/formatters.js";

export const createReview = async (req, res) => {
  try {
    const { product, rating, comment } = req.body;
    const customerId = req.user._id || req.user.id;

    const existingRes = await query(
      "SELECT id FROM reviews WHERE customer_id = $1 AND product_id = $2",
      [customerId, product]
    );

    if (existingRes.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Review already done",
      });
    }

    const prodRes = await query("SELECT id FROM products WHERE id = $1", [product]);
    if (prodRes.rows.length === 0) {
      return res.status(404).json({
        message: "Product doesn't exists",
      });
    }

    const insertRes = await query(
      `
      INSERT INTO reviews (customer_id, product_id, rating, comment)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [customerId, product, rating, comment || null]
    );

    const review = formatReview({
      ...insertRes.rows[0],
      customer_name: req.user.name,
    });

    res.status(201).json({
      success: true,
      review,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getProductReviews = async (req, res) => {
  try {
    const reviewsRes = await query(
      `
      SELECT r.*, u.name AS customer_name
      FROM reviews r
      JOIN users u ON r.customer_id = u.id
      WHERE r.product_id = $1
      ORDER BY r.created_at DESC
      `,
      [req.params.productId]
    );

    const reviews = reviewsRes.rows.map(formatReview);

    res.status(201).json({
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const updateReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const customerId = req.user._id || req.user.id;

    const updateRes = await query(
      `
      UPDATE reviews
      SET rating = $1, comment = $2, updated_at = NOW()
      WHERE id = $3 AND customer_id = $4
      RETURNING *
      `,
      [rating, comment || null, req.params.id, customerId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({
        message: "Review doesn't exists.",
      });
    }

    const review = formatReview({
      ...updateRes.rows[0],
      customer_name: req.user.name,
    });

    res.status(201).json({
      message: "Review Updated",
      review,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const customerId = req.user._id || req.user.id;

    const deleteRes = await query(
      "DELETE FROM reviews WHERE id = $1 AND customer_id = $2 RETURNING id",
      [req.params.id, customerId]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(400).json({
        message: "Review doesn't exists",
      });
    }

    res.status(201).json({
      message: "Review Deleted",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
