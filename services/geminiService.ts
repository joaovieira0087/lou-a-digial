
import { GoogleGenAI, Type } from "@google/genai";

export interface MathResult {
  expression: string;
  result: string;
  x: number;
  y: number;
}

/**
 * Sends a base64 image of the canvas to Gemini to identify and solve mathematical expressions.
 * The model identifies math, solves it, and returns coordinates for placing labels.
 */
export const solveMathOnCanvas = async (base64Image: string): Promise<MathResult[]> => {
  try {
    // Fix: Moved GoogleGenAI initialization inside the function as per guidelines to handle potential API key updates
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Fix: Using gemini-3-pro-preview for complex math reasoning tasks as per guidelines
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Image.split(',')[1],
            },
          },
          {
            text: `Identify any mathematical expressions (like 2+2, 5*10, etc.) in this drawing. 
            For each expression found:
            1. Solve it.
            2. Estimate the center coordinates (x, y) of the expression in pixels relative to the image size.
            Return the results as a JSON array of objects with keys: "expression", "result", "x", "y".
            Only return valid JSON. If no math is found, return an empty array [].`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              expression: { type: Type.STRING, description: 'The math expression identified' },
              result: { type: Type.STRING, description: 'The solved result' },
              x: { type: Type.NUMBER, description: 'X coordinate relative to image' },
              y: { type: Type.NUMBER, description: 'Y coordinate relative to image' },
            },
            required: ["expression", "result", "x", "y"],
            propertyOrdering: ["expression", "result", "x", "y"],
          },
        },
      },
    });

    // Fix: Directly access the .text property of GenerateContentResponse (do not use .text())
    const jsonStr = response.text?.trim();
    if (!jsonStr) return [];
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Math Solving Error:", error);
    return [];
  }
};
