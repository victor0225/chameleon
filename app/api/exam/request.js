// 시험 API가 같이 쓰는 확인. 순서와 문구는 app/api/ranking/route.js와 같다.
import { JOB } from "@/data/jobs";
import { hasDatabase } from "@/lib/server/db";
import { examFor } from "@/lib/server/exams/index";
import { getSessionUser, hasSessionSecret } from "@/lib/server/session";

export const examOn = () => hasDatabase() && hasSessionSecret();

// 직무 id가 맞고 문제를 써 둔 시험만. 아니면 null.
export const examOf = (job) => (Object.hasOwn(JOB, job) ? examFor(job) : null);

export const notFound = () => Response.json({ error: "준비 중인 시험." }, { status: 404 });

// POST 요청 확인: 로그인 기능 → JSON 형식 → 로그인 → 크기 → JSON 읽기.
// → { user, body } | { response } response가 있으면 그대로 돌려준다.
export async function readPost(request, maxBody) {
  if (!examOn()) {
    return { response: Response.json({ error: "시험은 로그인 기능이 켜져 있을 때만 응시 가능." }, { status: 503 }) };
  }
  // 다른 사이트의 폼은 JSON 형식으로 보낼 수 없으니, JSON 요청만 받아 몰래 보내는 요청을 막는다.
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return { response: Response.json({ error: "요청 형식이 올바르지 않음." }, { status: 415 }) };
  }
  const user = await getSessionUser();
  if (!user) return { response: Response.json({ error: "로그인 필요." }, { status: 401 }) };
  const text = await request.text();
  if (text.length > maxBody) return { response: Response.json({ error: "요청이 너무 큼." }, { status: 413 }) };
  try {
    return { user, body: text ? JSON.parse(text) : {} };
  } catch {
    return { response: Response.json({ error: "요청 형식이 올바르지 않음." }, { status: 400 }) };
  }
}
