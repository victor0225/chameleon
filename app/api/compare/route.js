// POST /api/compare: 결과 비교 화면의 세 단계를 하나씩 처리한다.
// 요청 { step: "mine" | "refine" | "run", job, prompt, missing?, improved?(run), before?(run) }
// 응답 mine   → { output, guesses: [{ item, quote, reason }], source: "ai" }
//      refine → { sentences: [{ item, text, why, added }], source: "ai" }  (다섯 요소 순서로 다섯 문장)
//      run    → { output, marks: [{ item, quote }], diffs: [{ item, before, after }], source: "ai" }
// GEMINI_API_KEY가 없으면 { source: "rule" }. 화면은 이때 예시 결과를 보여 준다.
// Gemini 호출이 실패하면 502와 몇 번째 단계에서 실패했는지 알 수 있는 문장을 돌려준다.
import { generateJson, hasGeminiKey } from "@/lib/server/gemini";
import { runCompare, STEP_ERROR, validateCompare } from "@/lib/server/compare";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }
  const error = validateCompare(body);
  if (error) return Response.json({ error }, { status: 400 });

  try {
    return Response.json(await runCompare(body, { ask: hasGeminiKey() ? generateJson : null }));
  } catch (err) {
    console.warn(`[/api/compare] ${body.step} 단계 실패:`, err?.message || "unknown");
    return Response.json({ error: `${STEP_ERROR[body.step]} 잠시 뒤 다시 시도해 주세요.` }, { status: 502 });
  }
}
