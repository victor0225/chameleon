// 실제 PostgreSQL에 쓰고 읽어 본다. DATABASE_URL이 없으면 건너뛴다.
// 사용: npm run db:up && npm run db:migrate && npm run test:db
import assert from "node:assert/strict";
import { after, test } from "node:test";

const skip = !process.env.DATABASE_URL && "DATABASE_URL이 없어 DB 테스트를 건너뜀";
const ID = `test${process.pid}`;

const load = async () => ({
  db: await import("../lib/server/db.js"),
  users: await import("../lib/server/users.js"),
  state: await import("../lib/server/state.js"),
});

after(async () => {
  if (skip) return;
  const { db } = await load();
  await db.query("DELETE FROM users WHERE login_id = $1", [ID]);
  await db.getPool().end();
});

test("가입·로그인: 같은 아이디는 한 번만, 맞는 비밀번호만 통과, 다섯 번 틀리면 잠근다", { skip }, async () => {
  const { db, users } = await load();
  const user = await users.createUser({ loginId: ID, password: "12345678", name: " 테스트 " });
  assert.equal(user.loginId, ID);
  assert.equal(user.name, "테스트");
  assert.equal(await users.createUser({ loginId: ID, password: "abcdefgh", name: "다른 사람" }), null);
  const { rows } = await db.query("SELECT password_hash FROM users WHERE id = $1", [user.id]);
  assert.ok(!rows[0].password_hash.includes("12345678"), "비밀번호 원문은 저장하지 않는다");

  assert.equal((await users.authenticate(ID, "12345678")).user.id, user.id);
  assert.equal((await users.authenticate(` ${ID.toUpperCase()} `, "12345678")).user.id, user.id, "아이디 대소문자·공백은 무시");
  assert.deepEqual(await users.authenticate(ID, "wrong-pass"), { error: "wrong" });
  assert.deepEqual(await users.authenticate("nobody-here", "12345678"), { error: "wrong" });

  // 맞게 로그인하면 틀린 횟수를 다시 센다.
  await users.authenticate(ID, "12345678");
  for (let i = 0; i < users.MAX_FAILS - 1; i += 1) await users.authenticate(ID, "wrong-pass");
  assert.ok((await users.authenticate(ID, "12345678")).user, "네 번까지는 막지 않는다");
  for (let i = 0; i < users.MAX_FAILS; i += 1) await users.authenticate(ID, "wrong-pass");
  assert.deepEqual(await users.authenticate(ID, "12345678"), { error: "locked" }, "잠긴 동안은 맞는 비밀번호도 막는다");
  await db.query("UPDATE users SET locked_until = now() - interval '1 second' WHERE id = $1", [user.id]);
  assert.ok((await users.authenticate(ID, "12345678")).user, "잠금이 풀리면 다시 들어간다");

  // 틀린 비밀번호가 한꺼번에 몰려와도 잠금 전에 확인하는 건 다섯 번까지다.
  const burst = await Promise.all(Array.from({ length: 20 }, () => users.authenticate(ID, "wrong-pass")));
  assert.equal(burst.filter((r) => r.error === "wrong").length, users.MAX_FAILS);
  assert.equal(burst.filter((r) => r.error === "locked").length, 20 - users.MAX_FAILS);
  await db.query("UPDATE users SET locked_until = now() - interval '1 second' WHERE id = $1", [user.id]);
  assert.ok((await users.authenticate(ID, "12345678")).user);

  // 세션: 지우면(로그아웃) 같은 id로는 더 못 들어오고, 기간이 끝난 세션도 받지 않는다.
  const sid = await users.createSession(user.id, 60);
  assert.equal((await users.userForSession(sid)).id, user.id);
  await users.deleteSession(sid);
  assert.equal(await users.userForSession(sid), null);
  const old = await users.createSession(user.id, 60);
  await db.query("UPDATE sessions SET expires_at = now() - interval '1 second' WHERE id = $1", [old]);
  assert.equal(await users.userForSession(old), null);
  assert.equal(await users.userForSession("not-a-uuid"), null);

  assert.equal((await users.getUser(user.id)).name, "테스트");
  assert.equal(await users.getUser("not-a-uuid"), null);
});

test("상태: 저장한 그대로 읽고, 같은 진단(at)은 덮어쓰고, 지우면 비운다", { skip }, async () => {
  const { users, state } = await load();
  const { user } = await users.authenticate(ID, "12345678");
  const diag = {
    at: "2026-11-20T10:00:00.000Z",
    job: "marketing",
    experience: "none",
    level: "초급",
    prompt: "신제품 SNS 글 써 줘",
    found: ["goal"],
    missing: ["context"],
    segments: [{ text: "신제품 SNS 글 써 줘", items: ["goal"] }],
  };
  const body = {
    profile: { job: "marketing", experience: "none", level: "초급" },
    survey: { job: "marketing", experience: "none" },
    diagnosis: diag,
    record: { xp: 30, completed: ["b1"], tries: { b1: 1 }, mastery: { goal: 20 }, history: [], levelUpSeen: [] },
  };
  await users.saveState(user.id, state.cleanState(body).value);
  // 나중에 추측 결과가 붙어 같은 진단을 다시 저장한다.
  await users.saveState(user.id, state.cleanState({ ...body, diagnosis: { ...diag, guess: { output: "결과" } } }).value);
  const loaded = await users.loadState(user.id);
  assert.deepEqual(loaded.profile, body.profile);
  assert.equal(loaded.diagnosis.at, diag.at);
  assert.equal(loaded.diagnosis.guess.output, "결과");
  assert.deepEqual(loaded.diagnosis.segments, diag.segments);
  assert.deepEqual(loaded.record.completed, ["b1"]);
  assert.equal(loaded.record.mastery.goal, 20);

  await users.recordAttempt(user.id, { lessonId: "b2", passed: false, found: ["goal"], missed: ["context"] });
  const attempts = await users.recentAttempts(user.id);
  assert.equal(attempts[0].lessonId, "b2");
  assert.deepEqual(attempts[0].missed, ["context"]);
  assert.deepEqual(await users.userStats(user.id), { diagnoses: 1, attempts: 1 });

  await users.clearData(user.id);
  const cleared = await users.loadState(user.id);
  assert.deepEqual(cleared, { profile: null, survey: null, diagnosis: null, record: null });
  assert.ok(await users.getUser(user.id), "계정은 남는다");
});
