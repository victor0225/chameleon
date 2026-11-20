// GET  /api/tour : 내가 본 화면 안내 → { seen: { home: "done", result: "skipped", ... } }. 로그인해야 한다.
// POST /api/tour { tourId, status, step, merge? } : 본 기록을 넣거나 고친다. tourId는 data/tours.js에 있는 것만 받는다.
// DB(또는 tour_views 표)가 없으면 { seen: {}, off: true } / { off: true }로 답하고, 화면은 브라우저에만 남긴다.
// 판단은 lib/tour.js, DB는 lib/server/tour.js.
import { connection } from "next/server";
import { cleanTourView } from "@/lib/tour";
import { hasDatabase } from "@/lib/server/db";
import { getSessionUser, hasSessionSecret } from "@/lib/server/session";
import { isMissingTable, loadTourViews, saveTourView } from "@/lib/server/tour";

const MAX_BODY = 1000;
const isOn = () => hasDatabase() && hasSessionSecret();

export async function GET() {
  await connection();
  if (!isOn()) return Response.json({ seen: {}, off: true });
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인 필요." }, { status: 401 });
  try {
    return Response.json({ seen: await loadTourViews(user.id) });
  } catch (error) {
    if (isMissingTable(error)) return Response.json({ seen: {}, off: true });
    console.warn("[/api/tour] 읽기 실패:", error?.message || "unknown");
    return Response.json({ error: "화면 안내 기록을 읽지 못함." }, { status: 500 });
  }
}

export async function POST(request) {
  if (!isOn()) return Response.json({ off: true });
  // 다른 사이트의 폼은 JSON 형식으로 보낼 수 없으니, JSON 요청만 받는다(랭킹·가입과 같다).
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "요청 형식이 올바르지 않음." }, { status: 415 });
  }
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인 필요." }, { status: 401 });
  const text = await request.text();
  if (text.length > MAX_BODY) return Response.json({ error: "요청이 너무 큼." }, { status: 413 });
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않음." }, { status: 400 });
  }
  const { value, error } = cleanTourView(body);
  if (error) return Response.json({ error }, { status: 400 });
  try {
    await saveTourView(user.id, value);
    return Response.json({ ok: true });
  } catch (e) {
    if (isMissingTable(e)) return Response.json({ off: true });
    console.warn("[/api/tour] 저장 실패:", e?.message || "unknown");
    return Response.json({ error: "화면 안내 기록을 저장하지 못함." }, { status: 500 });
  }
}
