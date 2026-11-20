// 작업 L: 시험 시작 토큰(lib/server/examToken.js). 걸린 시간은 서버가 서명한 시작 시각으로만 센다.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { elapsedSeconds, EXAM_TOKEN_MAX_AGE, readExamToken, signExamToken } from "../lib/server/examToken.js";
import { signSession } from "../lib/server/sessionToken.js";

process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret-0123";
const UID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

test("시작 토큰: 같은 사용자·같은 시험이면 시작 시각을 돌려준다", async () => {
  const startedAt = Date.now();
  const token = await signExamToken({ uid: UID, job: "marketing", startedAt });
  assert.deepEqual(await readExamToken(token, { uid: UID, job: "marketing", now: startedAt + 261_000 }), { startedAt });
});

test("시작 토큰: 다른 사용자, 다른 시험, 위조, 빈 값, 세션 토큰은 받지 않는다", async () => {
  const startedAt = Date.now();
  const token = await signExamToken({ uid: UID, job: "marketing", startedAt });
  assert.deepEqual(await readExamToken(token, { uid: OTHER, job: "marketing", now: startedAt }), { error: "mismatch" });
  assert.deepEqual(await readExamToken(token, { uid: UID, job: "sales", now: startedAt }), { error: "mismatch" });
  const forged = await new SignJWT({ uid: UID, job: "marketing", startedAt: startedAt - 200_000 })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("chameleon-exam")
    .sign(new TextEncoder().encode("another-secret-another-secret-012345"));
  assert.deepEqual(await readExamToken(forged, { uid: UID, job: "marketing" }), { error: "invalid" });
  for (const bad of [undefined, "", 42, "x".repeat(3000), token.slice(0, -2)]) {
    assert.deepEqual(await readExamToken(bad, { uid: UID, job: "marketing" }), { error: "invalid" });
  }
  assert.deepEqual(await readExamToken(await signSession("sid-1"), { uid: UID, job: "marketing" }), { error: "invalid" });
});

test("시작 토큰: 한 시간이 지나면 expired", async () => {
  const startedAt = Date.now() - (EXAM_TOKEN_MAX_AGE + 5) * 1000;
  const token = await signExamToken({ uid: UID, job: "marketing", startedAt });
  assert.deepEqual(await readExamToken(token, { uid: UID, job: "marketing" }), { error: "expired" });
});

test("걸린 시간: 초 단위로 반올림하고 0초~5분 안으로 자른다", () => {
  const t = 1_000_000;
  assert.equal(elapsedSeconds(t, t + 261_400), 261);
  assert.equal(elapsedSeconds(t, t + 309_000), 300, "오가는 시간이 더해져 5분을 넘어도 5:00");
  assert.equal(elapsedSeconds(t, t + 40 * 60_000), 300);
  assert.equal(elapsedSeconds(t, t - 3000), 0);
});
