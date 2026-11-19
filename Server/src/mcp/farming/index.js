#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { registerFarmingTools } from "./tools.js";

// Load environment variables (.env from Server root)
dotenv.config();

// Create the Farming & Agricultural MCP Server
const server = new McpServer({
  name: "agriconnect-farming-mcp",
  version: "1.0.0",
  capabilities: {
    tools: {},
  },
});

// Register all 12 tools
registerFarmingTools(server);

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🌾 AgriConnect Farming & Agricultural MCP Server running on stdio");
}

run().catch((error) => {
  console.error("Fatal error in Farming MCP server:", error);
  process.exit(1);
});

