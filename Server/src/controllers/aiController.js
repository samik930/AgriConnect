import { explanation,cropSuggest } from "../services/geminiService.js";

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