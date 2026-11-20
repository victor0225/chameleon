// POST /api/auth/logout : 이 세션을 DB에서 지우고 쿠키도 지운다. 남은 쿠키로는 다시 들어올 수 없다.
import { endSession } from "@/lib/server/session";

export async function POST() {
  await endSession();
  return Response.json({ ok: true });
}
