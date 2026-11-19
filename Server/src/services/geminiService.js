import ai from "../config/gemini.js";
import { get7DayWeatherForecast } from "./weatherService.js";

export const explanation = async (question) => {
    try {
        const lower = (question || "").toLowerCase();
        let weatherContext = "";

        // If the question asks about weather, forecast, rain, or temperatures
        if (
            lower.includes("weather") ||
            lower.includes("forecast") ||
            lower.includes("rain") ||
            lower.includes("temperature") ||
            lower.includes("climate") ||
            lower.includes("7 days") ||
            lower.includes("7 day") ||
            lower.includes("next 7")
        ) {
            try {
                const cities = [
                    "pune", "mumbai", "nashik", "nagpur", "aurangabad", "kolhapur", "solapur", "satara",
                    "delhi", "punjab", "ludhiana", "amritsar", "haryana", "karnal",
                    "bengaluru", "bangalore", "hyderabad", "chennai", "kolkata",
                    "ahmedabad", "jaipur", "lucknow", "patna", "bhopal", "indore"
                ];
                const matchedCity = cities.find((c) => lower.includes(c)) || "Pune";
                const forecastData = await get7DayWeatherForecast(matchedCity);
                weatherContext = `\n\nREAL-TIME 7-DAY WEATHER DATA FOR ${forecastData.location.toUpperCase()}:\n${JSON.stringify(forecastData, null, 2)}\n\nFormat this into a clean 7-day forecast with daily high/low temperatures (°C), conditions, rain chance (%), and farming tips (irrigation, spraying, harvesting).`;
            } catch (wErr) {
                console.warn("Could not attach weather context in explanation:", wErr.message);
            }
        }

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `
You are an expert AI farming and agricultural weather advisor in AgriConnect.

Help farmers with clear, practical agricultural advice.

If the question is about weather or a 7-day forecast:
- Present a comprehensive 7-day forecast day-by-day (Today, Tomorrow, and the next 5 days).
- For each day, include: Day & Date, Condition (with emoji), High/Low Temp (°C), Rain Probability (%), and a practical Farming Advisory (e.g. good day for spraying, hold off irrigation, good harvest day).
- Conclude with a Weekly Farming Recommendation.

For agronomic, pest, or crop disease questions, provide:
1. Possible reasons
2. Solutions
3. Prevention tips

Keep the tone supportive, simple, and practical for farmers.

Farmer question:
${question}${weatherContext}
`
        });

        return response.text;

    } catch(error) {
        console.log("Gemini Service Error:", error);
        throw error;
    }
};

export const cropSuggest = async (question,location,season,soil_type,availability) => {

    try {

        const response = await ai.models.generateContent({

            model: "gemini-3-flash-preview",

            contents: `
You are an agricultural expert.

Based on the following information, recommend the best crops.

Location: ${location}
Season: ${season}
Soil Type: ${soil_type}
Water Availability: ${availability}

For each crop provide:
1. Crop name
2. Why it is suitable
3. Expected growing season
4. Basic cultivation tips

Recommend only 3-5 crops.
Keep the answer simple and practical.
Farmer question:
${question}
`
        });


        return response.text;

    } catch(error) {

        console.log("Gemini Service Error:", error);
        throw error;

    }
};