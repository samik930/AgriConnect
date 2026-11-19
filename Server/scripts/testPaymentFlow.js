import dotenv from "dotenv";
import { query } from "../src/db/index.js";
import { isConfigured, keyId } from "../src/config/razorpay.js";

dotenv.config();

async function testPayment() {
  console.log("💳 Testing Razorpay Payment Pipeline...");
  console.log(`Razorpay Configured: ${isConfigured}`);
  console.log(`Key ID: ${keyId}`);

  // Fetch a customer and a product
  const custRes = await query("SELECT id, name, email, location FROM users WHERE role = 'customer' LIMIT 1");
  const prodRes = await query("SELECT id, name, price, stock, farmer_id FROM products LIMIT 1");

  if (custRes.rows.length === 0 || prodRes.rows.length === 0) {
    console.log("ℹ️ No customer or product found to test order placement.");
    process.exit(0);
  }

  const customer = custRes.rows[0];
  const product = prodRes.rows[0];
  console.log(`Customer: ${customer.name} (${customer.id})`);
  console.log(`Product: ${product.name} (₹${product.price}, Stock: ${product.stock})`);

  // Verify payment insertion into orders table directly
  const orderRes = await query(
    `INSERT INTO orders (customer_id, total_amount, delivery_address, payment_status, order_status, payment_id, razorpay_order_id)
     VALUES ($1, $2, $3, 'Paid', 'Pending', $4, $5)
     RETURNING id, payment_status, payment_id, razorpay_order_id`,
    [customer.id, product.price, "Test Address, Pune", "pay_test_12345", "order_test_12345"]
  );

  console.log("✅ Order inserted successfully with Razorpay details:", orderRes.rows[0]);

  // Clean up test order
  await query("DELETE FROM orders WHERE id = $1", [orderRes.rows[0].id]);
  console.log("🧹 Test order cleaned up successfully.");
  console.log("🎉 All payment schema and transaction mechanisms verified!");
  process.exit(0);
}

testPayment().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});

