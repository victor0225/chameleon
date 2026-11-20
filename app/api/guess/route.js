// POST /api/guess: 프롬프트를 AI가 실제로 실행한 결과물과, 그 안에서 AI가 마음대로 정한 부분
// 요청 { job, prompt } → 응답 { output, guesses: [{ item, quote, reason }], source }
// 판단 로직은 lib/server/guess.js. GEMINI_API_KEY가 없거나 호출이 실패하면 규칙 기반으로 답한다(source: "rule", output: null).
import { generateJson, hasGeminiKey } from "@/lib/server/gemini";
import { runGuess, validateGuess } from "@/lib/server/guess";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }
  const error = validateGuess(body);
  if (error) return Response.json({ error }, { status: 400 });

  const result = await runGuess(body, { ask: hasGeminiKey() ? generateJson : null });
  return Response.json(result);
}
