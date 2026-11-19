#!/usr/bin/env node
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { orchestrator, Orchestrator } from "./Orchestrator.js";
import { mcpManager } from "./MCPClientManager.js";

dotenv.config();

export { orchestrator, Orchestrator, mcpManager };

// CLI interactive runner
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const queryArg = process.argv.slice(2).join(" ");
  const userQuery = queryArg || "What government subsidies are available for drip irrigation in Maharashtra?";

  console.log("=================================================");
  console.log("   AgriConnect Multi-Agent MCP Orchestrator");
  console.log("=================================================");
  console.log(`\nQuery: "${userQuery}"\n`);
  console.log("Planning and delegating to specialized agents...\n");

  orchestrator
    .handleRequest(userQuery, {
      userLocation: { state: "Maharashtra", district: "Pune", latitude: 18.5204, longitude: 73.8567 },
      role: "farmer",
    })
    .then((result) => {
      console.log("\n--- ORCHESTRATION PLAN ---");
      console.log("Primary Domain:", result.routing.primaryAgent);
      console.log("Agents Engaged:", result.routing.requiredAgents.join(" -> "));
      console.log("Plan:", result.routing.plan);

      console.log("\n--- SPECIALIZED AGENT REPORTS ---");
      for (const ar of result.agentResponses) {
        console.log(`\n[${ar.agent} (${ar.role})]:`);
        console.log("Tools Invoked:", ar.toolCalls.map((t) => t.tool).join(", ") || "None");
        console.log("Findings:", ar.answer);
      }

      console.log("\n=================================================");
      console.log("   SYNTHESIZED FINAL RESPONSE");
      console.log("=================================================\n");
      console.log(result.finalAnswer);
      console.log("\n=================================================");
      console.log(`Total MCP Tools Invoked: ${result.totalToolsInvoked}`);
      console.log("=================================================\n");
      return orchestrator.shutdown();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\nOrchestrator execution error:", err);
      process.exit(1);
    });
}

