import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to the 4 MCP server entry points
const SERVER_CONFIGS = {
  farming: {
    name: "agriconnect-farming-mcp",
    script: path.resolve(__dirname, "../mcp/farming/index.js"),
  },
  marketplace: {
    name: "agriconnect-marketplace-mcp",
    script: path.resolve(__dirname, "../mcp/marketplace/index.js"),
  },
  logistics: {
    name: "agriconnect-logistics-mcp",
    script: path.resolve(__dirname, "../mcp/logistics/index.js"),
  },
  "order-support": {
    name: "agriconnect-order-support-mcp",
    script: path.resolve(__dirname, "../mcp/order-support/index.js"),
  },
};

class MCPClientManager {
  constructor() {
    this.clients = new Map();
    this.connecting = new Map();
  }

  /**
   * Get or initialize an active MCP Client connected to the specified server
   * @param {'farming' | 'marketplace' | 'logistics' | 'order-support'} serverKey
   * @returns {Promise<Client>}
   */
  async getClient(serverKey) {
    const config = SERVER_CONFIGS[serverKey];
    if (!config) {
      throw new Error(`Unknown MCP server key: '${serverKey}'. Available: ${Object.keys(SERVER_CONFIGS).join(", ")}`);
    }

    if (this.clients.has(serverKey)) {
      return this.clients.get(serverKey);
    }

    if (this.connecting.has(serverKey)) {
      return this.connecting.get(serverKey);
    }

    const connectPromise = (async () => {
      try {
        const transport = new StdioClientTransport({
          command: "node",
          args: [config.script],
        });

        const client = new Client(
          { name: `orchestrator-client-${serverKey}`, version: "1.0.0" },
          { capabilities: {} }
        );

        await client.connect(transport);
        this.clients.set(serverKey, client);
        this.connecting.delete(serverKey);
        return client;
      } catch (error) {
        this.connecting.delete(serverKey);
        console.error(`Failed to connect to MCP server '${serverKey}':`, error.message);
        throw error;
      }
    })();

    this.connecting.set(serverKey, connectPromise);
    return connectPromise;
  }

  /**
   * List available tools exposed by a specific MCP server
   * @param {string} serverKey
   */
  async listTools(serverKey) {
    const client = await this.getClient(serverKey);
    const result = await client.listTools();
    return result.tools || [];
  }

  /**
   * Invoke a tool on a specific MCP server
   * @param {string} serverKey
   * @param {string} toolName
   * @param {object} args
   */
  async callTool(serverKey, toolName, args = {}) {
    const client = await this.getClient(serverKey);
    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });
    return result;
  }

  /**
   * Gracefully close all active client transports
   */
  async closeAll() {
    for (const [key, client] of this.clients.entries()) {
      try {
        await client.close();
      } catch (e) {
        console.warn(`Error closing MCP client '${key}':`, e.message);
      }
    }
    this.clients.clear();
  }
}

// Singleton manager instance
export const mcpManager = new MCPClientManager();
export default mcpManager;

