// 작업 I: 여섯 과정으로 넓힌 추천, 같은 직무와 비교, 진단 변화. 모두 순수 함수다.
import assert from "node:assert/strict";
import { test } from "node:test";
import { courseWeakness } from "../lib/courseWeakness.js";
import { diagnosisTrend } from "../lib/diagnosisTrend.js";
import { personalize } from "../lib/personalize.js";
import { areaScores, averageAreas, jobGaps } from "../lib/scoreboard.js";

const ALL = ["goal", "context", "constraint", "format", "criteria"];
const diag = (day, found) => ({ at: `2026-11-${String(day).padStart(2, "0")}T09:00:00Z`, found, missing: ALL.filter((id) => !found.includes(id)) });
const area = (course, score, done = 1) => ({ course, score, done });

test("진단 변화: 1번이면 비우고, 첫 진단보다 더 채운 요소 수와 최근 세 번 중 두 번 빠진 요소를 센다", () => {
  assert.deepEqual(diagnosisTrend([diag(1, ["goal"])]), { growth: null, from: null, to: null, repeatMissing: [] });
  assert.deepEqual(diagnosisTrend([]), { growth: null, from: null, to: null, repeatMissing: [] });
  // 새것부터 와도 at으로 정렬한다. 1개 → 3개
  const t = diagnosisTrend([diag(9, ["goal", "context", "format"]), diag(5, ["goal", "context"]), diag(3, ["goal", "format"]), diag(1, ["goal"])]);
  assert.equal(t.growth, 2);
  assert.deepEqual([t.from, t.to], [1, 3]);
  // 최근 세 번(3일, 5일, 9일)에서 constraint·criteria는 세 번, context는 한 번, format은 한 번 빠졌다.
  assert.deepEqual(t.repeatMissing, [
    { id: "constraint", times: 3, of: 3 },
    { id: "criteria", times: 3, of: 3 },
  ]);
  assert.equal(diagnosisTrend([diag(1, ["goal", "format"]), diag(2, ["goal"])]).growth, -1);
});

test("직무 평균: 그 부문을 푼 사람만 세고, 5명보다 적은 부문은 빼고, 5점 단위로 반올림하고, 차이는 평균 − 내 점수", () => {
  const odd = {};
  for (let i = 0; i < 5; i++) odd[`u${i}`] = { file1: i === 0 ? 61 : 60 };
  assert.deepEqual(averageAreas(odd), { file: { avg: 60, n: 5 } }, "60.2점은 60점으로");
  const byUser = {};
  for (let i = 0; i < 5; i++) byUser[`u${i}`] = { file1: 60 + i * 10, b1: 100 };
  for (let i = 0; i < 4; i++) byUser[`u${i}`].ver1 = 50;
  byUser.u5 = { mem1: 90 }; // memory 부문은 1명뿐
  const averages = averageAreas(byUser);
  assert.deepEqual(averages, { prompt: { avg: 100, n: 5 }, file: { avg: 80, n: 5 } });
  const mine = areaScores({ file1: 50, b1: 100 }).areas;
  assert.deepEqual(jobGaps(mine, averages), [
    { course: "prompt", mine: 100, done: 1, avg: 100, n: 5, gap: 0 },
    { course: "file", mine: 50, done: 1, avg: 80, n: 5, gap: 30 },
  ]);
});

