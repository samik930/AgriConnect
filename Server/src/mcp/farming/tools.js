import { z } from "zod";
import { query } from "../../db/index.js";
import { formatScheme, formatTechnology } from "../../utils/formatters.js";
import { cropSuggest, explanation } from "../../services/geminiService.js";
import { get7DayWeatherForecast } from "../../services/weatherService.js";

/**
 * Register all 12 Farming & Agricultural tools onto an McpServer instance
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 */
export function registerFarmingTools(server) {
  // ==========================================
  // 1. GOVERNMENT SCHEMES TOOLS
  // ==========================================

  server.tool(
    "get_schemes_by_region",
    "Retrieve government schemes, subsidies, and grants applicable to a farmer's state and optional district.",
    {
      state: z.string().describe("State name (e.g. 'West Bengal', 'Maharashtra', 'Punjab')"),
      district: z.string().optional().describe("Optional district name (e.g. 'Kolkata', 'Pune')"),
    },
    async ({ state, district }) => {
      try {
        const sql = `
          SELECT id, title, description, state, district, eligibility, application_link, created_at, updated_at
          FROM schemes
          WHERE (state = $1 OR state = 'All')
            AND ($2::text IS NULL OR district IS NULL OR district = 'All' OR district ILIKE $2)
          ORDER BY created_at DESC
        `;
        const res = await query(sql, [state, district || null]);
        const schemes = res.rows.map(formatScheme);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ count: schemes.length, schemes }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching schemes: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "get_scheme_details",
    "Get complete details, eligibility requirements, and application links for a specific government scheme by ID.",
    {
      scheme_id: z.string().describe("UUID of the scheme"),
    },
    async ({ scheme_id }) => {
      try {
        const res = await query("SELECT * FROM schemes WHERE id = $1", [scheme_id]);
        if (res.rows.length === 0) {
          return {
            isError: true,
            content: [{ type: "text", text: `Scheme with ID '${scheme_id}' was not found.` }],
          };
        }

        const scheme = formatScheme(res.rows[0]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(scheme, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching scheme details: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "search_schemes",
    "Search government schemes by keyword in title, description, or eligibility criteria.",
    {
      keyword: z.string().describe("Search term (e.g. 'subsidy', 'irrigation', 'fertilizer', 'solar')"),
    },
    async ({ keyword }) => {
      try {
        const pattern = `%${keyword}%`;
        const sql = `
          SELECT id, title, description, state, district, eligibility, application_link
          FROM schemes
          WHERE title ILIKE $1 OR description ILIKE $1 OR eligibility ILIKE $1
          ORDER BY created_at DESC
          LIMIT 20
        `;
        const res = await query(sql, [pattern]);
        const schemes = res.rows.map(formatScheme);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ keyword, resultsCount: schemes.length, schemes }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error searching schemes: ${err.message}` }],
        };
      }
    }
  );

  // ==========================================
  // 2. FARMING TECHNOLOGIES & ADVISORY
  // ==========================================

  server.tool(
    "get_technologies_by_region",
    "Fetch modern agricultural techniques, equipment guidelines, and resource links relevant to a farmer's region.",
    {
      state: z.string().describe("Farmer's state name"),
      district: z.string().optional().describe("Optional district name"),
    },
    async ({ state, district }) => {
      try {
        const sql = `
          SELECT id, title, description, state, district, resource_link, created_at, updated_at
          FROM technologies
          WHERE (state = $1 OR state = 'All')
            AND ($2::text IS NULL OR district IS NULL OR district = 'All' OR district ILIKE $2)
          ORDER BY created_at DESC
        `;
        const res = await query(sql, [state, district || null]);
        const technologies = res.rows.map(formatTechnology);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ count: technologies.length, technologies }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching technologies: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "get_technology_details",
    "Get full technical specifications, guide descriptions, and resource links for a specific agricultural technology by ID.",
    {
      technology_id: z.string().describe("UUID of the technology"),
    },
    async ({ technology_id }) => {
      try {
        const res = await query("SELECT * FROM technologies WHERE id = $1", [technology_id]);
        if (res.rows.length === 0) {
          return {
            isError: true,
            content: [{ type: "text", text: `Technology with ID '${technology_id}' was not found.` }],
          };
        }

        const tech = formatTechnology(res.rows[0]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(tech, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching technology details: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "search_technologies",
    "Search agricultural technologies and farming practices by keyword.",
    {
      query: z.string().describe("Keyword search (e.g. 'hydroponics', 'drip irrigation', 'tractor', 'organic compost')"),
    },
    async ({ query: searchKeyword }) => {
      try {
        const pattern = `%${searchKeyword}%`;
        const sql = `
          SELECT id, title, description, state, district, resource_link
          FROM technologies
          WHERE title ILIKE $1 OR description ILIKE $1
          ORDER BY created_at DESC
          LIMIT 20
        `;
        const res = await query(sql, [pattern]);
        const technologies = res.rows.map(formatTechnology);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ query: searchKeyword, resultsCount: technologies.length, technologies }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error searching technologies: ${err.message}` }],
        };
      }
    }
  );

  // ==========================================
  // 3. MARKET COMMODITY PRICE INTELLIGENCE
  // ==========================================

  server.tool(
    "get_market_price",
    "Retrieve the prevailing mandi/market price and measurement unit for a specific crop in a given district.",
    {
      crop_name: z.string().describe("Name of the crop/commodity (e.g. 'Rice', 'Wheat', 'Tomato', 'Potato')"),
      district: z.string().describe("District or market location (e.g. 'Pune', 'Kolkata', 'Nagpur')"),
    },
    async ({ crop_name, district }) => {
      try {
        const sql = `
          SELECT id, crop_name, district, market_price, unit, updated_at
          FROM market_prices
          WHERE crop_name ILIKE $1 AND district ILIKE $2
          ORDER BY updated_at DESC
          LIMIT 1
        `;
        const res = await query(sql, [crop_name, district]);
        if (res.rows.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  found: false,
                  message: `No price data currently recorded for crop '${crop_name}' in district '${district}'.`,
                }),
              },
            ],
          };
        }

        const row = res.rows[0];
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  found: true,
                  crop: row.crop_name,
                  district: row.district,
                  price: parseFloat(row.market_price),
                  unit: row.unit,
                  lastUpdated: row.updated_at,
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
          content: [{ type: "text", text: `Error fetching market price: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "list_district_crop_prices",
    "List all crop market prices and rates currently tracked for a specified district.",
    {
      district: z.string().describe("District name to query (e.g. 'Pune', 'Kolkata')"),
    },
    async ({ district }) => {
      try {
        const sql = `
          SELECT id, crop_name, district, market_price, unit, updated_at
          FROM market_prices
          WHERE district ILIKE $1
          ORDER BY crop_name ASC
        `;
        const res = await query(sql, [district]);
        const prices = res.rows.map((r) => ({
          id: r.id,
          crop: r.crop_name,
          district: r.district,
          price: parseFloat(r.market_price),
          unit: r.unit,
          lastUpdated: r.updated_at,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ district, count: prices.length, prices }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error listing district crop prices: ${err.message}` }],
        };
      }
    }
  );

  // ==========================================
  // 4. TRAINING WORKSHOPS
  // ==========================================

  server.tool(
    "get_upcoming_trainings",
    "Retrieve upcoming farmer training programs, workshops, webinars, and field demonstrations.",
    {
      location: z.string().optional().describe("Optional location or state filter (e.g. 'Pune', 'West Bengal')"),
    },
    async ({ location }) => {
      try {
        let sql;
        let params = [];

        if (location) {
          sql = `
            SELECT id, title, organizer, date, location, registration_link, created_at
            FROM trainings
            WHERE date >= NOW() AND location ILIKE $1
            ORDER BY date ASC
          `;
          params = [`%${location}%`];
        } else {
          sql = `
            SELECT id, title, organizer, date, location, registration_link, created_at
            FROM trainings
            WHERE date >= NOW()
            ORDER BY date ASC
          `;
        }

        const res = await query(sql, params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ count: res.rows.length, trainings: res.rows }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching upcoming trainings: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "get_training_details",
    "Get full details, organizer information, date, venue, and registration link for a specific training program.",
    {
      training_id: z.string().describe("UUID of the training program"),
    },
    async ({ training_id }) => {
      try {
        const res = await query("SELECT * FROM trainings WHERE id = $1", [training_id]);
        if (res.rows.length === 0) {
          return {
            isError: true,
            content: [{ type: "text", text: `Training program with ID '${training_id}' not found.` }],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(res.rows[0], null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching training details: ${err.message}` }],
        };
      }
    }
  );

  // ==========================================
  // 5. AI CROP & SOIL ADVISORY
  // ==========================================

  server.tool(
    "suggest_crops",
    "AI-powered seasonal crop suggestion based on a farmer's location, soil type, season, and resource availability.",
    {
      question: z.string().describe("The farmer's specific query or goal"),
      location: z.string().describe("Farmer's location or region (e.g. 'North Bengal', 'Vidarbha')"),
      season: z.string().describe("Current or upcoming crop season (e.g. 'Kharif', 'Rabi', 'Zaid', 'Monsoon')"),
      soil_type: z.string().describe("Type of soil on the farm (e.g. 'Alluvial', 'Black', 'Red', 'Clay Loam')"),
      availability: z.string().describe("Water and capital resource level (e.g. 'Abundant canal irrigation', 'Rain-dependent', 'Borewell')"),
    },
    async ({ question, location, season, soil_type, availability }) => {
      try {
        const answer = await cropSuggest(question, location, season, soil_type, availability);
        return {
          content: [
            {
              type: "text",
              text: answer,
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error from AI Crop Suggestion service: ${err.message}` }],
        };
      }
    }
  );

  server.tool(
    "ask_farming_assistant",
    "AI agricultural advisor capable of answering farming questions regarding pest control, plant pathology, weather protection, fertilizers, and organic farming.",
    {
      question: z.string().describe("The agricultural question to ask the advisor"),
    },
    async ({ question }) => {
      try {
        const answer = await explanation(question);
        return {
          content: [
            {
              type: "text",
              text: answer,
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error from Farming AI Assistant: ${err.message}` }],
        };
      }
    }
  );

  // ==========================================
  // 6. 7-DAY WEATHER FORECAST & ADVISORY
  // ==========================================

  server.tool(
    "get_7day_weather_forecast",
    "Retrieve an agricultural weather report for the next 7 days (including daily high/low temperatures, precipitation chance, rainfall mm, wind speed, condition, and actionable farming advisories for spraying, irrigation, and harvest).",
    {
      location: z.string().describe("City, district, or state name (e.g. 'Pune', 'Nashik', 'Maharashtra', 'Ludhiana', 'Patna')"),
      latitude: z.number().optional().describe("Optional latitude coordinate"),
      longitude: z.number().optional().describe("Optional longitude coordinate"),
    },
    async ({ location, latitude, longitude }) => {
      try {
        const forecast = await get7DayWeatherForecast(location, latitude, longitude);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(forecast, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching 7-day weather forecast: ${err.message}` }],
        };
      }
    }
  );
}

