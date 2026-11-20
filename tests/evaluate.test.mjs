import assert from "node:assert/strict";
import { test } from "node:test";
import { XP_PER_LESSON } from "../data/curriculum.js";
import { findLesson, runEvaluation, validateEvaluation } from "../lib/server/evaluate.js";

// 실제 Gemini 키 없이 교육 평가 판단 로직을 검사한다. ask는 Gemini 호출 자리에 넣는 테스트 대역이다.
const lesson = findLesson("b2");

test("요청 검사: 없는 강의, 빈 프롬프트", () => {
  assert.match(validateEvaluation({ lessonId: "zz", prompt: "a" }), /없는 미션/);
  assert.match(validateEvaluation({ lessonId: "b2", prompt: "" }), /프롬프트를 써야/);
  assert.equal(validateEvaluation({ lessonId: "b2", prompt: "회의록 정리해 줘" }), null);
});

test("키가 없으면 규칙 기반으로 화면이 쓰는 모양을 돌려준다", async () => {
  const r = await runEvaluation({ lessonId: "b2", prompt: "정리해 줘" });
  assert.equal(r.source, "rule");
  assert.equal(r.criteria.length, lesson.criteria.length);
  assert.ok(r.criteria.every((c) => typeof c.label === "string" && typeof c.met === "boolean"));
  assert.equal(r.passed, false);
  assert.equal(r.xp, 0);
  assert.ok(r.coaching?.question);
  assert.equal(r.output, lesson.outputs.weak);
});

test("Gemini가 기준을 모두 통과시키면 XP와 결과물을 준다", async () => {
  const ask = async () => ({
    found: ["goal", "context", "bogus"],
    criteriaMet: lesson.criteria.map((_, index) => ({ index, met: true })),
    output: "Gemini가 만든 결과물",
  });
  const r = await runEvaluation({ lessonId: "b2", prompt: "팀장님 보고용으로 정리해 줘" }, { ask });
  assert.equal(r.source, "ai");
  assert.equal(r.passed, true);
  assert.equal(r.xp, XP_PER_LESSON);
  assert.equal(r.coaching, null);
  assert.deepEqual(r.found, ["goal", "context"]);
  assert.equal(r.output, "Gemini가 만든 결과물");
});

test("통과하지 못하면 강의가 다루는 요소부터 질문한다", async () => {
  const focusIndex = lesson.criteria.findIndex((c) => c.item === lesson.focus);
  const ask = async () => ({
    found: ["goal"],
    criteriaMet: lesson.criteria.map((_, index) => ({ index, met: index !== focusIndex })),
    output: "",
  });
  const r = await runEvaluation({ lessonId: "b2", prompt: "정리해 줘" }, { ask });
  assert.equal(r.passed, false);
  assert.equal(r.coaching.item, lesson.focus);
  assert.equal(r.output, lesson.outputs.weak);
});

test("Gemini가 실패하면 규칙 기반으로 대신한다", async () => {
  const quiet = console.warn;
  console.warn = () => {};
  try {
    const r = await runEvaluation(
      { lessonId: "b2", prompt: "정리해 줘" },
      {
        ask: async () => {
          throw new Error("503");
        },
      },
    );
    assert.equal(r.source, "rule");
  } finally {
    console.warn = quiet;
  }
});

test("기준에 question이 있으면 그 질문으로 코칭한다", async () => {
  const m1 = findLesson("m1");
  const ask = async () => ({
    found: ["goal"],
    criteriaMet: m1.criteria.map((c, index) => ({ index, met: c.item !== m1.focus })),
    output: "",
  });
  const r = await runEvaluation({ lessonId: "m1", prompt: "요약해 줘" }, { ask });
  const first = m1.criteria.find((c) => c.item === m1.focus);
  assert.equal(r.coaching.item, m1.focus);
  assert.equal(r.coaching.question, first.question);
});
