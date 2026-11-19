import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// Supabase PostgreSQL connection configuration
// Accepts DATABASE_URL (or SUPABASE_DB_URL) or individual PG environment variables
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

const poolConfig = connectionString
  ? {
      connectionString,
      ssl: {
        rejectUnauthorized: false, // Required for Supabase cloud PostgreSQL
      },
      max: 20, // max connection pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.PGHOST || "localhost",
      user: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD || "",
      database: process.env.PGDATABASE || "postgres",
      port: parseInt(process.env.PGPORT || "5432", 10),
      ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

export const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});

/**
 * Execute a parameterized query using the connection pool
 * @param {string} text - SQL query text with $1, $2 placeholders
 * @param {Array} params - Parameter values array
 * @returns {Promise<pg.QueryResult>}
 */
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (error) {
    console.error("Database query error:", { text, error: error.message });
    throw error;
  }
};

/**
 * Acquire a dedicated client for multi-query operations or manual transactions
 * Remember to call client.release() when finished!
 */
export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

/**
 * Execute a unit of work inside a managed transaction
 * Automatically begins, commits, or rolls back on failure
 * @param {Function} callback - async (client) => result
 * @returns {Promise<any>}
 */
export const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Test database connection
 */
export const testConnection = async () => {
  try {
    const res = await query("SELECT NOW() as now, version() as version");
    console.log(`PostgreSQL Connected: ${res.rows[0].now}`);
    return true;
  } catch (error) {
    console.error("PostgreSQL connection failed:", error.message);
    return false;
  }
};

export default {
  pool,
  query,
  getClient,
  withTransaction,
  testConnection,
};

