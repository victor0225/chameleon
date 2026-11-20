// 로그인 세션: sessions 표에 한 줄을 만들고, 그 id를 jose로 서명해 httpOnly 쿠키에 담는다.
// 로그아웃하면 그 줄을 지우므로, 쿠키가 남아 있거나 복사됐어도 더는 로그인된 것으로 보지 않는다.
import { cookies } from "next/headers";
import { hasDatabase } from "./db.js";
import { cookieOptions, hasSessionSecret, readSession, SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "./sessionToken.js";
import { createSession, deleteSession, userForSession } from "./users.js";

export { cookieOptions, hasSessionSecret } from "./sessionToken.js";

export async function startSession(userId) {
  const sid = await createSession(userId, SESSION_MAX_AGE);
  (await cookies()).set(SESSION_COOKIE, await signSession(sid), cookieOptions(SESSION_MAX_AGE));
}

async function currentSid() {
  return (await readSession((await cookies()).get(SESSION_COOKIE)?.value))?.sid ?? null;
}

// 로그인한 사용자 { id, loginId, name }. 로그인 전이거나, 로그아웃한 세션이거나, DB가 없으면 null.
export async function getSessionUser() {
  if (!hasDatabase() || !hasSessionSecret()) return null;
  const sid = await currentSid();
  return sid ? userForSession(sid) : null;
}

export async function endSession() {
  const sid = hasDatabase() && hasSessionSecret() ? await currentSid() : null;
  if (sid) await deleteSession(sid);
  (await cookies()).delete(SESSION_COOKIE);
}