test("과정 약한 정도: 진단 신호 3, 낮은 부문 점수, 안 해 본 과정 1, 설문 1, 직무 평균 차이(최대 2)", () => {
  const areas = [area("prompt", 80), area("memory", 0, 0), area("file", 50), area("verify", 90), area("tool", 0, 0), area("flow", 0, 0)];
  const w = courseWeakness({
    areas,
    signals: [{ course: "verify", reason: "AI가 지어낸 부분을 걸러낼 기준 없음" }, { course: "prompt", reason: "빠진 요소" }],
    used: ["memory", "search"],
    gaps: [{ course: "file", mine: 50, done: 1, avg: 80, n: 6, gap: 30 }],
    job: "marketing",
  });
  assert.deepEqual(Object.keys(w), ["memory", "file", "verify", "tool", "flow"], "과정 1은 뺀다");
  assert.deepEqual(w.file, {
    score: 50 / 40 + 1.5 + 1,
    reasons: ["파일 부문 50점", "같은 마케팅 직무 평균보다 파일 부문 30점 낮음", "파일을 붙여 맡겨 본 적 없다고 답함"],
  });
  assert.deepEqual(w.verify, { score: 3 + 10 / 40, reasons: ["AI가 지어낸 부분을 걸러낼 기준 없음"] }, "70점 넘으면 점수 이유는 없다");
  assert.deepEqual(w.memory, { score: 1, reasons: ["아직 해 보지 않은 과정"] }, "써 봤다고 했으면 설문 점수 없음");
  assert.deepEqual(w.flow.reasons, ["같은 일을 반복해 AI에게 맡겨 본 적 없다고 답함", "아직 해 보지 않은 과정"]);
  // 직무 평균 차이는 2점까지만, 이유는 10점 넘게 낮을 때만
  const big = courseWeakness({ areas: [area("file", 10)], gaps: [{ course: "file", gap: 80 }], job: "marketing" });
  assert.equal(big.file.score, 90 / 40 + 2);
  const small = courseWeakness({ areas: [area("file", 80)], gaps: [{ course: "file", gap: 8 }], job: "marketing" });
  assert.deepEqual(small.file.reasons, []);
  assert.equal(small.file.score, 20 / 40 + 8 / 20);
});

test("개인화: 과정 2~6은 과정마다 안 끝낸 첫 미션을 후보로 두고, 같은 과정에 몰리지 않는다", () => {
  const record = { completed: ["b1", "b2", "b3", "b4", "b5", "file1"], mastery: { goal: 90, context: 90, constraint: 90, format: 90, criteria: 90 } };
  const areas = areaScores({ b1: 100, b2: 100, b3: 100, b4: 100, b5: 100, file1: 25 }).areas;
  const plan = personalize({
    level: "초급",
    diagnosis: { missing: [] },
    record,
    attempts: [],
    courses: { areas, signals: [{ course: "verify", reason: "AI가 지어낸 부분을 걸러낼 기준 없음" }], used: ["file", "memory", "search", "repeat"] },
  });
  assert.deepEqual(
    plan.items.map((i) => [i.lessonId, i.course]),
    [
      ["ver1", "verify"],
      ["file2", "file"],
      ["mem1", "memory"],
    ],
    "초급을 다 마쳐 다음 단계(m1)는 0.5점이라, 안 해 본 과정 2(1점)가 앞선다",
  );
  assert.deepEqual(plan.items[0], {
    lessonId: "ver1",
    title: plan.items[0].title,
    course: "verify",
    level: null,
    focus: null,
    reasons: ["AI가 지어낸 부분을 걸러낼 기준 없음", "아직 해 보지 않은 과정"],
  });
  assert.deepEqual(plan.items[1].reasons, ["파일 부문 25점"]);
  // courses를 넘기지 않으면 지금처럼 과정 1만 고른다.
  assert.ok(personalize({ level: "초급", diagnosis: null, record, attempts: [] }).items.every((i) => i.course === "prompt"));
});

test("개인화: 최근 진단 세 번 중 두 번 빠진 요소는 더 약하게 보고 이유를 붙인다", () => {
  const trend = diagnosisTrend([diag(1, ["goal", "criteria"]), diag(2, ["goal"]), diag(3, ["goal"])]);
  const base = { level: "초급", diagnosis: { missing: [] }, record: { completed: [], mastery: Object.fromEntries(ALL.map((id) => [id, 80])) }, attempts: [] };
  const plain = personalize(base);
  const withTrend = personalize({ ...base, trend });
  assert.notEqual(plain.focus, "criteria");
  assert.equal(withTrend.weak.find((w) => w.id === "criteria").score - plain.weak.find((w) => w.id === "criteria").score, 2);
  const item = withTrend.items.find((i) => i.focus === "context");
  assert.ok(item.reasons.includes("최근 진단 3번 모두 맥락 누락"));
});
