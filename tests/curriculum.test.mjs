import assert from "node:assert/strict";
import { test } from "node:test";
import { LESSONS } from "../data/curriculum.js";
import { ITEMS } from "../lib/items.js";
import { ruleEvaluation, runEvaluation } from "../lib/server/evaluate.js";

// 강의 데이터가 화면과 채점이 기대하는 모양인지, check 정규식이 키 없는 채점에 쓰이는지 검사한다.
const IDS = ITEMS.map((item) => item.id);
const LEVELS = ["초급", "중급", "고급"];

test("모든 강의에 필수 필드가 있고 id가 겹치지 않는다", () => {
  for (const l of LESSONS) {
    for (const key of ["id", "level", "focus", "title", "summary", "mission", "model"]) {
      assert.ok(typeof l[key] === "string" && l[key].trim(), `${l.id}.${key}`);
    }
    for (const key of ["point", "bad", "good"]) assert.ok(l.lecture?.[key]?.trim(), `${l.id}.lecture.${key}`);
    for (const key of ["weak", "strong"]) assert.ok(l.outputs?.[key]?.trim(), `${l.id}.outputs.${key}`);
    assert.ok(l.criteria.length >= 1 && l.criteria.length <= 3, `${l.id} 통과 기준 개수`);
    for (const c of l.criteria) assert.ok(c.label?.trim(), `${l.id} 기준 label`);
  }
  assert.equal(new Set(LESSONS.map((l) => l.id)).size, LESSONS.length);
});

test("focus와 item은 다섯 요소 id다", () => {
  for (const l of LESSONS) {
    assert.ok(IDS.includes(l.focus), `${l.id}.focus=${l.focus}`);
    for (const c of l.criteria) assert.ok(IDS.includes(c.item), `${l.id} item=${c.item}`);
  }
});

test("단계마다 다섯 강의: 초급 5개, 중급 5개, 고급 5개", () => {
  assert.ok(LESSONS.every((l) => LEVELS.includes(l.level)));
  for (const level of LEVELS) assert.equal(LESSONS.filter((l) => l.level === level).length, 5, level);
});

test("check는 상태 없는 정규식이고, question은 문장이다", () => {
  for (const l of LESSONS) {
    for (const c of l.criteria) {
      if ("check" in c) {
        assert.ok(c.check instanceof RegExp, `${l.id} ${c.label}`);
        assert.ok(!c.check.global && !c.check.sticky, `${l.id} ${c.label}: g·y 플래그는 test 결과를 바꾼다`);
      }
      if ("question" in c) assert.ok(typeof c.question === "string" && c.question.trim());
    }
  }
});

test("check가 있는 기준은 키 없는 채점에서 그 정규식으로 판정된다", () => {
  for (const l of LESSONS) {
    const samples = [l.model, l.lecture.bad, l.lecture.good, "정리해 줘"];
    for (const prompt of samples) {
      const r = ruleEvaluation(l, prompt);
      l.criteria.forEach((c, i) => {
        if (c.check) assert.equal(r.criteria[i].met, c.check.test(prompt), `${l.id} "${c.label}" ← ${prompt}`);
      });
    }
  }
});

test("check가 다섯 요소 분석기보다 먼저다: 요소가 있어도 정규식이 안 맞으면 미충족", () => {
  const m2 = LESSONS.find((l) => l.id === "m2");
  const i = m2.criteria.findIndex((c) => c.check);
  // '표로'가 있어 분석기는 형식(format)을 찾지만, 예시가 없으니 예시 기준은 미충족이다.
  const r = ruleEvaluation(m2, "텀블러 홍보 문구 다섯 개를 표로 써 줘");
  assert.ok(r.found.includes(m2.criteria[i].item));
  assert.equal(r.criteria[i].met, false);
  assert.equal(r.passed, false);
  assert.equal(r.coaching.question, m2.criteria[i].question);
});

test("모범 프롬프트는 통과하고, 강의의 나쁜 예는 통과하지 못한다", async () => {
  for (const l of LESSONS) {
    const good = await runEvaluation({ lessonId: l.id, prompt: l.model });
    assert.equal(good.passed, true, `${l.id} 모범 프롬프트: ${JSON.stringify(good.criteria)}`);
    const bad = await runEvaluation({ lessonId: l.id, prompt: l.lecture.bad });
    assert.equal(bad.passed, false, `${l.id} 나쁜 예`);
    assert.ok(bad.coaching?.question, `${l.id} 코칭 질문`);
  }
});
