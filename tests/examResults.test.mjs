// 작업 L: 시험 랭킹 만들기(lib/server/examResults.js의 순수 함수). DB 없이 가짜 행으로 본다.
import assert from "node:assert/strict";
import { test } from "node:test";
import { averageOf, buildBoard, buildSummary, emptySummary, isMissingTable, rankAmong } from "../lib/server/examResults.js";

const ME = "11111111-1111-4111-8111-111111111111";
const row = (n, total, seconds, extra = {}) => ({
  userId: `u${n}`,
  examId: "marketing",
  total,
  seconds,
  scores: [100, 100, 100, 100, 100, 100],
  nickname: `예시 사용자 ${n}`,
  ranked: true,
  demo: true,
  ...extra,
});

test("랭킹: 점수 높은 순, 같으면 빨리 끝낸 사람이 위, 상위 10명만", () => {
  const rows = [
    ...Array.from({ length: 12 }, (_, i) => row(i + 1, 560 - i * 10, 240)),
    row("me", 480, 261, { userId: ME, nickname: "프롬프트 연습생", demo: false, scores: [100, 83, 50, 67, 100, 80] }),
    row("tie", 480, 250),
  ];
  const board = buildBoard(rows, ME);
  assert.equal(board.takers, 14);
  assert.equal(board.avg, averageOf(rows));
  assert.equal(board.top.length, 10);
  assert.deepEqual(board.top[0], { rank: 1, nickname: "예시 사용자 1", demo: true, me: false, total: 560, seconds: 240 });
  // 480점이 셋: 240초(9번), 250초(tie), 261초(나) → 9위, 10위, 11위
  assert.equal(board.top[9].total, 480);
  assert.equal(board.top[9].seconds, 250);
  assert.ok(!board.top.some((r) => r.me), "나는 10위 밖");
  assert.deepEqual(board.me, {
    rank: 11,
    total: 480,
    seconds: 261,
    scores: [100, 83, 50, 67, 100, 80],
    nickname: "프롬프트 연습생",
  });
});

test("랭킹: 참가하지 않은 사람은 닉네임 없이, 내 줄은 me: true, 가입 이름과 아이디는 내보내지 않는다", () => {
  const rows = [
    row(1, 500, 200, { ranked: false }),
    row(2, 400, 200, { nickname: null }),
    row("me", 450, 230, { userId: ME, nickname: "나야", ranked: true, demo: false, name: "홍길동", loginId: "hong" }),
  ];
  const board = buildBoard(rows, ME);
  assert.deepEqual(
    board.top.map((r) => [r.rank, r.nickname, r.me]),
    [
      [1, null, false],
      [2, "나야", true],
      [3, null, false],
    ],
  );
  const sent = JSON.stringify(board);
  assert.ok(!sent.includes("홍길동") && !sent.includes("hong"));
  assert.equal(buildBoard(rows, null).me, null, "손님은 me 없음");
  assert.equal(
    buildBoard([row(1, 500, 200, { userId: ME, ranked: false })], ME).me.nickname,
    null,
    "참가 전이면 내 닉네임도 null",
  );
  assert.ok(buildBoard(rows, null).top.every((r) => !r.me));
});

test("랭킹: 아무도 안 봤으면 0명, 평균 0", () => {
  assert.deepEqual(buildBoard([], ME), { takers: 0, avg: 0, top: [], me: null });
});

test("시험 목록: 다섯 직무 모두, 시험마다 따로 세고 내 점수·순위", () => {
  const rows = [row(1, 560, 240), row(2, 400, 200), row("me", 480, 261, { userId: ME }), row(3, 300, 100, { examId: "sales" })];
  const summary = buildSummary(rows, ME);
  assert.deepEqual(
    summary.map((e) => e.job),
    ["office", "marketing", "cs", "sales", "dev"],
  );
  const marketing = summary.find((e) => e.job === "marketing");
  assert.deepEqual(marketing, { job: "marketing", takers: 3, avg: 480, mine: { total: 480, rank: 2, seconds: 261 } });
  assert.deepEqual(
    summary.find((e) => e.job === "sales"),
    { job: "sales", takers: 1, avg: 300, mine: null },
  );
  assert.deepEqual(
    summary.find((e) => e.job === "office"),
    { job: "office", takers: 0, avg: 0, mine: null },
  );
  assert.ok(emptySummary().every((e) => e.takers === 0 && e.avg === 0 && e.mine === null));
});

test("연습 점수의 자리: 내 처음 점수는 빼고 다른 사람들 사이에서 센다", () => {
  const rows = [row(1, 560, 240), row(2, 500, 200), row("me", 480, 261, { userId: ME })];
  assert.equal(rankAmong(rows, ME, 520, 250), 2);
  assert.equal(rankAmong(rows, ME, 500, 200), 2, "점수와 시간이 같으면 같은 순위");
  assert.equal(rankAmong(rows, ME, 100, 300), 3);
});

test("표가 아직 없을 때만 notReady로 넘긴다(pg 42P01)", () => {
  assert.equal(isMissingTable({ code: "42P01" }), true);
  assert.equal(isMissingTable({ code: "23505" }), false);
  assert.equal(isMissingTable(null), false);
});
