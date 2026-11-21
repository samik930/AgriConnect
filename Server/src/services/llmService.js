/**
 * Unified LLM Service — wraps Groq for all text generation needs.
 * Drop-in replacement for the previous Gemini geminiService.js calls.
 */
import groq from "../config/groq.js";
import { get7DayWeatherForecast } from "./weatherService.js";

// Default Groq model — llama-3.3-70b-versatile gives best instruction-following for agri tasks.
const DEFAULT_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

/**
 * Core text generation helper — sends a system + user message to Groq and returns text.
 * @param {string} systemPrompt
 * @param {string} userContent
 * @param {object} [options]
 * @param {number} [options.temperature=0.4]
 * @param {number} [options.maxTokens=2048]
 * @returns {Promise<string>}
 */
export async function generateText(systemPrompt, userContent, options = {}) {
  const { temperature = 0.4, maxTokens = 2048 } = options;

  const response = await groq.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature,
    max_tokens: maxTokens,
  });

  return response.choices?.[0]?.message?.content?.trim() || "";
}

/**
 * explanation() — Farming advisor: weather forecasts, pest advice, agronomic guidance.
 * @param {string} question
 * @returns {Promise<string>}
 */
export const explanation = async (question) => {
  try {
    const lower = (question || "").toLowerCase();
    let weatherContext = "";

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
          "ahmedabad", "jaipur", "lucknow", "patna", "bhopal", "indore",
        ];
        const matchedCity = cities.find((c) => lower.includes(c)) || "Pune";
        const forecastData = await get7DayWeatherForecast(matchedCity);
        weatherContext = `\n\nREAL-TIME 7-DAY WEATHER DATA FOR ${forecastData.location.toUpperCase()}:\n${JSON.stringify(forecastData, null, 2)}\n\nFormat this into a clean 7-day forecast with daily high/low temperatures (°C), conditions, rain chance (%), and farming tips (irrigation, spraying, harvesting).`;
      } catch (wErr) {
        console.warn("Could not attach weather context:", wErr.message);
      }
    }

    const system = `You are an expert AI farming and agricultural weather advisor in AgriConnect.
Help farmers with clear, practical agricultural advice.

If the question is about weather or a 7-day forecast:
- Present a comprehensive 7-day forecast day-by-day (Today, Tomorrow, and the next 5 days).
- For each day, include: Day & Date, Condition (with emoji), High/Low Temp (°C), Rain Probability (%), and a practical Farming Advisory (e.g. good day for spraying, hold off irrigation, good harvest day).
- Conclude with a Weekly Farming Recommendation.

For agronomic, pest, or crop disease questions, provide:
1. Possible reasons
2. Solutions
3. Prevention tips

Keep the tone supportive, simple, and practical for farmers.`;

    return await generateText(system, `${question}${weatherContext}`);
  } catch (error) {
    console.error("LLM Service (explanation) Error:", error.message);
    throw error;
  }
};

/**
 * cropSuggest() — Recommends best crops based on location, season, soil, and water.
 */
export const cropSuggest = async (question, location, season, soil_type, availability) => {
  try {
    const system = `You are an agricultural expert.
Based on the following information, recommend the best crops.

For each crop provide:
1. Crop name
2. Why it is suitable
3. Expected growing season
4. Basic cultivation tips

Recommend only 3-5 crops. Keep the answer simple and practical.`;

    const userContent = `Location: ${location}
Season: ${season}
Soil Type: ${soil_type}
Water Availability: ${availability}
Farmer question: ${question}`;

    return await generateText(system, userContent);
  } catch (error) {
    console.error("LLM Service (cropSuggest) Error:", error.message);
    throw error;
  }
};

