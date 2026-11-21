import { z } from "zod";
import { query, withTransaction } from "../../db/index.js";
import { formatOrder } from "../../utils/formatters.js";

const DELIVERY_RADIUS_KM = 50;

/**
 * Helper to fetch complete order with items
 */
const fetchOrderWithItems = async (orderId, client = null) => {
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

/**
 * Register all Order & Customer Support tools onto an McpServer instance
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 */
export function registerOrderSupportTools(server) {
  // ==========================================
  // 1. ORDER INQUIRIES & TRACKING
  // ==========================================

  server.tool(
    "get_order_details",
    "Retrieve complete order information, itemized products, pricing, delivery address, and live fulfillment status by order ID.",
    {
      order_id: z.string().describe("UUID of the order"),
    },
    async ({ order_id }) => {
      try {
        const order = await fetchOrderWithItems(order_id);
        if (!order) {
          return {
            isError: true,
            content: [{ type: "text", text: `Order with ID '${order_id}' was not found.` }],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(order, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching order details: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "get_customer_orders",
    "List all orders placed by a specific customer, sorted newest first.",
    {
      customer_id: z.string().describe("UUID of the customer"),
      limit: z.number().optional().default(20).describe("Maximum number of orders to return"),
    },
    async ({ customer_id, limit }) => {
      try {
        const res = await query(
          "SELECT id FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2",
          [customer_id, limit]
        );

        const orders = await Promise.all(res.rows.map((r) => fetchOrderWithItems(r.id)));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ customer_id, totalOrders: orders.length, orders }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching customer orders: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "get_farmer_orders",
    "Retrieve orders that contain produce to be fulfilled by a specific farmer, with optional status filter.",
    {
      farmer_id: z.string().describe("UUID of the farmer"),
      status: z.enum(["Pending", "Accepted", "Packed", "Delivered", "Cancelled"]).optional().describe("Filter by order status"),
      limit: z.number().optional().default(20).describe("Maximum number of orders to return"),
    },
    async ({ farmer_id, status, limit }) => {
      try {
        const conditions = ["oi.farmer_id = $1"];
        const values = [farmer_id];
        let idx = 2;

        if (status) {
          conditions.push(`o.order_status = $${idx}`);
          values.push(status);
          idx++;
        }

        values.push(limit);

        const sql = `
          SELECT DISTINCT o.id, o.created_at
          FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          WHERE ${conditions.join(" AND ")}
          ORDER BY o.created_at DESC
          LIMIT $${idx}
        `;

        const res = await query(sql, values);
        const orders = await Promise.all(res.rows.map((r) => fetchOrderWithItems(r.id)));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ farmer_id, statusFilter: status || "ALL", count: orders.length, orders }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching farmer orders: ${err.message}` }],
        };
      }
    }
  );

  // ==========================================
  // 2. SHOPPING CART OPERATIONS
  // ==========================================

  server.tool(
    "get_cart",
    "Inspect the contents of a customer's active shopping cart, with product details and subtotal.",
    {
      customer_id: z.string().describe("UUID of the customer"),
    },
    async ({ customer_id }) => {
      try {
        const cartRes = await query("SELECT id, created_at, updated_at FROM carts WHERE customer_id = $1", [customer_id]);
        if (cartRes.rows.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ customer_id, items: [], totalEstimatedAmount: 0 }, null, 2),
              },
            ],
          };
        }

        const cartId = cartRes.rows[0].id;
        const itemsRes = await query(
          `
          SELECT 
            ci.id AS item_id, ci.quantity,
            p.id AS product_id, p.name AS product_name, p.price, p.stock, p.unit, p.category,
            f.id AS farmer_id, f.name AS farmer_name
          FROM cart_items ci
          JOIN products p ON ci.product_id = p.id
          LEFT JOIN users f ON p.farmer_id = f.id
          WHERE ci.cart_id = $1
          ORDER BY ci.created_at ASC
          `,
          [cartId]
        );

        let totalEstimatedAmount = 0;
        const items = itemsRes.rows.map((r) => {
          const subtotal = parseFloat(r.price) * r.quantity;
          totalEstimatedAmount += subtotal;
          return {
            item_id: r.item_id,
            product_id: r.product_id,
            product_name: r.product_name,
            farmer: { id: r.farmer_id, name: r.farmer_name },
            price: parseFloat(r.price),
            quantity: r.quantity,
            unit: r.unit,
            subtotal,
          };
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                cart_id: cartId,
                customer_id,
                totalItems: items.length,
                totalEstimatedAmount,
                items,
              }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching cart: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "add_to_cart",
    "Add a product to a customer's shopping cart, verifying product availability and locality constraints.",
    {
      customer_id: z.string().describe("UUID of the customer"),
      product_id: z.string().describe("UUID of the product to add"),
      quantity: z.number().int().min(1).default(1).describe("Quantity to add"),
    },
    async ({ customer_id, product_id, quantity }) => {
      try {
        // 1. Verify product
        const prodRes = await query(
          `
          SELECT p.*, u.name AS farmer_name,
                 ST_X(u.location::geometry) AS farmer_lng, ST_Y(u.location::geometry) AS farmer_lat
          FROM products p
          LEFT JOIN users u ON p.farmer_id = u.id
          WHERE p.id = $1
          `,
          [product_id]
        );

        if (prodRes.rows.length === 0) {
          return {
            isError: true,
            content: [{ type: "text", text: `Product '${product_id}' does not exist.` }],
          };
        }

        const prod = prodRes.rows[0];

        // 2. Check stock
        if (prod.stock < quantity) {
          return {
            isError: true,
            content: [{ type: "text", text: `Insufficient stock for '${prod.name}'. Requested ${quantity}, available: ${prod.stock} ${prod.unit}.` }],
          };
        }

        // 2b. Guardrail: PostGIS 50 km local delivery boundary check
        if (prod.farmer_lng != null && prod.farmer_lat != null) {
          const custRes = await query(
            "SELECT ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat FROM users WHERE id = $1",
            [customer_id]
          );
          if (custRes.rows.length > 0 && custRes.rows[0].lng != null && custRes.rows[0].lat != null) {
            const c = custRes.rows[0];
            const distRes = await query(
              `SELECT ROUND((ST_Distance(
                 ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                 ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
               ) / 1000)::numeric, 1) AS distance_km`,
              [c.lng, c.lat, prod.farmer_lng, prod.farmer_lat]
            );
            const distKm = parseFloat(distRes.rows[0]?.distance_km || 0);
            if (distKm > DELIVERY_RADIUS_KM) {
              return {
                isError: true,
                content: [
                  {
                    type: "text",
                    text: `Cannot add '${prod.name}' to cart: Farm is located ${distKm} km away, which exceeds the mandatory 50 km local delivery limit.`,
                  },
                ],
              };
            }
          }
        }

        // 3. Ensure cart exists
        const cartRes = await query(
          `
          INSERT INTO carts (customer_id)
          VALUES ($1)
          ON CONFLICT (customer_id) DO UPDATE SET updated_at = NOW()
          RETURNING id
          `,
          [customer_id]
        );

        const cartId = cartRes.rows[0].id;

        // 4. Upsert cart item
        await query(
          `
          INSERT INTO cart_items (cart_id, product_id, quantity)
          VALUES ($1, $2, $3)
          ON CONFLICT (cart_id, product_id)
          DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = NOW()
          `,
          [cartId, product_id, quantity]
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Added ${quantity} ${prod.unit} of '${prod.name}' to cart.`,
                product: { id: prod.id, name: prod.name, price: parseFloat(prod.price) },
              }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error adding to cart: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "remove_from_cart",
    "Remove an item or reduce its quantity in a customer's shopping cart.",
    {
      customer_id: z.string().describe("UUID of the customer"),
      product_id: z.string().describe("UUID of the product to remove"),
    },
    async ({ customer_id, product_id }) => {
      try {
        const cartRes = await query("SELECT id FROM carts WHERE customer_id = $1", [customer_id]);
        if (cartRes.rows.length === 0) {
          return {
            isError: true,
            content: [{ type: "text", text: "Customer does not have an active cart." }],
          };
        }

        const cartId = cartRes.rows[0].id;
        const delRes = await query("DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2 RETURNING id", [cartId, product_id]);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                removed: delRes.rows.length > 0,
                message: delRes.rows.length > 0 ? "Item removed from cart." : "Item was not in cart.",
              }),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error removing item from cart: ${err.message}` }],
        };
      }
    }
  );

  // ==========================================
  // 3. ORDER PLACEMENT (TRANSACTIONAL)
  // ==========================================

  server.tool(
    "create_order",
    "Place a confirmed order with multiple items atomically using managed database transactions.",
    {
      customer_id: z.string().describe("UUID of the purchasing customer"),
      items: z
        .array(
          z.object({
            product_id: z.string().describe("UUID of the product"),
            quantity: z.number().int().min(1).describe("Quantity to purchase"),
          })
        )
        .min(1)
        .describe("Array of items to purchase"),
      delivery_address: z.string().describe("Delivery address for the order"),
    },
    async ({ customer_id, items, delivery_address }) => {
      try {
        // Customer location check
        const custRes = await query(
          `SELECT name, ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat FROM users WHERE id = $1`,
          [customer_id]
        );

        if (custRes.rows.length === 0) {
          return {
            isError: true,
            content: [{ type: "text", text: `Customer '${customer_id}' not found.` }],
          };
        }

        const customer = custRes.rows[0];
        if (customer.lng == null || customer.lat == null) {
          return {
            isError: true,
            content: [{ type: "text", text: "Customer must have GPS location coordinates set in their profile before placing an order." }],
          };
        }

        // Execute order creation in a managed database transaction
        const order = await withTransaction(async (client) => {
          let totalAmount = 0;
          const enrichedItems = [];

          for (const item of items) {
            const prodRes = await client.query(
              `
              SELECT p.*, u.name AS farmer_name,
                     ST_X(u.location::geometry) AS farmer_lng, ST_Y(u.location::geometry) AS farmer_lat
              FROM products p
              JOIN users u ON p.farmer_id = u.id
              WHERE p.id = $1
              FOR UPDATE OF p
              `,
              [item.product_id]
            );

            if (prodRes.rows.length === 0) {
              throw new Error(`Product '${item.product_id}' was not found.`);
            }

            const prod = prodRes.rows[0];

            if (prod.stock < item.quantity) {
              throw new Error(`Insufficient stock for '${prod.name}'. Requested ${item.quantity}, available ${prod.stock}.`);
            }

            // PostGIS Distance check
            if (prod.farmer_lng != null && prod.farmer_lat != null) {
              const distRes = await client.query(
                `SELECT ROUND((ST_Distance(
                   ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                   ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
                 ) / 1000)::numeric, 1) AS distance_km`,
                [customer.lng, customer.lat, prod.farmer_lng, prod.farmer_lat]
              );

              const distanceKm = parseFloat(distRes.rows[0].distance_km);
              if (distanceKm > DELIVERY_RADIUS_KM) {
                throw new Error(`Product '${prod.name}' is from farmer '${prod.farmer_name}' who is ${distanceKm} km away (exceeds ${DELIVERY_RADIUS_KM} km limit).`);
              }
            }

            const price = parseFloat(prod.price);
            const subtotal = price * item.quantity;
            totalAmount += subtotal;

            enrichedItems.push({
              product_id: prod.id,
              farmer_id: prod.farmer_id,
              quantity: item.quantity,
              price,
              subtotal,
            });

            // Decrement product stock
            await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [item.quantity, prod.id]);
          }

          // Create order
          const orderRes = await client.query(
            `
            INSERT INTO orders (customer_id, total_amount, delivery_address, payment_status, order_status)
            VALUES ($1, $2, $3, 'Pending', 'Pending')
            RETURNING id
            `,
            [customer_id, totalAmount, delivery_address]
          );

          const orderId = orderRes.rows[0].id;

          // Insert order items
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

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Order placed successfully!",
                order,
              }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error placing order: ${err.message}` }],
        };
      }
    }
  );

  // ==========================================
  // 4. ORDER STATUS TRANSITIONS & CANCELLATION
  // ==========================================

  server.tool(
    "update_order_status",
    "Transition the fulfillment status of an order (Accepted, Packed, Delivered, Cancelled) on behalf of a farmer.",
    {
      order_id: z.string().describe("UUID of the order"),
      farmer_id: z.string().describe("UUID of the farmer updating the order"),
      new_status: z.enum(["Pending", "Accepted", "Packed", "Delivered", "Cancelled"]).describe("New order status"),
    },
    async ({ order_id, farmer_id, new_status }) => {
      try {
        // Verify farmer has items in this order
        const verifyRes = await query(
          `
          SELECT o.id, o.order_status
          FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          WHERE o.id = $1 AND oi.farmer_id = $2
          LIMIT 1
          `,
          [order_id, farmer_id]
        );

        if (verifyRes.rows.length === 0) {
          return {
            isError: true,
            content: [{ type: "text", text: "Access denied or order does not contain products for this farmer." }],
          };
        }

        const currentStatus = verifyRes.rows[0].order_status;
        if (currentStatus === "Cancelled") {
          return {
            isError: true,
            content: [{ type: "text", text: "Cannot update status of a cancelled order." }],
          };
        }

        await query("UPDATE orders SET order_status = $1, updated_at = NOW() WHERE id = $2", [new_status, order_id]);
        const updatedOrder = await fetchOrderWithItems(order_id);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                previousStatus: currentStatus,
                newStatus: new_status,
                order: updatedOrder,
              }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error updating order status: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "cancel_order",
    "Cancel an active order on behalf of a customer (enforces rule: Delivered or Cancelled orders cannot be cancelled).",
    {
      order_id: z.string().describe("UUID of the order to cancel"),
      customer_id: z.string().describe("UUID of the customer requesting cancellation"),
      reason: z.string().optional().describe("Optional cancellation reason for records"),
    },
    async ({ order_id, customer_id, reason }) => {
      try {
        const orderRes = await query("SELECT * FROM orders WHERE id = $1 AND customer_id = $2", [order_id, customer_id]);
        if (orderRes.rows.length === 0) {
          return {
            isError: true,
            content: [{ type: "text", text: `Order '${order_id}' was not found for this customer.` }],
          };
        }

        const order = orderRes.rows[0];

        if (order.order_status === "Delivered") {
          return {
            isError: true,
            content: [{ type: "text", text: "Delivered orders cannot be cancelled. Please contact platform support for returns." }],
          };
        }

        if (order.order_status === "Cancelled") {
          return {
            content: [{ type: "text", text: JSON.stringify({ success: true, message: "Order is already cancelled." }) }],
          };
        }

        // Cancel order and restock products in a transaction
        await withTransaction(async (client) => {
          await client.query("UPDATE orders SET order_status = 'Cancelled', updated_at = NOW() WHERE id = $1", [order_id]);

          // Restock items
          const itemsRes = await client.query("SELECT product_id, quantity FROM order_items WHERE order_id = $1", [order_id]);
          for (const item of itemsRes.rows) {
            if (item.product_id) {
              await client.query("UPDATE products SET stock = stock + $1 WHERE id = $2", [item.quantity, item.product_id]);
            }
          }
        });

        const cancelledOrder = await fetchOrderWithItems(order_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Order cancelled successfully and stock restored.",
                reason: reason || "Customer requested cancellation",
                order: cancelledOrder,
              }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error cancelling order: ${err.message}` }],
        };
      }
    }
  );
}

