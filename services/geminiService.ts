
import { GoogleGenAI, Type } from "@google/genai";
import { BenchmarkDataset, GeminiModel } from "../types";

export const searchBenchmarkDatasets = async (query: string, model: GeminiModel): Promise<BenchmarkDataset[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Search for benchmark datasets related to the topic: "${query}".
    Focus on finding information from arXiv, Hugging Face (datasets), Google Scholar, and Semantic Scholar.
    
    For each unique benchmark found, extract:
    1. Dataset Title
    2. Primary Paper Link (arXiv or official source)
    3. GitHub repository link (if available)
    4. Dataset count/size (e.g., number of samples, storage size)
    5. Specifications (data format, modalities like text/image/audio)
    6. Brief description of the benchmark's purpose
    7. Publication year and primary authors
    
    Format the results as a JSON array of objects.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        // responseMimeType is used to guide the model towards JSON, 
        // but we implement manual JSON extraction to handle citations.
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              source: { type: Type.STRING, description: "One of: arXiv, Hugging Face, Scholar, Semantic Scholar" },
              paperLink: { type: Type.STRING },
              githubLink: { type: Type.STRING },
              description: { type: Type.STRING },
              itemCount: { type: Type.STRING },
              specs: { type: Type.STRING },
              year: { type: Type.STRING },
              authors: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "paperLink", "description"]
          }
        }
      }
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    // As per Search Grounding guidelines, output might not be strictly JSON 
    // because of citations or additional text. We extract the array block.
    let responseText = response.text || "[]";
    const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }
    
    const rawData = JSON.parse(responseText);

    // Map the LLM output to our application type, injecting grounding info if needed
    return rawData.map((item: any, index: number) => ({
      ...item,
      id: `${Date.now()}-${index}`,
      source: item.source || 'Other',
      groundingSources: groundingChunks.map((chunk: any) => {
        const uri = chunk.web?.uri || chunk.maps?.uri;
        const title = chunk.web?.title || chunk.maps?.title;
        return (uri && title) ? { uri, title } : null;
      }).filter((s): s is { uri: string; title: string } => s !== null)
    }));
  } catch (error) {
    console.error("Gemini Search Error:", error);
    throw new Error("Failed to fetch benchmark data. Please try again later.");
  }
};
