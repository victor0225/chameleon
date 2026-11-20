// POST /api/evaluate: AI 활용 교육 실습 평가
// 요청 { lessonId, prompt } → 응답 { passed, criteria, found, coaching, output, xp, source }
// 판단 로직은 lib/server/evaluate.js. GEMINI_API_KEY가 없거나 호출이 실패하면 규칙 기반으로 답한다(source: "rule").
import { generateJson, hasGeminiKey } from "@/lib/server/gemini";
import { runEvaluation, validateEvaluation } from "@/lib/server/evaluate";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }
  const error = validateEvaluation(body);
  if (error) return Response.json({ error }, { status: 400 });

  const result = await runEvaluation(body, { ask: hasGeminiKey() ? generateJson : null });
  return Response.json(result);
}
