// 세션 토큰 만들기와 확인하기. Next에 기대지 않아서 node --test로 바로 시험한다. 쿠키는 session.js가 다룬다.
// SESSION_SECRET은 32자 이상이어야 한다. 없으면 로그인을 끈다.
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "chameleon-session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export const hasSessionSecret = () => (process.env.SESSION_SECRET ?? "").length >= 32;
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export function signSession(uid) {
  return new SignJWT({ uid })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key());
}

// 서명이 맞고 기간이 남은 토큰이면 { uid }, 아니면 null.
export async function readSession(token) {
  if (!token || !hasSessionSecret()) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return typeof payload.uid === "string" ? { uid: payload.uid } : null;
  } catch {
    return null;
  }
}

export const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge,
});
