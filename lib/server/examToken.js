// 시험 시작 토큰(작업 L). 시작할 때 서버가 사용자·직무·시작 시각을 서명해 주고, 낼 때 그 토큰으로 걸린 시간을 센다.
// 화면이 보내는 시간은 믿지 않는다. 시작 기록을 DB에 두지 않아도 되도록 SESSION_SECRET으로 서명만 한다.
// 세션 쿠키 토큰과 섞이지 않게 audience를 따로 둔다. Next에 기대지 않아서 node --test로 바로 시험한다.
import { jwtVerify, SignJWT } from "jose";
import { EXAM_SECONDS } from "../../data/exams.js";
import { hasSessionSecret } from "./sessionToken.js";

// 시작하고 한 시간이 지난 토큰은 받지 않는다. 시간 안에 못 냈어도 "결과 보기"를 늦게 누를 수 있어서 5분보다 넉넉히 둔다.
export const EXAM_TOKEN_MAX_AGE = 60 * 60;
const AUDIENCE = "chameleon-exam";
const MAX_TOKEN = 2000;
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export function signExamToken({ uid, job, startedAt = Date.now() }) {
  const iat = Math.floor(startedAt / 1000);
  return new SignJWT({ uid, job, startedAt })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(iat + EXAM_TOKEN_MAX_AGE)
    .sign(key());
}

// → { startedAt } | { error: "invalid" | "expired" | "mismatch" }
//   mismatch: 다른 사용자나 다른 직무 시험의 토큰. now는 테스트에서만 넘긴다.
export async function readExamToken(token, { uid, job, now = Date.now() }) {
  if (typeof token !== "string" || !token || token.length > MAX_TOKEN || !hasSessionSecret()) return { error: "invalid" };
  let payload;
  try {
    ({ payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      audience: AUDIENCE,
      currentDate: new Date(now),
    }));
  } catch (error) {
    return { error: error?.code === "ERR_JWT_EXPIRED" ? "expired" : "invalid" };
  }
  if (payload.uid !== uid || payload.job !== job) return { error: "mismatch" };
  const { startedAt } = payload;
  // 시계가 조금 어긋나도 받도록 미래 쪽은 1분까지 봐준다.
  if (!Number.isFinite(startedAt) || startedAt > now + 60_000) return { error: "invalid" };
  if (now - startedAt > EXAM_TOKEN_MAX_AGE * 1000) return { error: "expired" };
  return { startedAt };
}

// 걸린 시간(초). 서버가 잰 시간에는 시작 응답과 제출 요청이 오간 시간이 더해져 있어서, 5분을 다 쓰면 몇 초 넘게 나온다.
// 그래서 5분(EXAM_SECONDS)에서 자른다. 시간이 끝난 뒤 "결과 보기"를 늦게 눌러도 5:00으로 남는다.
export function elapsedSeconds(startedAt, now = Date.now()) {
  return Math.min(EXAM_SECONDS, Math.max(0, Math.round((now - startedAt) / 1000)));
}
