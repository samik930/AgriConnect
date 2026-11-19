import crypto from "crypto";
import { query, withTransaction } from "../db/index.js";
import { fetchOrderWithItems } from "./orderController.js";
import { razorpayInstance, isConfigured, keyId, keySecret } from "../config/razorpay.js";

const DELIVERY_RADIUS_KM = 50;

/**
 * 1. Get Payment Configuration Status
 */
export const getPaymentConfig = async (req, res) => {
  try {
    return res.status(200).json({
      isConfigured,
      keyId: isConfigured ? keyId : "rzp_test_placeholder_key",
      currency: "INR",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * 2. Create Razorpay Order
 * Validates stock, PostGIS 50 km radius, and creates a Razorpay payment order
 */
export const createRazorpayOrder = async (req, res) => {
  try {
    const customer = req.user;
    const { items, deliveryAddress } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "No items specified for purchase." });
    }

    if (
      !customer.location ||
      !customer.location.coordinates ||
      customer.location.coordinates.length < 2
    ) {
      return res.status(400).json({
        message: "Your location is not set. Please update your profile with location coordinates before placing an order.",
      });
    }

    const [cLng, cLat] = customer.location.coordinates;
    let totalAmount = 0;
    const enrichedItems = [];

    // Validate each item, stock, and distance
    for (const item of items) {
      const productId = item.product || item.product_id || item._id;
      const quantity = parseInt(item.quantity, 10) || 1;

      const prodRes = await query(
        `
        SELECT p.*, u.name AS farmer_name,
               ST_X(u.location::geometry) AS farmer_lng,
               ST_Y(u.location::geometry) AS farmer_lat
        FROM products p
        LEFT JOIN users u ON p.farmer_id = u.id
        WHERE p.id = $1
        `,
        [productId]
      );

      if (prodRes.rows.length === 0) {
        return res.status(404).json({ message: `Product with ID ${productId} not found.` });
      }

      const product = prodRes.rows[0];

      if (parseInt(product.stock, 10) < quantity) {
        return res.status(400).json({
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${quantity}.`,
        });
      }

      if (product.farmer_lng == null || product.farmer_lat == null) {
        return res.status(400).json({
          message: `Farmer for product "${product.name}" does not have location coordinates set.`,
        });
      }

      // 50 km PostGIS distance check
      const distRes = await query(
        `SELECT ROUND((ST_Distance(
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
         ) / 1000)::numeric, 1) AS distance_km`,
        [cLng, cLat, product.farmer_lng, product.farmer_lat]
      );

      const distanceKm = parseFloat(distRes.rows[0].distance_km);
      if (distanceKm > DELIVERY_RADIUS_KM) {
        return res.status(400).json({
          message: `Product "${product.name}" is ${distanceKm.toFixed(1)} km away. Delivery is only available within ${DELIVERY_RADIUS_KM} km.`,
        });
      }

      const price = parseFloat(product.price);
      const subtotal = price * quantity;
      totalAmount += subtotal;

      enrichedItems.push({
        product_id: product.id,
        farmer_id: product.farmer_id,
        name: product.name,
        quantity,
        price,
        subtotal,
      });
    }

    const amountInPaise = Math.round(totalAmount * 100);

    // If live/test Razorpay credentials are configured, create real Razorpay Order
    if (isConfigured && razorpayInstance) {
      const options = {
        amount: amountInPaise,
        currency: "INR",
        receipt: `rcpt_${Date.now().toString().slice(-8)}`,
        notes: {
          customerId: customer.id || customer._id,
          customerEmail: customer.email,
        },
      };

      const razorpayOrder = await razorpayInstance.orders.create(options);

      return res.status(200).json({
        success: true,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId,
        totalAmount,
        deliveryAddress: deliveryAddress || customer.address || "Address provided at checkout",
        items: enrichedItems,
        isConfigured: true,
      });
    }

    // Otherwise, provide developer/test simulation mode
    const mockOrderId = `order_sim_${Date.now()}`;
    return res.status(200).json({
      success: true,
      orderId: mockOrderId,
      amount: amountInPaise,
      currency: "INR",
      keyId: "rzp_test_placeholder_key",
      totalAmount,
      deliveryAddress: deliveryAddress || customer.address || "Address provided at checkout",
      items: enrichedItems,
      isConfigured: false,
      simulationMode: true,
    });
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    return res.status(500).json({ message: error.message || "Failed to create payment order." });
  }
};

/**
 * 3. Verify Payment and Place Order Transactionally
 */
export const verifyPayment = async (req, res) => {
  try {
    const customerId = req.user.id || req.user._id;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      items,
      deliveryAddress,
      isSimulation,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Order items are required for verification." });
    }

    // If configured with real Razorpay, verify cryptographic HMAC-SHA256 signature
    if (isConfigured && !isSimulation) {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ message: "Incomplete payment signature parameters." });
      }

      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(body.toString())
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: "Payment verification failed: Signature mismatch.",
        });
      }
    }

    // Place the order atomically inside a database transaction
    const createdOrder = await withTransaction(async (client) => {
      let totalAmount = 0;

      // 1. Re-verify stock and calculate exact amount
      for (const item of items) {
        const prodRes = await client.query(
          "SELECT id, name, price, stock FROM products WHERE id = $1 FOR UPDATE",
          [item.product_id]
        );

        if (prodRes.rows.length === 0) {
          throw new Error(`Product not found: ${item.name || item.product_id}`);
        }

        const currentStock = parseInt(prodRes.rows[0].stock, 10);
        if (currentStock < item.quantity) {
          throw new Error(`Item "${prodRes.rows[0].name}" is out of stock.`);
        }

        totalAmount += parseFloat(item.price) * item.quantity;
      }

      // 2. Insert Order marked as Paid
      const orderInsertRes = await client.query(
        `
        INSERT INTO orders (
          customer_id, total_amount, delivery_address,
          payment_status, order_status, payment_id, razorpay_order_id
        )
        VALUES ($1, $2, $3, 'Paid', 'Pending', $4, $5)
        RETURNING id
        `,
        [
          customerId,
          totalAmount,
          deliveryAddress || "Standard Delivery",
          razorpay_payment_id || `pay_sim_${Date.now()}`,
          razorpay_order_id || `order_sim_${Date.now()}`,
        ]
      );

      const orderId = orderInsertRes.rows[0].id;

      // 3. Insert Order Items & decrement product inventory
      for (const item of items) {
        await client.query(
          `
          INSERT INTO order_items (order_id, product_id, farmer_id, quantity, price, subtotal)
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [orderId, item.product_id, item.farmer_id, item.quantity, item.price, item.subtotal]
        );

        await client.query(
          `UPDATE products SET stock = stock - $1 WHERE id = $2`,
          [item.quantity, item.product_id]
        );
      }

      // 4. Remove purchased items from customer's shopping cart if present
      const cartRes = await client.query("SELECT id FROM carts WHERE customer_id = $1", [customerId]);
      if (cartRes.rows.length > 0) {
        const cartId = cartRes.rows[0].id;
        const productIds = items.map((i) => i.product_id);
        await client.query(
          "DELETE FROM cart_items WHERE cart_id = $1 AND product_id = ANY($2::uuid[])",
          [cartId, productIds]
        );
      }

      return fetchOrderWithItems(orderId, client);
    });

    return res.status(201).json({
      success: true,
      message: "Payment verified and order placed successfully!",
      order: createdOrder,
    });
  } catch (error) {
    console.error("Payment verification transaction error:", error);
    return res.status(500).json({ message: error.message || "Failed to process paid order." });
  }
};

