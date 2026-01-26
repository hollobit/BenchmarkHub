
import { GoogleGenAI, Type } from "@google/genai";
import { BenchmarkDataset, GeminiModel } from "../types";

export const searchBenchmarkDatasets = async (query: string, model: GeminiModel): Promise<BenchmarkDataset[]> => {
  // Always create a new instance right before making an API call to ensure it uses the most up-to-date API key.
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
    // Note: Per guidelines for Search Grounding, response.text might not always be JSON.
    const rawData = JSON.parse(response.text || "[]");

    // Map the LLM output to our application type, injecting grounding info.
    return rawData.map((item: any, index: number) => ({
      ...item,
      id: `${Date.now()}-${index}`,
      source: item.source || 'Other',
      groundingSources: groundingChunks.map((chunk: any) => ({
        uri: chunk.web?.uri || chunk.maps?.uri,
        title: chunk.web?.title || chunk.maps?.title
      })).filter(s => s.uri)
    }));
  } catch (error: any) {
    console.error("Gemini Search Error:", error);
    // If request fails due to missing key or model, prompt user to select a key again.
    if (error.message?.includes("Requested entity was not found")) {
        if (typeof window !== 'undefined' && (window as any).aistudio?.openSelectKey) {
            (window as any).aistudio.openSelectKey();
        }
        throw new Error("API Key or Model not found. Please select a valid API key from a paid GCP project.");
    }
    throw new Error("Failed to fetch benchmark data. Please check your connection or API key.");
  }
};
