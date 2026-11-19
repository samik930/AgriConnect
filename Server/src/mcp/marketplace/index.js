#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { registerMarketplaceTools } from "./tools.js";

// Load environment variables (.env from Server root)
dotenv.config();

// Create the Marketplace MCP Server
const server = new McpServer({
  name: "agriconnect-marketplace-mcp",
  version: "1.0.0",
  capabilities: {
    tools: {},
  },
});

// Register all 9 Marketplace tools
registerMarketplaceTools(server);

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🛒 AgriConnect Marketplace MCP Server running on stdio");
}

run().catch((error) => {
  console.error("Fatal error in Marketplace MCP server:", error);
  process.exit(1);
});

