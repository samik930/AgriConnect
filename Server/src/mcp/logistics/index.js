#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { registerLogisticsTools } from "./tools.js";

// Load environment variables (.env from Server root)
dotenv.config();

// Create the Location & Logistics MCP Server
const server = new McpServer({
  name: "agriconnect-logistics-mcp",
  version: "1.0.0",
  capabilities: {
    tools: {},
  },
});

// Register all 6 Logistics & PostGIS tools
registerLogisticsTools(server);

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("📍 AgriConnect Location & Logistics MCP Server running on stdio");
}

run().catch((error) => {
  console.error("Fatal error in Logistics MCP server:", error);
  process.exit(1);
});

