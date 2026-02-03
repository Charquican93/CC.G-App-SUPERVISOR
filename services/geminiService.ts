import { GoogleGenerativeAI } from "@google/generative-ai";

const ai = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_API_KEY || "");

export const summarizeSecurityLogs = async (logs: string[]) => {
  if (!process.env.EXPO_PUBLIC_API_KEY)
    return "Servicio AI no disponible (falta API Key)";

  try {
    const model = ai.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(`Analiza los siguientes registros de seguridad y proporciona un resumen ejecutivo rápido:\n\n${logs.join(
      "\n"
    )}`);

    return result.response.text();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error al procesar el resumen de bitácora.";
  }
};
