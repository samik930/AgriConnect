import { z } from "zod";
import { query } from "../../db/index.js";
import { formatProduct, formatReview } from "../../utils/formatters.js";

/**
 * Register all Marketplace tools onto an McpServer instance
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 */
export function registerMarketplaceTools(server) {
  // ==========================================
  // 1. PRODUCT SEARCH & DISCOVERY
  // ==========================================

  server.tool(
    "search_products",
    "Search available agricultural produce and products with optional filters for category, price range, and in-stock status.",
    {
      query: z.string().optional().describe("Search keyword for product name or description"),
      category: z.string().optional().describe("Category filter (e.g. 'Vegetables', 'Grains', 'Fruits', 'Dairy')"),
      min_price: z.number().optional().describe("Minimum price filter"),
      max_price: z.number().optional().describe("Maximum price filter"),
      in_stock_only: z.boolean().optional().default(true).describe("Filter only items currently in stock (stock > 0)"),
      limit: z.number().optional().default(20).describe("Maximum number of products to return"),
    },
    async ({ query: searchKeyword, category, min_price, max_price, in_stock_only, limit }) => {
      try {
        const conditions = [];
        const values = [];
        let idx = 1;

        if (searchKeyword) {
          conditions.push(`(p.name ILIKE $${idx} OR p.description ILIKE $${idx})`);
          values.push(`%${searchKeyword}%`);
          idx++;
        }

        if (category) {
          conditions.push(`p.category ILIKE $${idx}`);
          values.push(category);
          idx++;
        }

        if (min_price !== undefined) {
          conditions.push(`p.price >= $${idx}`);
          values.push(min_price);
          idx++;
        }

        if (max_price !== undefined) {
          conditions.push(`p.price <= $${idx}`);
          values.push(max_price);
          idx++;
        }

        if (in_stock_only) {
          conditions.push(`p.stock > 0`);
        }

        values.push(limit);
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const sql = `
          SELECT 
            p.id, p.farmer_id, p.name, p.category, p.description, p.price, p.stock, p.unit, p.created_at, p.updated_at,
            u.name AS farmer_name, u.email AS farmer_email, u.district AS farmer_district, u.state AS farmer_state,
            ST_X(u.location::geometry) AS farmer_lng,
            ST_Y(u.location::geometry) AS farmer_lat
          FROM products p
          JOIN users u ON p.farmer_id = u.id
          ${whereClause}
          ORDER BY p.created_at DESC
          LIMIT $${idx}
        `;

        const res = await query(sql, values);
        const products = res.rows.map(formatProduct);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ count: products.length, products }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error searching products: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "get_product_details",
    "Get full details, pricing, available stock, unit of sale, and seller information for a specific product by ID.",
    {
      product_id: z.string().describe("UUID of the product"),
    },
    async ({ product_id }) => {
      try {
        const sql = `
          SELECT 
            p.id, p.farmer_id, p.name, p.category, p.description, p.price, p.stock, p.unit, p.created_at, p.updated_at,
            u.name AS farmer_name, u.email AS farmer_email, u.district AS farmer_district, u.state AS farmer_state,
            ST_X(u.location::geometry) AS farmer_lng,
            ST_Y(u.location::geometry) AS farmer_lat
          FROM products p
          JOIN users u ON p.farmer_id = u.id
          WHERE p.id = $1
        `;
        const res = await query(sql, [product_id]);
        if (res.rows.length === 0) {
          return {
            isError: true,
            content: [{ type: "text", text: `Product with ID '${product_id}' was not found.` }],
          };
        }

        const product = formatProduct(res.rows[0]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(product, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching product details: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "check_inventory",
    "Batch verify stock availability for one or more products against desired purchase quantities.",
    {
      items: z
        .array(
          z.object({
            product_id: z.string().describe("UUID of the product"),
            quantity: z.number().min(1).describe("Desired purchase quantity"),
          })
        )
        .describe("List of products and quantities to verify"),
    },
    async ({ items }) => {
      try {
        if (!items || items.length === 0) {
          return {
            content: [{ type: "text", text: JSON.stringify({ available: true, results: [] }) }],
          };
        }

        const productIds = items.map((i) => i.product_id);
        const sql = `
          SELECT id, name, price, stock, unit
          FROM products
          WHERE id = ANY($1::uuid[])
        `;
        const res = await query(sql, [productIds]);
        const productMap = new Map(res.rows.map((r) => [r.id, r]));

        let allAvailable = true;
        const results = items.map(({ product_id, quantity }) => {
          const product = productMap.get(product_id);

          if (!product) {
            allAvailable = false;
            return {
              product_id,
              name: "Unknown Product",
              status: "NOT_FOUND",
              requested: quantity,
              availableStock: 0,
            };
          }

          const stock = parseInt(product.stock, 10);
          const hasEnough = stock >= quantity;
          if (!hasEnough) allAvailable = false;

          return {
            product_id,
            name: product.name,
            status: hasEnough ? "IN_STOCK" : stock > 0 ? "PARTIALLY_AVAILABLE" : "OUT_OF_STOCK",
            requested: quantity,
            availableStock: stock,
            price: parseFloat(product.price),
            unit: product.unit,
          };
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ allAvailable, itemsCount: items.length, inventory: results }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error checking inventory: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "list_categories",
    "List all distinct produce categories currently available in the marketplace.",
    {},
    async () => {
      try {
        const res = await query(
          "SELECT DISTINCT category, COUNT(*) as product_count FROM products GROUP BY category ORDER BY category ASC"
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ categories: res.rows }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error listing categories: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "get_farmer_products",
    "List all active crop and produce listings created by a specific farmer.",
    {
      farmer_id: z.string().describe("UUID of the farmer"),
    },
    async ({ farmer_id }) => {
      try {
        const sql = `
          SELECT 
            p.id, p.farmer_id, p.name, p.category, p.description, p.price, p.stock, p.unit, p.created_at, p.updated_at,
            u.name AS farmer_name, u.email AS farmer_email, u.district AS farmer_district, u.state AS farmer_state,
            ST_X(u.location::geometry) AS farmer_lng,
            ST_Y(u.location::geometry) AS farmer_lat
          FROM products p
          JOIN users u ON p.farmer_id = u.id
          WHERE p.farmer_id = $1
          ORDER BY p.created_at DESC
        `;
        const res = await query(sql, [farmer_id]);
        const products = res.rows.map(formatProduct);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ farmer_id, count: products.length, products }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching farmer products: ${err.message}` }],
        };
      }
    }
  );

  // ==========================================
  // 2. REVIEWS & QUALITY REPUTATION
  // ==========================================

  server.tool(
    "get_product_reviews",
    "Retrieve customer ratings, comments, and quality feedback for a specific product.",
    {
      product_id: z.string().describe("UUID of the product"),
    },
    async ({ product_id }) => {
      try {
        const sql = `
          SELECT r.*, u.name AS customer_name
          FROM reviews r
          JOIN users u ON r.customer_id = u.id
          WHERE r.product_id = $1
          ORDER BY r.created_at DESC
        `;
        const res = await query(sql, [product_id]);
        const reviews = res.rows.map(formatReview);

        const averageRating =
          reviews.length > 0
            ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
            : null;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  product_id,
                  totalReviews: reviews.length,
                  averageRating: averageRating ? parseFloat(averageRating) : null,
                  reviews,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching product reviews: ${err.message}` }],
        };
      }
    }
  );

  // ==========================================
  // 3. FARMER LISTING ACTIONS (WRITE TOOLS)
  // ==========================================

  server.tool(
    "create_product_listing",
    "Create a new produce listing on behalf of a registered farmer.",
    {
      farmer_id: z.string().describe("UUID of the listing farmer"),
      name: z.string().describe("Name of the produce (e.g. 'Fresh Organic Tomatoes')"),
      category: z.string().describe("Category (e.g. 'Vegetables', 'Grains', 'Fruits', 'Dairy')"),
      description: z.string().optional().describe("Product description or harvest details"),
      price: z.number().min(0).describe("Price per unit in INR (₹)"),
      stock: z.number().int().min(0).describe("Total available stock quantity"),
      unit: z.string().optional().default("kg").describe("Measurement unit (e.g. 'kg', 'quintal', 'dozen', 'litre')"),
    },
    async ({ farmer_id, name, category, description, price, stock, unit }) => {
      try {
        // Verify farmer exists and has role 'farmer'
        const farmerRes = await query("SELECT id, name, role FROM users WHERE id = $1", [farmer_id]);
        if (farmerRes.rows.length === 0) {
          return {
            isError: true,
            content: [{ type: "text", text: `User with ID '${farmer_id}' does not exist.` }],
          };
        }

        if (farmerRes.rows[0].role !== "farmer") {
          return {
            isError: true,
            content: [{ type: "text", text: `Only registered farmers can list products. User role is '${farmerRes.rows[0].role}'.` }],
          };
        }

        const insertSql = `
          INSERT INTO products (farmer_id, name, category, description, price, stock, unit)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `;
        const res = await query(insertSql, [
          farmer_id,
          name,
          category,
          description || null,
          price,
          stock,
          unit || "kg",
        ]);

        const product = formatProduct({
          ...res.rows[0],
          farmer_name: farmerRes.rows[0].name,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, message: "Product listed successfully", product }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error creating product listing: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "update_product_listing",
    "Update an existing product's price, stock, description, or category on behalf of the owner farmer.",
    {
      product_id: z.string().describe("UUID of the product to update"),
      farmer_id: z.string().describe("UUID of the farmer requesting update (for authorization)"),
      name: z.string().optional().describe("New product name"),
      category: z.string().optional().describe("New category"),
      description: z.string().optional().describe("New description"),
      price: z.number().min(0).optional().describe("New price per unit"),
      stock: z.number().int().min(0).optional().describe("New available stock quantity"),
      unit: z.string().optional().describe("New measurement unit"),
    },
    async ({ product_id, farmer_id, name, category, description, price, stock, unit }) => {
      try {
        const prodRes = await query("SELECT * FROM products WHERE id = $1", [product_id]);
        if (prodRes.rows.length === 0) {
          return {
            isError: true,
            content: [{ type: "text", text: `Product with ID '${product_id}' was not found.` }],
          };
        }

        if (prodRes.rows[0].farmer_id !== farmer_id) {
          return {
            isError: true,
            content: [{ type: "text", text: "Access denied: Farmer does not own this product listing." }],
          };
        }

        const setClauses = ["updated_at = NOW()"];
        const values = [];
        let idx = 1;

        if (name !== undefined) {
          setClauses.push(`name = $${idx++}`);
          values.push(name);
        }
        if (category !== undefined) {
          setClauses.push(`category = $${idx++}`);
          values.push(category);
        }
        if (description !== undefined) {
          setClauses.push(`description = $${idx++}`);
          values.push(description);
        }
        if (price !== undefined) {
          setClauses.push(`price = $${idx++}`);
          values.push(price);
        }
        if (stock !== undefined) {
          setClauses.push(`stock = $${idx++}`);
          values.push(stock);
        }
        if (unit !== undefined) {
          setClauses.push(`unit = $${idx++}`);
          values.push(unit);
        }

        values.push(product_id);
        const updateSql = `
          UPDATE products
          SET ${setClauses.join(", ")}
          WHERE id = $${idx}
          RETURNING *
        `;

        const updatedRes = await query(updateSql, values);
        const product = formatProduct(updatedRes.rows[0]);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, message: "Product updated successfully", product }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error updating product listing: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "delete_product_listing",
    "Delete a product listing on behalf of the owner farmer.",
    {
      product_id: z.string().describe("UUID of the product to delete"),
      farmer_id: z.string().describe("UUID of the farmer requesting deletion (for authorization)"),
    },
    async ({ product_id, farmer_id }) => {
      try {
        const prodRes = await query("SELECT * FROM products WHERE id = $1", [product_id]);
        if (prodRes.rows.length === 0) {
          return {
            isError: true,
            content: [{ type: "text", text: `Product with ID '${product_id}' was not found.` }],
          };
        }

        if (prodRes.rows[0].farmer_id !== farmer_id) {
          return {
            isError: true,
            content: [{ type: "text", text: "Access denied: Farmer does not own this product listing." }],
          };
        }

        await query("DELETE FROM products WHERE id = $1", [product_id]);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, message: `Product '${prodRes.rows[0].name}' deleted successfully.` }),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error deleting product listing: ${err.message}` }],
        };
      }
    }
  );
}

