import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateQuestionsByTopic = async (topic: string, count: number = 5): Promise<Question[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Hãy tạo ${count} câu hỏi trắc nghiệm về chủ đề: "${topic}". Ngôn ngữ: Tiếng Việt.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: "Nội dung câu hỏi",
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Danh sách 4 lựa chọn trả lời",
              },
              correctAnswerIndex: {
                type: Type.INTEGER,
                description: "Chỉ số của câu trả lời đúng (0-3)",
              },
            },
            required: ["text", "options", "correctAnswerIndex"],
          },
        },
      },
    });

    const rawQuestions = JSON.parse(response.text || "[]");
    
    // Transform to add IDs
    return rawQuestions.map((q: any) => ({
      id: crypto.randomUUID(),
      text: q.text,
      options: q.options,
      correctAnswerIndex: q.correctAnswerIndex,
    }));

  } catch (error) {
    console.error("Lỗi khi tạo câu hỏi bằng Gemini:", error);
    throw new Error("Không thể tạo câu hỏi. Vui lòng thử lại.");
  }
};
