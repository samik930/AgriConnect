import { explanation, cropSuggest } from "../services/llmService.js";
import { orchestrator } from "../orchestrator/Orchestrator.js";

export const farmingAssistant = async (req, res) => {
    try {
        const { question } = req.body;

        if (!question) {
            return res.status(400).json({
                message: "Question is required"
            });
        }

        const answer = await explanation(question);

        return res.status(200).json({
            answer
        });

    } catch (error) {
        console.log("AI Controller Error:", error);

        return res.status(500).json({
            message: "Failed to get AI response"
        });
    }
};

export const CropSuggestion = async(req,res) => {
    try {
        const { question,location,season,soil_type,availability } = req.body;
        if(!season || !soil_type || !availability || !location) {
            return res.status(400).json({
                message : "details required",
            })
        }
        const answer = await cropSuggest(question,location,season,soil_type,availability);
        return res.status(200).json({
            answer
        })
    } catch(error) {
        console.log("AI Controller Error:", error);

        return res.status(500).json({
            message: "Failed to get AI response"
        });
    } 
}

export const orchestrateQuery = async (req, res) => {
    try {
        const { query: userQuery, context } = req.body;

        if (!userQuery) {
            return res.status(400).json({ message: "Query text is required" });
        }

        const userContext = {
            ...(context || {}),
            user: req.user ? { id: req.user._id, role: req.user.role, name: req.user.name, location: req.user.location } : undefined,
        };

        const result = await orchestrator.handleRequest(userQuery, userContext);
        return res.status(200).json({
            success: true,
            userMessage: result.userMessage,
            routing: result.routing,
            plan: result.routing?.plan,
            finalAnswer: result.finalAnswer,
            synthesizedResponse: result.finalAnswer,
            answer: result.finalAnswer,
            agentResponses: result.agentResponses,
            executionSteps: result.agentResponses?.map((ar) => ({
                agent: ar.agent,
                role: ar.role,
                task: ar.toolCalls && ar.toolCalls.length > 0
                    ? `Invoked: ${ar.toolCalls.map((t) => t.tool).join(", ")}`
                    : ar.answer?.slice(0, 100),
                answer: ar.answer,
                toolCalls: ar.toolCalls,
            })),
            totalToolsInvoked: result.totalToolsInvoked,
        });
    } catch (error) {
        console.error("Orchestrator controller error:", error);
        return res.status(500).json({ message: "Failed to coordinate request", error: error.message });
    }
};