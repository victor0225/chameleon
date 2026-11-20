// POST /api/auth/logout : 세션 쿠키를 지운다.
import { endSession } from "@/lib/server/session";

export async function POST() {
  await endSession();
  return Response.json({ ok: true });
}
