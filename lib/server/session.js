// 로그인 세션: 사용자 id를 jose로 서명해 httpOnly 쿠키에 담는다(Next.js 인증 가이드의 stateless 세션 방식).
import { cookies } from "next/headers";
import { cookieOptions, readSession, SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "./sessionToken.js";

export { cookieOptions, hasSessionSecret } from "./sessionToken.js";

export async function startSession(uid) {
  (await cookies()).set(SESSION_COOKIE, await signSession(uid), cookieOptions(SESSION_MAX_AGE));
}

export async function getSession() {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
