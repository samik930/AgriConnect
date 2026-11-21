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

const DEFAULT_TOOL_TIMEOUT_MS = 12000; // 12-second execution guardrail

class MCPClientManager {
  constructor() {
    this.clients = new Map();
    this.connecting = new Map();
    this.transports = new Map();
  }

  /**
   * Get or initialize an active MCP Client connected to the specified server
   * Auto-heals and reconnects if transport was dropped.
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

        // Guardrail: monitor child transport drops and purge dead client
        if (transport.process) {
          transport.process.on("exit", (code, signal) => {
            console.warn(`[MCPManager] Server '${serverKey}' process exited (code=${code}, signal=${signal}). Purging client cache.`);
            this.purgeClient(serverKey);
          });
          transport.process.on("error", (err) => {
            console.error(`[MCPManager] Transport error in '${serverKey}':`, err.message);
            this.purgeClient(serverKey);
          });
        }

        const client = new Client(
          { name: `orchestrator-client-${serverKey}`, version: "1.0.0" },
          { capabilities: {} }
        );

        await client.connect(transport);
        this.clients.set(serverKey, client);
        this.transports.set(serverKey, transport);
        this.connecting.delete(serverKey);
        return client;
      } catch (error) {
        this.connecting.delete(serverKey);
        this.purgeClient(serverKey);
        console.error(`Failed to connect to MCP server '${serverKey}':`, error.message);
        throw error;
      }
    })();

    this.connecting.set(serverKey, connectPromise);
    return connectPromise;
  }

  /**
   * Purge client and transport references on error or exit
   */
  purgeClient(serverKey) {
    this.clients.delete(serverKey);
    this.connecting.delete(serverKey);
    const transport = this.transports.get(serverKey);
    if (transport) {
      try {
        transport.close();
      } catch (_) {}
      this.transports.delete(serverKey);
    }
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
   * Invoke a tool on a specific MCP server with execution timeout guardrail
   * @param {string} serverKey
   * @param {string} toolName
   * @param {object} args
   * @param {number} timeoutMs
   */
  async callTool(serverKey, toolName, args = {}, timeoutMs = DEFAULT_TOOL_TIMEOUT_MS) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`MCP Tool '${toolName}' timed out after ${timeoutMs / 1000} seconds.`));
      }, timeoutMs);
    });

    try {
      const client = await this.getClient(serverKey);
      const callPromise = client.callTool({
        name: toolName,
        arguments: args,
      });

      const result = await Promise.race([callPromise, timeoutPromise]);
      return result;
    } catch (err) {
      // If error indicates transport failure, purge client so next call reconnects
      if (err.message && (err.message.includes("closed") || err.message.includes("EPIPE") || err.message.includes("transport"))) {
        this.purgeClient(serverKey);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Gracefully close all active client transports
   */
  async closeAll() {
    for (const key of Object.keys(SERVER_CONFIGS)) {
      this.purgeClient(key);
    }
  }
}

// Singleton manager instance
export const mcpManager = new MCPClientManager();
export default mcpManager;
