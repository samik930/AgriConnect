import ai from "../config/gemini.js";


export const explanation = async (question) => {

    try {

        const response = await ai.models.generateContent({

            model: "gemini-3-flash-preview",

            contents: `
You are an AI farming assistant.

Help farmers with practical agricultural advice.

For every question provide:
1. Possible reasons
2. Solutions
3. Prevention tips

Keep the answer simple because the user is a farmer.

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