// 작업 O-2: 손님 추천 미션(lib/guestPlan.js). 결과 비교 화면과 교육 탭이 같은 함수로 같은 세 장을 보여 준다.
import assert from "node:assert/strict";
import { test } from "node:test";
import { findAnyLesson } from "../data/courses.js";
import { fallbackItems, guestPlan } from "../lib/guestPlan.js";
import { lessonFor } from "../lib/jobContent.js";

const diagnosis = {
  at: "2026-11-21T09:00:00.000Z",
  job: "marketing",
  level: "초급",
  prompt: "신제품 텀블러 SNS 글 써 줘",
  found: ["goal"],
  missing: ["context", "constraint", "format", "criteria"],
};
const fresh = {
  xp: 0,
  completed: [],
  tries: {},
  mastery: { goal: 0, context: 0, constraint: 0, format: 0, criteria: 0 },
  history: [],
  levelUpSeen: [],
};

test("손님 추천: 진단에서 빠진 요소부터 과정 1 미션 세 개(맥락·형식·조건)", () => {
  const plan = guestPlan({ diagnosis, record: fresh });
  assert.equal(plan.focus, "context");
  assert.deepEqual(
    plan.items.map((i) => [i.lessonId, i.focus]),
    [
      ["b2", "context"],
      ["b3", "format"],
      ["b4", "constraint"],
    ],
  );
  for (const item of plan.items) assert.ok(item.reasons.length > 0 && item.reasons.length <= 2);
  assert.match(plan.items[0].reasons[0], /맥락 누락/);
});

test("비교 화면과 교육 탭: 같은 진단·기록이면 같은 세 개, 끝낸 미션은 빼고 다시 고른다", () => {
  const a = guestPlan({ diagnosis, record: fresh }).items.map((i) => i.lessonId);
  const b = guestPlan({ diagnosis: { ...diagnosis }, record: { ...fresh } }).items.map((i) => i.lessonId);
  assert.deepEqual(a, b);
  const after = guestPlan({ diagnosis, record: { ...fresh, completed: ["b2"], history: [{ lessonId: "b2", passed: true }] } });
  assert.ok(!after.items.some((i) => i.lessonId === "b2"));
  assert.equal(after.items.length, 3);
});

test("추천을 읽는 동안 채우는 카드: 빠진 요소를 목표·맥락·조건·형식·기준 순으로 초급 미션 하나씩", () => {
  assert.deepEqual(
    fallbackItems(diagnosis).map((i) => [i.lessonId, i.focus]),
    [
      ["b2", "context"],
      ["b4", "constraint"],
      ["b3", "format"],
    ],
  );
  assert.deepEqual(
    fallbackItems({ ...diagnosis, missing: ["goal"] }).map((i) => i.focus),
    ["goal"],
  );
  assert.deepEqual(fallbackItems(null), []);
});

test("/learn?mission=: 있는 미션은 관심 직무 내용으로 열고, 없는 id는 교육 첫 화면(찾지 못함)", () => {
  const b2 = lessonFor(findAnyLesson("b2"), "marketing");
  assert.equal(b2.id, "b2");
  assert.match(JSON.stringify(b2), /인플루언서|DM/);
  assert.equal(findAnyLesson("nope"), null);
  assert.equal(findAnyLesson(""), null);
});
