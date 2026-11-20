// POST /api/diagnose: 숙련도 진단
// 요청 { job, experience, prompt } → 응답 { level, found, missing, comment, segments, source }
// 판단 로직은 lib/server/diagnosis.js. GEMINI_API_KEY가 없거나 호출이 실패하면 규칙 기반으로 답한다(source: "rule").
import { generateJson, hasGeminiKey } from "@/lib/server/gemini";
import { runDiagnosis, validateDiagnosis } from "@/lib/server/diagnosis";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }
  const error = validateDiagnosis(body);
  if (error) return Response.json({ error }, { status: 400 });

  const result = await runDiagnosis(body, { ask: hasGeminiKey() ? generateJson : null });
  return Response.json(result);
}
