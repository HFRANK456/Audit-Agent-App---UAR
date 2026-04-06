import { GoogleGenAI } from "@google/genai";
import { AccessReview, Connector, User } from "../types";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeAccess(review: AccessReview, user: User, connector: Connector) {
  const model = "gemini-3-flash-preview";
  const prompt = `
    Analyze the following user access review and provide a recommendation.
    User: ${user.name} (${user.role} in ${user.department})
    Connector: ${connector.name} (${connector.type})
    Resource: ${review.resource}
    Permission: ${review.permission}
    
    Provide a JSON response with:
    - recommendation: A short string (e.g., "Safe", "Flag: [Reason]", "Critical: [Reason]")
    - confidence: A number between 0 and 1
    - reasoning: A brief explanation of why this recommendation was made.
  `;

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
}
