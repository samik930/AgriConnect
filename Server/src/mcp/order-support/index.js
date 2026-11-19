#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { registerOrderSupportTools } from "./tools.js";

// Load environment variables (.env from Server root)
dotenv.config();

// Create the Order & Customer Support MCP Server
const server = new McpServer({
  name: "agriconnect-order-support-mcp",
  version: "1.0.0",
  capabilities: {
    tools: {},
  },
});

// Register all 9 Order & Support tools
registerOrderSupportTools(server);

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("📦 AgriConnect Order & Customer Support MCP Server running on stdio");
}

run().catch((error) => {
  console.error("Fatal error in Order & Support MCP server:", error);
  process.exit(1);
});

