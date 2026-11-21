import Groq from "groq-sdk";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Ensure .env is loaded
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export default groq;

