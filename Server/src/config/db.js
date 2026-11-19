import { testConnection } from "../db/index.js";
import runMigrations from "../db/migrate.js";

const connectDB = async () => {
  try {
    const connected = await testConnection();
    if (connected) {
      // Auto-verify schema on startup
      try {
        await runMigrations();
      } catch (migErr) {
        console.warn("Schema auto-migration check warning:", migErr.message);
      }
    } else {
      console.log("Retrying PostgreSQL connection in 5 seconds...");
      setTimeout(connectDB, 5000);
    }
  } catch (error) {
    console.error("PostgreSQL connection error:", error.message);
    console.log("Retrying in 5 seconds...");
    setTimeout(connectDB, 5000);
  }
};

export default connectDB;
