import assert from "node:assert/strict";
import { test } from "node:test";
import { personalize, weaknesses } from "../lib/personalize.js";

const record = (extra = {}) => ({
  completed: [],
  mastery: { goal: 80, context: 60, constraint: 60, format: 60, criteria: 60 },
  ...extra,
});

test("약한 요소: 진단에서 빠진 요소와 최근 실습에서 못 넘은 기준이 먼저 온다", () => {
  const weak = weaknesses({
    diagnosis: { missing: ["format"] },
    record: record(),
    attempts: [
      { lessonId: "b5", passed: false, missed: ["criteria"] },
      { lessonId: "b5", passed: false, missed: ["criteria"] },
      { lessonId: "b1", passed: true, missed: [] },
    ],
  });
  assert.deepEqual(
    weak.slice(0, 2).map((w) => w.id),
    ["format", "criteria"],
  );
  const criteria = weak.find((w) => w.id === "criteria");
  assert.equal(criteria.missed, 2);
  assert.match(criteria.reasons[0], /기준 기준을 2번 못 넘었어요/);
  assert.match(weak[0].reasons.join(), /형식이 빠져 있었어요/);
});

test("커리큘럼: 내 수준에서 약한 요소 강의를 고르고, 이유를 붙이고, 한 요소에 몰리지 않는다", () => {
  const plan = personalize({
    level: "초급",
    diagnosis: { missing: ["format", "criteria"] },
    record: record({ mastery: { goal: 80, context: 80, constraint: 80, format: 0, criteria: 20 } }),
    attempts: [],
  });
  assert.equal(plan.focus, "format");
  // 형식(b3), 기준(b5) 다음은 약한 정도가 같은 세 요소 중 강의 순서가 앞선 목표(b1)다.
  assert.deepEqual(
    plan.items.map((i) => i.lessonId),
    ["b3", "b5", "b1"],
  );
  assert.ok(plan.items.every((i) => i.level === "초급" && i.reasons.length > 0));
  assert.equal(new Set(plan.items.map((i) => i.focus)).size, 3);
});

test("커리큘럼: 끝낸 강의는 빼고, 지난번에 못 넘은 강의는 이유를 앞에 둔다", () => {
  const plan = personalize({
    level: "초급",
    diagnosis: null,
    record: record({ completed: ["b1", "b3"] }),
    attempts: [{ lessonId: "b2", passed: false, missed: ["context"] }],
  });
  const ids = plan.items.map((i) => i.lessonId);
  assert.ok(!ids.includes("b1") && !ids.includes("b3"));
  assert.equal(ids[0], "b2");
  assert.equal(plan.items[0].reasons[0], "지난번에 이 미션을 통과하지 못했어요");
});

test("커리큘럼: 내 수준을 다 마치면 다음 단계 강의를 고르고, 위 단계는 미리 고르지 않는다", () => {
  const beginner = ["b1", "b2", "b3", "b4", "b5"];
  const next = personalize({ level: "초급", diagnosis: null, record: record({ completed: beginner }), attempts: [] });
  assert.ok(next.items.length > 0 && next.items.every((i) => i.level === "중급"));
  const fresh = personalize({ level: "초급", diagnosis: null, record: record(), attempts: [] });
  assert.ok(fresh.items.every((i) => i.level === "초급"));
  const all = personalize({
    level: "고급",
    diagnosis: null,
    record: record({ completed: ["b1", "b2", "b3", "b4", "b5", "m1", "m2", "m3", "m4", "m5", "a1", "a2", "a3", "a4", "a5"] }),
    attempts: [],
  });
  assert.deepEqual(all.items, []);
});
