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

test("랭킹: 강의마다 점수가 있는 첫 기록만 세고, 참여한 사람만 별명으로 보여 준다", { skip }, async () => {
  const { db, users } = await load();
  const ranking = await import("../lib/server/ranking.js");
  const a = await users.createUser({ loginId: `${ID}a`, password: "12345678", name: "가입이름A" });
  const b = await users.createUser({ loginId: `${ID}b`, password: "12345678", name: "가입이름B" });
  try {
    // 점수 칸이 빈 예전 기록은 빼고, 점수가 있는 첫 기록(40)을 쓴다. 다시 푼 100점은 세지 않는다.
    await users.recordAttempt(a.id, { lessonId: "b1", passed: false, found: [], missed: [] });
    await users.recordAttempt(a.id, { lessonId: "b1", passed: false, found: [], missed: [], score: 40 });
    await users.recordAttempt(a.id, { lessonId: "b1", passed: true, found: [], missed: [], score: 100 });
    await users.recordAttempt(a.id, { lessonId: "mem1", passed: true, found: [], missed: [], score: 88 });
    await users.recordAttempt(b.id, { lessonId: "ver1", passed: true, found: [], missed: [], score: 75 });
    await db.query("INSERT INTO profiles (user_id, job) VALUES ($1, 'office')", [a.id]);

    // 참여 전에도 내 점수는 보이고, 순위는 없다.
    let r = await ranking.loadRanking(a.id, null);
    assert.equal(r.me.total, 128);
    assert.equal(r.me.max, 600);
    assert.equal(r.me.rank, null);

    const nickA = `T${process.pid}`.slice(0, 12);
    const nickB = `U${process.pid}`.slice(0, 12);
    assert.deepEqual(await ranking.setRanking(a.id, { ranked: true, nickname: ` ${nickA} ` }), { ok: true });
    assert.equal((await ranking.setRanking(b.id, { ranked: true, nickname: nickA })).error, "이미 쓰는 별명이에요.");
    assert.match((await ranking.setRanking(b.id, { ranked: true, nickname: "<b>" })).error, /2~12자|한글/);
    await ranking.setRanking(b.id, { ranked: true, nickname: nickB });

    r = await ranking.loadRanking(a.id, null);
    const rowA = r.top.find((t) => t.nickname === nickA);
    const rowB = r.top.find((t) => t.nickname === nickB);
    assert.equal(rowA.total, 128);
    assert.equal(rowA.me, true);
    assert.equal(rowB.total, 75);
    assert.ok(rowA.rank < rowB.rank);
    assert.equal(r.me.rank, rowA.rank);
    assert.ok(!/가입이름|test\d/.test(JSON.stringify(r)), "가입 이름과 아이디는 랭킹에 나오지 않는다");

    // 직무를 주면 그 직무만 센다(B는 직무가 없다).
    const office = await ranking.loadRanking(null, "office");
    assert.equal(office.me, null);
    assert.ok(office.top.some((t) => t.nickname === nickA));
    assert.ok(!office.top.some((t) => t.nickname === nickB));

    // 기록을 지우고 다시 풀어도 첫 점수는 그대로다.
    await users.clearData(a.id);
    await users.recordAttempt(a.id, { lessonId: "mem1", passed: true, found: [], missed: [], score: 100 });
    assert.equal((await ranking.loadRanking(a.id, null)).me.total, 128);

    // 빠지면 표에서 사라지고 내 순위도 없다.
    await ranking.setRanking(a.id, { ranked: false });
    r = await ranking.loadRanking(a.id, null);
    assert.equal(r.me.ranked, false);
    assert.equal(r.me.rank, null);
    assert.ok(!r.top.some((t) => t.nickname === nickA));
  } finally {
    await db.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[a.id, b.id]]);
  }
});

test("개인화 읽기: 최근 진단 다섯 개와 첫 진단, 내 부문 점수, 같은 직무 평균(5명부터)", { skip }, async () => {
  const { db, users } = await load();
  const ranking = await import("../lib/server/ranking.js");
  const { recentDiagnoses } = await import("../lib/server/history.js");
  const people = [];
  try {
    for (let i = 0; i < 5; i++) {
      const u = await users.createUser({ loginId: `${ID}p${i}`, password: "12345678", name: "개인화" });
      people.push(u.id);
      await db.query("INSERT INTO profiles (user_id, job) VALUES ($1, 'dev')", [u.id]);
      await users.recordAttempt(u.id, { lessonId: "file2", passed: true, found: [], missed: [], score: 100 });
    }
    const me = people[0];
    for (let day = 1; day <= 7; day++) {
      await db.query(
        "INSERT INTO diagnoses (user_id, at, job, level, prompt, found, missing) VALUES ($1, $2, 'dev', '초급', '진단', $3, '{}')",
        [me, `2026-11-0${day}T09:00:00Z`, ["goal", "context", "format"].slice(0, Math.min(day, 3))],
      );
    }
    const list = await recentDiagnoses(me, 5);
    assert.deepEqual(
      list.map((d) => d.at.slice(0, 10)),
      ["2026-11-07", "2026-11-06", "2026-11-05", "2026-11-04", "2026-11-03", "2026-11-01"],
      "최근 다섯 개 뒤에 첫 진단",
    );
    assert.deepEqual(list.at(-1).found, ["goal"]);

    const mine = await ranking.myAreas(me);
    assert.equal(mine.areas.find((a) => a.course === "file").score, 100);
    const averages = await ranking.jobAverages("dev");
    assert.ok(averages.file.n >= 5);
    assert.ok(Object.values(averages).every((a) => a.n >= 5), "5명보다 적은 부문은 평균이 없다");
    assert.deepEqual(await ranking.jobAverages(null), {});
  } finally {
    await db.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [people]);
  }
});

test("화면 안내 기록: 넣고 고치고, 합칠 때는 있는 줄을 그대로 둔다(tour_views 표가 있을 때만)", { skip }, async () => {
  const { db, users } = await load();
  const { rows } = await db.query("SELECT to_regclass('tour_views') AS t");
  if (!rows[0].t) return; // 표는 팀원이 만든다. 아직 없으면 API가 off로 답한다(브라우저 기록만 씀).
  const tour = await import("../lib/server/tour.js");
  const u = await users.createUser({ loginId: `${ID}t`, password: "12345678", name: "안내" });
  try {
    await tour.saveTourView(u.id, { tourId: "mission", status: "skipped", step: 1, merge: false });
    const first = (await db.query("SELECT first_at FROM tour_views WHERE user_id = $1", [u.id])).rows[0].first_at;
    await tour.saveTourView(u.id, { tourId: "mission", status: "done", step: 2, merge: false });
    await tour.saveTourView(u.id, { tourId: "mission", status: "skipped", step: 0, merge: true });
    await tour.saveTourView(u.id, { tourId: "home", status: "done", step: 0, merge: true });
    assert.deepEqual(await tour.loadTourViews(u.id), { mission: "done", home: "done" });
    const row = (await db.query("SELECT step, first_at FROM tour_views WHERE user_id = $1 AND tour_id = 'mission'", [u.id])).rows[0];
    assert.equal(row.step, 2);
    assert.equal(row.first_at.getTime(), first.getTime(), "다시 봐도 처음 본 시각은 그대로");
    await users.clearData(u.id);
    assert.deepEqual(Object.keys(await tour.loadTourViews(u.id)).sort(), ["home", "mission"], "기록 지우기는 안내 기록을 지우지 않는다");
  } finally {
    await db.query("DELETE FROM users WHERE id = $1", [u.id]);
  }
});
