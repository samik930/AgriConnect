import ai from "../../config/gemini.js";
import mcpManager from "../MCPClientManager.js";

/**
 * BaseAgent represents a specialized AI agent connected to an MCP Server
 */
export class BaseAgent {
  /**
   * @param {object} config
   * @param {string} config.name - Display name of the agent
   * @param {string} config.role - Role / title of the agent
   * @param {string} config.serverKey - 'farming' | 'marketplace' | 'logistics' | 'order-support'
   * @param {string} config.systemPrompt - Specialized domain expertise instructions
   */
  constructor({ name, role, serverKey, systemPrompt }) {
    this.name = name;
    this.role = role;
    this.serverKey = serverKey;
    this.systemPrompt = systemPrompt;
  }

  /**
   * Fetch all available tools from the connected MCP server
   */
  async getTools() {
    return await mcpManager.listTools(this.serverKey);
  }

  /**
   * Directly call an MCP tool exposed by this agent's server
   */
  async callTool(toolName, args = {}) {
    const result = await mcpManager.callTool(this.serverKey, toolName, args);
    return result;
  }

  /**
   * Adapt MCP inputSchema to Gemini function declaration parameter schema
   */
  adaptSchemaToGemini(schema) {
    if (!schema) return { type: "OBJECT", properties: {} };

    const mapType = (t) => {
      switch ((t || "").toLowerCase()) {
        case "string": return "STRING";
        case "number": return "NUMBER";
        case "integer": return "INTEGER";
        case "boolean": return "BOOLEAN";
        case "array": return "ARRAY";
        case "object": return "OBJECT";
        default: return "STRING";
      }
    };

    const convertProp = (p) => {
      const type = mapType(p.type);
      const res = {
        type,
        description: p.description || "",
      };
      if (type === "ARRAY" && p.items) {
        res.items = convertProp(p.items);
      }
      if (type === "OBJECT" && p.properties) {
        res.properties = {};
        for (const [k, v] of Object.entries(p.properties)) {
          res.properties[k] = convertProp(v);
        }
      }
      return res;
    };

    const properties = {};
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        properties[key] = convertProp(prop);
      }
    }

    return {
      type: "OBJECT",
      properties,
      required: schema.required || [],
    };
  }

  /**
   * Execute a task using Gemini reasoning and the agent's MCP tools
   * @param {string} taskDescription - Specific instruction or question
   * @param {object} context - User context, location, previous step outputs
   * @returns {Promise<{ agent: string, answer: string, toolCalls: Array }>}
   */
  async execute(taskDescription, context = {}) {
    const tools = await this.getTools();
    const toolCallsExecuted = [];

    // Format Gemini function declarations
    const functionDeclarations = tools.map((t) => ({
      name: t.name,
      description: t.description || "",
      parameters: this.adaptSchemaToGemini(t.inputSchema),
    }));

    const systemInstruction = `
${this.systemPrompt}

You are '${this.name}' (${this.role}) in the AgriConnect multi-agent architecture.
You have direct access to tools on the '${this.serverKey}' MCP server.

CRITICAL INSTRUCTIONS:
1. Select the single most relevant tool for the task.
2. DO NOT make repeated search tool calls in a loop with minor keyword variations.
3. Once you receive the tool execution results, immediately generate your comprehensive, detailed, and polite final response to the user. Do not call any further tools.
4. If a tool returns empty or zero records, do NOT search again; state clearly what was found in the database and provide authoritative general agricultural guidance.

User Context:
${JSON.stringify(context, null, 2)}
    `.trim();

    let contents = [
      {
        role: "user",
        parts: [{ text: taskDescription }],
      },
    ];

    let maxTurns = 4;
    let finalAnswer = "";

    try {
      while (maxTurns > 0) {
        maxTurns--;

        const modelName = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations }],
          },
        });

        const candidate = response.candidates?.[0];
        const contentParts = candidate?.content?.parts || [];

        // Check if Gemini invoked any function calls
        const functionCallPart = contentParts.find((p) => p.functionCall);

        if (functionCallPart && functionCallPart.functionCall) {
          const call = functionCallPart.functionCall;
          const toolName = call.name;
          const toolArgs = call.args || {};

          // Execute tool on our MCP Server
          let toolResultText = "";
          try {
            const mcpRes = await this.callTool(toolName, toolArgs);
            toolResultText = mcpRes.content?.map((c) => c.text).join("\n") || "Success";
            toolCallsExecuted.push({ tool: toolName, args: toolArgs, result: toolResultText });
          } catch (toolErr) {
            toolResultText = `Tool execution error: ${toolErr.message}`;
            toolCallsExecuted.push({ tool: toolName, args: toolArgs, error: toolErr.message });
          }

          // Feed function result back to Gemini
          contents.push({
            role: "model",
            parts: [functionCallPart],
          });

          contents.push({
            role: "user",
            parts: [
              {
                functionResponse: {
                  name: toolName,
                  response: { result: toolResultText },
                },
              },
            ],
          });
        } else {
          // Gemini gave a text answer
          finalAnswer = response.text || contentParts.map((p) => p.text).filter(Boolean).join("\n");
          break;
        }
      }

      // Fallback if turns ran out before Gemini returned text
      if (!finalAnswer && toolCallsExecuted.length > 0) {
        const lastResult = toolCallsExecuted[toolCallsExecuted.length - 1]?.result;
        finalAnswer = lastResult
          ? `Here is the information retrieved from the AgriConnect database:\n\n${lastResult}`
          : "Task completed based on database query.";
      }
    } catch (llmError) {
      console.warn(`[${this.name}] Gemini call warning:`, llmError.message);
      const lastResult = toolCallsExecuted[toolCallsExecuted.length - 1]?.result;
      finalAnswer = lastResult
        ? `Retrieved information:\n\n${lastResult}`
        : `[${this.name}] completed task with tools: ${toolCallsExecuted.map((t) => t.tool).join(", ") || "none"}.`;
    }

    return {
      agent: this.name,
      role: this.role,
      serverKey: this.serverKey,
      answer: finalAnswer || "Task completed.",
      toolCalls: toolCallsExecuted,
    };
  }
}

export default BaseAgent;

