// 서버(app/api/*/route.js)에서만 쓰는 Gemini 호출 도우미.
// 키는 GEMINI_API_KEY 환경변수로만 읽는다. 브라우저 코드에서 이 파일을 불러오면 안 된다.
import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

// JSON 하나를 돌려받는 호출. Google 쪽이 혼잡(503)하면 1.5초 뒤 한 번만 다시 시도한다.
export async function generateJson({ system, contents, temperature = 0.2 }) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: { systemInstruction: system, responseMimeType: "application/json", temperature },
      });
      const text = response?.text?.trim();
      if (!text) throw new Error("EMPTY_RESPONSE");
      return JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    } catch (error) {
      const status = Number(error?.status || error?.code);
      if (status !== 503 || attempt >= 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
}
