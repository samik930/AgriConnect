import { z } from "zod";
import { query } from "../../db/index.js";
import { formatProduct, formatUser } from "../../utils/formatters.js";

const DEFAULT_DELIVERY_RADIUS_KM = 50;

/**
 * Register all Location & Logistics tools onto an McpServer instance
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 */
export function registerLogisticsTools(server) {
  // ==========================================
  // 1. NEARBY FARMER DISCOVERY
  // ==========================================

  server.tool(
    "find_nearby_farmers",
    "Discover active farmers located within a specified radius (default 50 km) using PostGIS spatial queries.",
    {
      latitude: z.number().min(-90).max(90).describe("Latitude coordinate of buyer/center point"),
      longitude: z.number().min(-180).max(180).describe("Longitude coordinate of buyer/center point"),
      radius_km: z.number().min(1).max(500).optional().default(DEFAULT_DELIVERY_RADIUS_KM).describe("Radius in kilometers (default: 50 km)"),
    },
    async ({ latitude, longitude, radius_km }) => {
      try {
        const radiusMeters = radius_km * 1000;
        const sql = `
          SELECT 
            id, name, email, phone, state, district, address, pincode,
            ST_X(location::geometry) AS location_lng,
            ST_Y(location::geometry) AS location_lat,
            ROUND((ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000)::numeric, 1) AS distance_km
          FROM users
          WHERE role = 'farmer'
            AND location IS NOT NULL
            AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
          ORDER BY distance_km ASC
        `;
        const res = await query(sql, [longitude, latitude, radiusMeters]);

        const farmers = res.rows.map((row) => ({
          ...formatUser(row),
          distanceKm: parseFloat(row.distance_km),
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                origin: { latitude, longitude },
                radiusKm: radius_km,
                totalNearbyFarmers: farmers.length,
                farmers,
              }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error finding nearby farmers: ${err.message}` }],
        };
      }
    }
  );

  // ==========================================
  // 2. NEARBY FRESH PRODUCE DISCOVERY
  // ==========================================

  server.tool(
    "find_nearby_products",
    "Find fresh produce and products listed by farmers within delivery radius (default 50 km), sorted nearest-first.",
    {
      latitude: z.number().min(-90).max(90).describe("Latitude coordinate of buyer/center point"),
      longitude: z.number().min(-180).max(180).describe("Longitude coordinate of buyer/center point"),
      category: z.string().optional().describe("Optional produce category filter (e.g. 'Vegetables', 'Fruits')"),
      radius_km: z.number().min(1).max(500).optional().default(DEFAULT_DELIVERY_RADIUS_KM).describe("Delivery radius in kilometers (default: 50 km)"),
      limit: z.number().optional().default(30).describe("Maximum number of products to return"),
    },
    async ({ latitude, longitude, category, radius_km, limit }) => {
      try {
        const radiusMeters = radius_km * 1000;
        const conditions = [
          "u.role = 'farmer'",
          "u.location IS NOT NULL",
          "p.stock > 0",
          `ST_DWithin(u.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)`
        ];
        const values = [longitude, latitude, radiusMeters];
        let idx = 4;

        if (category) {
          conditions.push(`p.category ILIKE $${idx}`);
          values.push(category);
          idx++;
        }

        values.push(limit);

        const sql = `
          SELECT 
            p.id, p.farmer_id, p.name, p.category, p.description, p.price, p.stock, p.unit, p.created_at, p.updated_at,
            u.name AS farmer_name, u.email AS farmer_email, u.state AS farmer_state, u.district AS farmer_district,
            ST_X(u.location::geometry) AS farmer_lng,
            ST_Y(u.location::geometry) AS farmer_lat,
            ROUND((ST_Distance(u.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000)::numeric, 1) AS distance_km
          FROM products p
          JOIN users u ON p.farmer_id = u.id
          WHERE ${conditions.join(" AND ")}
          ORDER BY distance_km ASC, p.created_at DESC
          LIMIT $${idx}
        `;

        const res = await query(sql, values);
        const products = res.rows.map(formatProduct);
        const uniqueFarmers = new Set(res.rows.map((r) => r.farmer_id));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                origin: { latitude, longitude },
                radiusKm: radius_km,
                totalNearbyFarmers: uniqueFarmers.size,
                totalProducts: products.length,
                products,
              }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error finding nearby products: ${err.message}` }],
        };
      }
    }
  );

  // ==========================================
  // 3. DELIVERY FEASIBILITY CHECK
  // ==========================================

  server.tool(
    "check_delivery_eligibility",
    "Verify whether delivery is feasible between a customer and a farmer/product based on the 50 km locality restriction.",
    {
      customer_id: z.string().describe("UUID of the purchasing customer"),
      farmer_id: z.string().optional().describe("UUID of the selling farmer (provide either farmer_id or product_id)"),
      product_id: z.string().optional().describe("UUID of the product (if farmer_id is unknown)"),
      max_radius_km: z.number().optional().default(DEFAULT_DELIVERY_RADIUS_KM).describe("Maximum allowed radius in kilometers"),
    },
    async ({ customer_id, farmer_id, product_id, max_radius_km }) => {
      try {
        // 1. Resolve farmer_id if product_id was passed
        let targetFarmerId = farmer_id;
        let productName = null;

        if (!targetFarmerId && product_id) {
          const prodRes = await query("SELECT farmer_id, name FROM products WHERE id = $1", [product_id]);
          if (prodRes.rows.length === 0) {
            return {
              isError: true,
              content: [{ type: "text", text: `Product '${product_id}' not found.` }],
            };
          }
          targetFarmerId = prodRes.rows[0].farmer_id;
          productName = prodRes.rows[0].name;
        }

        if (!targetFarmerId) {
          return {
            isError: true,
            content: [{ type: "text", text: "Must provide either farmer_id or product_id." }],
          };
        }

        // 2. Query both customer and farmer locations in a single SQL query
        const sql = `
          SELECT 
            c.id AS customer_id, c.name AS customer_name,
            ST_X(c.location::geometry) AS customer_lng, ST_Y(c.location::geometry) AS customer_lat,
            f.id AS farmer_id, f.name AS farmer_name,
            ST_X(f.location::geometry) AS farmer_lng, ST_Y(f.location::geometry) AS farmer_lat,
            CASE 
              WHEN c.location IS NOT NULL AND f.location IS NOT NULL THEN
                ROUND((ST_Distance(c.location, f.location) / 1000)::numeric, 1)
              ELSE NULL
            END AS distance_km
          FROM users c
          CROSS JOIN users f
          WHERE c.id = $1 AND f.id = $2
        `;
        const res = await query(sql, [customer_id, targetFarmerId]);
        if (res.rows.length === 0) {
          return {
            isError: true,
            content: [{ type: "text", text: "Customer or Farmer user record could not be found." }],
          };
        }

        const data = res.rows[0];

        // Check if either profile is missing GPS coordinates
        if (data.customer_lng == null || data.customer_lat == null) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  eligible: false,
                  reason: "CUSTOMER_LOCATION_MISSING",
                  message: `Customer '${data.customer_name}' does not have location coordinates set in their profile.`,
                }, null, 2),
              },
            ],
          };
        }

        if (data.farmer_lng == null || data.farmer_lat == null) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  eligible: false,
                  reason: "FARMER_LOCATION_MISSING",
                  message: `Farmer '${data.farmer_name}' does not have location coordinates set in their profile.`,
                }, null, 2),
              },
            ],
          };
        }

        const distanceKm = parseFloat(data.distance_km);
        const eligible = distanceKm <= max_radius_km;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                eligible,
                distanceKm,
                maxRadiusKm: max_radius_km,
                customer: { id: data.customer_id, name: data.customer_name },
                farmer: { id: data.farmer_id, name: data.farmer_name },
                productName,
                message: eligible
                  ? `Delivery is available! Farmer '${data.farmer_name}' is ${distanceKm} km away (within the ${max_radius_km} km limit).`
                  : `Delivery is NOT available. Farmer '${data.farmer_name}' is ${distanceKm} km away, exceeding the ${max_radius_km} km limit.`,
              }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error checking delivery eligibility: ${err.message}` }],
        };
      }
    }
  );

  // ==========================================
  // 4. POINT-TO-POINT DISTANCE CALCULATION
  // ==========================================

  server.tool(
    "calculate_distance",
    "Calculate the high-precision spatial distance in kilometers between any two geographical coordinates using PostGIS.",
    {
      lat1: z.number().min(-90).max(90).describe("Latitude of point 1"),
      lng1: z.number().min(-180).max(180).describe("Longitude of point 1"),
      lat2: z.number().min(-90).max(90).describe("Latitude of point 2"),
      lng2: z.number().min(-180).max(180).describe("Longitude of point 2"),
    },
    async ({ lat1, lng1, lat2, lng2 }) => {
      try {
        const sql = `
          SELECT ROUND((ST_Distance(
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
          ) / 1000)::numeric, 2) AS distance_km
        `;
        const res = await query(sql, [lng1, lat1, lng2, lat2]);
        const distanceKm = parseFloat(res.rows[0].distance_km);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                point1: { latitude: lat1, longitude: lng1 },
                point2: { latitude: lat2, longitude: lng2 },
                distanceKm,
                within50KmRadius: distanceKm <= DEFAULT_DELIVERY_RADIUS_KM,
              }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error calculating distance: ${err.message}` }],
        };
      }
    }
  );

  // ==========================================
  // 5. USER LOCATION QUERY & UPDATE
  // ==========================================

  server.tool(
    "get_user_location",
    "Retrieve the stored geographic coordinates, state, district, and address for a user.",
    {
      user_id: z.string().describe("UUID of the user (farmer or customer)"),
    },
    async ({ user_id }) => {
      try {
        const sql = `
          SELECT 
            id, name, role, state, district, address, pincode,
            ST_X(location::geometry) AS location_lng,
            ST_Y(location::geometry) AS location_lat
          FROM users
          WHERE id = $1
        `;
        const res = await query(sql, [user_id]);
        if (res.rows.length === 0) {
          return {
            isError: true,
            content: [{ type: "text", text: `User '${user_id}' not found.` }],
          };
        }

        const user = formatUser(res.rows[0]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                id: user.id,
                name: user.name,
                role: user.role,
                location: user.location,
                address: user.address,
                district: user.district,
                state: user.state,
                pincode: user.pincode,
                hasCoordinates: !!user.location,
              }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching user location: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "update_user_location",
    "Update a user's geographical coordinates (PostGIS geography point) and address fields.",
    {
      user_id: z.string().describe("UUID of the user to update"),
      latitude: z.number().min(-90).max(90).describe("New latitude"),
      longitude: z.number().min(-180).max(180).describe("New longitude"),
      state: z.string().optional().describe("State name"),
      district: z.string().optional().describe("District name"),
      address: z.string().optional().describe("Street / Village address"),
      pincode: z.string().optional().describe("Postal code"),
    },
    async ({ user_id, latitude, longitude, state, district, address, pincode }) => {
      try {
        const setClauses = [
          "updated_at = NOW()",
          "location = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography"
        ];
        const values = [user_id, longitude, latitude];
        let idx = 4;

        if (state !== undefined) {
          setClauses.push(`state = $${idx++}`);
          values.push(state);
        }
        if (district !== undefined) {
          setClauses.push(`district = $${idx++}`);
          values.push(district);
        }
        if (address !== undefined) {
          setClauses.push(`address = $${idx++}`);
          values.push(address);
        }
        if (pincode !== undefined) {
          setClauses.push(`pincode = $${idx++}`);
          values.push(pincode);
        }

        const sql = `
          UPDATE users
          SET ${setClauses.join(", ")}
          WHERE id = $1
          RETURNING id, name, role, state, district, address, pincode,
                    ST_X(location::geometry) AS location_lng,
                    ST_Y(location::geometry) AS location_lat
        `;

        const res = await query(sql, values);
        if (res.rows.length === 0) {
          return {
            isError: true,
            content: [{ type: "text", text: `User '${user_id}' was not found.` }],
          };
        }

        const updated = formatUser(res.rows[0]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Location updated successfully",
                user: updated,
              }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error updating user location: ${err.message}` }],
        };
      }
    }
  );
}

