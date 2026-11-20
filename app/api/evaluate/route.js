// POST /api/evaluate: AI 활용 교육 실습 평가
// 요청 { lessonId, prompt } → 응답 { passed, criteria, found, coaching, output, xp, source }
// 로그인한 사용자면 attempts 표에 한 줄 남긴다.
// 판단 로직은 lib/server/evaluate.js. GEMINI_API_KEY가 없거나 호출이 실패하면 규칙 기반으로 답한다(source: "rule").
import { generateJson, hasGeminiKey } from "@/lib/server/gemini";
import { hasDatabase } from "@/lib/server/db";
import { runEvaluation, validateEvaluation } from "@/lib/server/evaluate";
import { getSession, hasSessionSecret } from "@/lib/server/session";
import { recordAttempt } from "@/lib/server/users";

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
  // 로그인했으면 실습 기록을 남긴다. 개인화 엔진이 못 넘은 기준을 요소별로 센다. 저장이 실패해도 채점 결과는 돌려준다.
  if (hasDatabase() && hasSessionSecret()) {
    try {
      const session = await getSession();
      if (session) {
        await recordAttempt(session.uid, {
          lessonId: body.lessonId,
          passed: result.passed,
          found: result.found ?? [],
          missed: [...new Set(result.criteria.filter((c) => !c.met).map((c) => c.item))],
        });
      }
    } catch (error) {
      console.warn("[/api/evaluate] 실습 기록 저장 실패:", error?.message || "unknown");
    }
  }
  return Response.json(result);
}
