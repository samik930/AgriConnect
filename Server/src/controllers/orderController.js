import { query, withTransaction } from "../db/index.js";
import { formatOrder } from "../utils/formatters.js";

const DELIVERY_RADIUS_KM = 50;

/**
 * Helper to fetch complete order with items
 */
export const fetchOrderWithItems = async (orderId, client = null) => {
  const q = client ? client.query.bind(client) : query;

  const orderRes = await q(
    `
    SELECT 
      o.*,
      u.name AS customer_name, u.email AS customer_email
    FROM orders o
    LEFT JOIN users u ON o.customer_id = u.id
    WHERE o.id = $1
    `,
    [orderId]
  );

  if (orderRes.rows.length === 0) return null;

  const itemsRes = await q(
    `
    SELECT 
      oi.*,
      p.name AS product_name, p.category AS product_category, p.unit AS product_unit,
      f.name AS farmer_name, f.email AS farmer_email
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN users f ON oi.farmer_id = f.id
    WHERE oi.order_id = $1
    ORDER BY oi.created_at ASC
    `,
    [orderId]
  );

  return formatOrder(orderRes.rows[0], itemsRes.rows);
};

export const createOrder = async (req, res) => {
  try {
    const customerId = req.user._id || req.user.id;
    const customer = req.user;
    const { items, deliveryAddress } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        message: "Cart is empty",
      });
    }

    if (
      !customer.location ||
      !customer.location.coordinates ||
      customer.location.coordinates.length < 2
    ) {
      return res.status(400).json({
        message:
          "Your location is not set. Please update your profile with location coordinates before placing an order.",
      });
    }

    const [cLng, cLat] = customer.location.coordinates;

    // Use managed database transaction for order creation
    const createdOrder = await withTransaction(async (client) => {
      let totalAmount = 0;
      const enrichedItems = [];

      for (const item of items) {
        const prodRes = await client.query(
          `
          SELECT p.*, u.name AS farmer_name,
                 ST_X(u.location::geometry) AS farmer_lng,
                 ST_Y(u.location::geometry) AS farmer_lat
          FROM products p
          LEFT JOIN users u ON p.farmer_id = u.id
          WHERE p.id = $1
          `,
          [item.product]
        );

        if (prodRes.rows.length === 0) {
          throw new Error("Product not found");
        }

        const product = prodRes.rows[0];

        if (product.farmer_lng == null || product.farmer_lat == null) {
          throw new Error(
            `Farmer for product "${product.name}" does not have location coordinates set.`
          );
        }

        // PostGIS distance check
        const distRes = await client.query(
          `SELECT ROUND((ST_Distance(
             ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
             ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
           ) / 1000)::numeric, 1) AS distance_km`,
          [cLng, cLat, product.farmer_lng, product.farmer_lat]
        );

        const distanceKm = parseFloat(distRes.rows[0].distance_km);

        if (distanceKm > DELIVERY_RADIUS_KM) {
          throw new Error(
            `Product "${product.name}" is from farmer "${product.farmer_name}" who is ${distanceKm.toFixed(1)} km away. Delivery is only available within ${DELIVERY_RADIUS_KM} km.`
          );
        }

        const price = parseFloat(product.price);
        const subtotal = price * item.quantity;
        totalAmount += subtotal;

        enrichedItems.push({
          product_id: product.id,
          farmer_id: product.farmer_id,
          quantity: item.quantity,
          price,
          subtotal,
        });
      }

      // Insert Order
      const orderInsertRes = await client.query(
        `
        INSERT INTO orders (customer_id, total_amount, delivery_address, payment_status, order_status)
        VALUES ($1, $2, $3, 'Pending', 'Pending')
        RETURNING id
        `,
        [customerId, totalAmount, deliveryAddress]
      );

      const orderId = orderInsertRes.rows[0].id;

      // Insert Order Items
      for (const item of enrichedItems) {
        await client.query(
          `
          INSERT INTO order_items (order_id, product_id, farmer_id, quantity, price, subtotal)
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [orderId, item.product_id, item.farmer_id, item.quantity, item.price, item.subtotal]
        );
      }

      return fetchOrderWithItems(orderId, client);
    });

    res.status(201).json(createdOrder);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getOrders = async (req, res) => {
  try {
    const customerId = req.user._id || req.user.id;

    const ordersRes = await query(
      `
      SELECT id FROM orders
      WHERE customer_id = $1
      ORDER BY created_at DESC
      `,
      [customerId]
    );

    const orders = await Promise.all(
      ordersRes.rows.map((row) => fetchOrderWithItems(row.id))
    );

    res.json(orders);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const customerId = req.user._id || req.user.id;

    const orderRes = await query(
      "SELECT id FROM orders WHERE id = $1 AND customer_id = $2",
      [req.params.id, customerId]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    const order = await fetchOrderWithItems(req.params.id);
    res.json(order);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getFarmerOrders = async (req, res) => {
  try {
    const farmerId = req.user._id || req.user.id;

    const ordersRes = await query(
      `
      SELECT DISTINCT o.id, o.created_at
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE oi.farmer_id = $1
      ORDER BY o.created_at DESC
      `,
      [farmerId]
    );

    const orders = await Promise.all(
      ordersRes.rows.map((row) => fetchOrderWithItems(row.id))
    );

    res.json(orders);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const farmerId = req.user._id || req.user.id;

    const allowedStatuses = ["Pending", "Accepted", "Packed", "Delivered", "Cancelled"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    const verifyRes = await query(
      `
      SELECT o.id
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1 AND oi.farmer_id = $2
      LIMIT 1
      `,
      [req.params.id, farmerId]
    );

    if (verifyRes.rows.length === 0) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    await query(
      "UPDATE orders SET order_status = $1, updated_at = NOW() WHERE id = $2",
      [status, req.params.id]
    );

    const updatedOrder = await fetchOrderWithItems(req.params.id);
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const updatePaymentStatus = async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    const allowedStatuses = ["Pending", "Paid", "Failed"];

    if (!allowedStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        message: "Invalid payment status",
      });
    }

    const orderRes = await query("SELECT id FROM orders WHERE id = $1", [req.params.id]);

    if (orderRes.rows.length === 0) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    await query(
      "UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE id = $2",
      [paymentStatus, req.params.id]
    );

    const updatedOrder = await fetchOrderWithItems(req.params.id);
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const customerId = req.user._id || req.user.id;

    const orderRes = await query(
      "SELECT * FROM orders WHERE id = $1 AND customer_id = $2",
      [req.params.id, customerId]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    const order = orderRes.rows[0];

    if (order.order_status === "Delivered" || order.order_status === "Cancelled") {
      return res.status(400).json({
        message: "Delivered or Cancelled orders cannot be cancelled",
      });
    }

    await query(
      "UPDATE orders SET order_status = 'Cancelled', updated_at = NOW() WHERE id = $1",
      [req.params.id]
    );

    const updatedOrder = await fetchOrderWithItems(req.params.id);
    res.json({
      message: "Order cancelled successfully",
      order: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
