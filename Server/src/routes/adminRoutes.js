import express from "express";
import { query } from "../db/index.js";
import protect from "../middleware/auth.js";
import authorize from "../middleware/role.js";
import { formatUser, formatOrder } from "../utils/formatters.js";

const router = express.Router();

router.get("/users", protect, authorize("admin"), async (req, res) => {
  try {
    const usersRes = await query(`
      SELECT id, name, email, phone, role, state, district, address, pincode,
             ST_X(location::geometry) AS location_lng,
             ST_Y(location::geometry) AS location_lat,
             created_at, updated_at
      FROM users
      WHERE role != 'admin'
      ORDER BY created_at DESC
    `);

    const users = usersRes.rows.map(formatUser);
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
});

router.delete("/users/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const currentAdminId = req.user._id || req.user.id;
    if (req.params.id === currentAdminId) {
      return res.status(400).json({ message: "Administrators cannot delete their own account." });
    }

    const deleteRes = await query(
      "DELETE FROM users WHERE id = $1 AND role != 'admin' RETURNING id",
      [req.params.id]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ message: "User not found or cannot delete administrator account" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user", error: error.message });
  }
});

/**
 * Admin: Get all placed orders with complete customer, items, and farmer details
 */
router.get("/orders", protect, authorize("admin"), async (req, res) => {
  try {
    const ordersRes = await query(`
      SELECT 
        o.*,
        u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
      FROM orders o
      LEFT JOIN users u ON o.customer_id = u.id
      ORDER BY o.created_at DESC
    `);

    if (ordersRes.rows.length === 0) {
      return res.json([]);
    }

    const orderIds = ordersRes.rows.map(o => o.id);
    const itemsRes = await query(`
      SELECT 
        oi.*,
        p.name AS product_name, p.category AS product_category, p.unit AS product_unit, p.image_url AS product_image,
        f.name AS farmer_name, f.email AS farmer_email, f.phone AS farmer_phone
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN users f ON oi.farmer_id = f.id
      WHERE oi.order_id = ANY($1::uuid[])
      ORDER BY oi.created_at ASC
    `, [orderIds]);

    const itemsByOrder = {};
    for (const item of itemsRes.rows) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    }

    const formattedOrders = ordersRes.rows.map(orderRow => 
      formatOrder(orderRow, itemsByOrder[orderRow.id] || [])
    );

    res.json(formattedOrders);
  } catch (error) {
    console.error("Admin fetch orders error:", error);
    res.status(500).json({ message: "Failed to fetch orders", error: error.message });
  }
});

/**
 * Admin: Update order status or payment status
 */
router.put("/orders/:id/status", protect, authorize("admin"), async (req, res) => {
  try {
    const { orderStatus, paymentStatus } = req.body;
    const updates = [];
    const values = [];
    let idx = 1;

    if (orderStatus) {
      updates.push(`order_status = $${idx++}`);
      values.push(orderStatus);
    }
    if (paymentStatus) {
      updates.push(`payment_status = $${idx++}`);
      values.push(paymentStatus);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No status fields provided to update." });
    }

    updates.push("updated_at = NOW()");
    values.push(req.params.id);

    const updateRes = await query(
      `UPDATE orders SET ${updates.join(", ")} WHERE id = $${idx} RETURNING id`,
      values
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ message: "Order not found." });
    }

    res.json({ message: "Order status updated successfully." });
  } catch (error) {
    console.error("Admin update order error:", error);
    res.status(500).json({ message: "Failed to update order status", error: error.message });
  }
});

/**
 * Admin: Delete order
 */
router.delete("/orders/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const delRes = await query("DELETE FROM orders WHERE id = $1 RETURNING id", [req.params.id]);
    if (delRes.rows.length === 0) {
      return res.status(404).json({ message: "Order not found." });
    }
    res.json({ message: "Order deleted successfully." });
  } catch (error) {
    console.error("Admin delete order error:", error);
    res.status(500).json({ message: "Failed to delete order", error: error.message });
  }
});

export default router;
