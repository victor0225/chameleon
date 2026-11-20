// POST /api/evaluate: AI 활용 교육 실습 평가
// 요청 { lessonId, prompt?, answer?, files?, sample? } → 응답 { passed, criteria, found, coaching, output, xp, source, ... }
//   prompt·file 강의는 prompt(file은 files도), sort·spot 강의는 answer를 보낸다. 나눠 채점하는 곳은 lib/server/evaluate.js.
// 로그인한 사용자면 attempts 표에 한 줄 남긴다. 강의 점수(points)도 함께 남겨 랭킹이 첫 시도 점수를 센다.
// 판단 로직은 lib/server/evaluate.js. GEMINI_API_KEY가 없거나 호출이 실패하면 규칙 기반으로 답한다(source: "rule").
import { generateJson, hasGeminiKey } from "@/lib/server/gemini";
import { runEvaluation, validateEvaluation } from "@/lib/server/evaluate";
import { FileExpiredError } from "@/lib/server/files";
import { ITEMS } from "@/lib/items";
import { getSessionUser } from "@/lib/server/session";
import { recordAttempt } from "@/lib/server/users";

const ELEMENT_IDS = new Set(ITEMS.map((item) => item.id));

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않음." }, { status: 400 });
  }
  const error = validateEvaluation(body);
  if (error) return Response.json({ error }, { status: 400 });

  let result;
  try {
    result = await runEvaluation(body, { ask: hasGeminiKey() ? generateJson : null });
  } catch (error) {
    if (error instanceof FileExpiredError) return Response.json({ error: error.message, expired: true }, { status: 410 });
    throw error;
  }
  // 로그인했으면 실습 기록을 남긴다. 개인화 엔진이 못 넘은 기준을 요소별로 센다. 저장이 실패해도 채점 결과는 돌려준다.
  try {
    const user = await getSessionUser();
    if (user) {
      await recordAttempt(user.id, {
        lessonId: body.lessonId,
        passed: result.passed,
        found: result.found ?? [],
        // 다섯 요소가 아닌 기준(item: null)은 개인화 엔진의 요소 숙련도에 섞지 않는다.
        missed: [...new Set(result.criteria.filter((c) => !c.met && ELEMENT_IDS.has(c.item)).map((c) => c.item))],
        score: result.points,
      });
    }
  } catch (error) {
    console.warn("[/api/evaluate] 실습 기록 저장 실패:", error?.message || "unknown");
  }
  return Response.json(result);
}
