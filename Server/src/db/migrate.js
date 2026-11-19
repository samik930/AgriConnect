import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool, query } from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const runMigrations = async () => {
  console.log("Running PostgreSQL database schema migrations...");
  try {
    const schemaSqlPath = path.join(__dirname, "schema.sql");
    const schemaSql = fs.readFileSync(schemaSqlPath, "utf-8");

    await query(schemaSql);
    console.log("All tables, PostGIS extensions, and indexes verified / created successfully!");
    return true;
  } catch (error) {
    console.error("Migration error:", error.message);
    throw error;
  }
};

// If run directly from CLI (e.g. node src/db/migrate.js)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => {
      console.log("Migration complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export default runMigrations;

