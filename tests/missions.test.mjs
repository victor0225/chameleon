// 작업 H: 과정 2~6에 더한 미션 10개. 키 없는 규칙 채점, 정답표 채점, 예시 파일 결과 확인, 새 데이터 기능(absent, tryAsk, noRun)
import assert from "node:assert/strict";
import { test } from "node:test";
import { findAnyLesson } from "../data/courses.js";
import { MORE_MISSIONS } from "../data/moreMissions.js";
import { evaluationContents, runEvaluation, validateEvaluation } from "../lib/server/evaluate.js";
import { checkFileOutput, gradeSort, gradeSpot } from "../lib/server/practice.js";

const lesson = (id) => findAnyLesson(id);
const sampleFiles = (l) => l.samples.map((f) => ({ name: f.name, mimeType: f.type }));
const grade = (id, prompt) => {
  const l = lesson(id);
  return runEvaluation({ lessonId: id, prompt, ...(l.kind === "file" ? { files: sampleFiles(l), sample: true } : {}) });
};
const rightAnswer = (l) => Object.fromEntries(l.cards.map((c) => [c.id, c.answer]));

test("새 미션 10개가 과정 2~6에 있고 id가 겹치지 않는다", () => {
  assert.deepEqual(
    MORE_MISSIONS.map((m) => m.id),
    ["mem3", "file2", "file3", "ver2", "ver3", "tool2", "tool3", "flow1", "flow2", "flow3"],
  );
  for (const m of MORE_MISSIONS) assert.equal(lesson(m.id), m);
});

test("absent 기준: 정규식이 안 맞아야 채운 것이다(mem3)", async () => {
  const base = "나는 마케팅팀에서 SNS를 맡고 있어. 답은 다섯 줄 이내 목록으로, 존댓말로 써 줘.";
  const ok = await grade("mem3", base);
  assert.equal(ok.passed, true);
  const once = await grade("mem3", `${base} 이번 주 금요일까지 보고서 마감이야.`);
  assert.equal(once.criteria[3].met, false, "이번 일에만 맞는 정보");
  const pii = await grade("mem3", `${base} 내 번호는 010-1234-5678이야.`);
  assert.equal(pii.criteria[4].met, false, "개인정보");
  assert.equal(pii.coaching.question, "이 설정이 서비스에 계속 남아도 괜찮은 정보인가?");
});

test("프롬프트·파일 미션: 키 없이 채점하면 모범 답은 통과하고 나쁜 예는 통과하지 못한다", async () => {
  for (const id of ["mem3", "file2", "file3", "tool2", "flow2"]) {
    const l = lesson(id);
    assert.equal((await grade(id, l.model)).passed, true, `${id} 모범 답`);
    assert.equal((await grade(id, l.lecture.bad)).passed, false, `${id} 나쁜 예`);
    assert.equal(validateEvaluation({ lessonId: id, prompt: l.model, ...(l.kind === "file" ? { files: sampleFiles(l) } : {}) }), null);
  }
});

test("분류·고르기 미션: 정답표로 채점하고, 꼭 맞혀야 할 카드를 놓치면 통과하지 못한다", () => {
  for (const id of ["tool3", "flow1", "flow3"]) {
    const l = lesson(id);
    const all = gradeSort(l, rightAnswer(l));
    assert.equal(all.passed, true, id);
    assert.deepEqual(all.score, { right: l.cards.length, total: l.cards.length });
  }
  // flow1: 검토 카드 하나를 초안 칸에 놓으면 5/6이어도 통과하지 못하고, 검토 질문을 던진다.
  const flow1 = lesson("flow1");
  const r = gradeSort(flow1, { ...rightAnswer(flow1), numbers: "s2" });
  assert.equal(r.passed, false);
  assert.equal(r.coaching.question, "'초안의 숫자가 회의록·표와 같은지 하나씩 맞춰 봐 줘'가 초안이 있어야 할 수 있는 일이 아닌가?");
  // flow3: 확인할 일을 그대로 쓴다고 고르면 그 칸에 맞는 질문을 던진다.
  const flow3 = lesson("flow3");
  const c = gradeSort(flow3, { ...rightAnswer(flow3), count: "auto", report: "auto", apology: "auto" });
  assert.equal(c.passed, false);
  assert.equal(c.coaching.question, "틀린 숫자나 문장이 그대로 나가면 어떤 일이 생기는가?");
  const h = gradeSort(flow3, { ...rightAnswer(flow3), budget: "check" });
  assert.equal(h.passed, false, "사람이 직접 할 일은 꼭 맞혀야 한다");
});

test("오류 찾기 미션: 숨겨 둔 곳을 찾으면 통과하고, 코칭은 미션의 자료 이름을 쓴다", () => {
  for (const id of ["ver2", "ver3"]) {
    const l = lesson(id);
    const picks = l.sentences.flatMap((s, index) => (s.answer ? [{ index, kind: s.answer }] : []));
    const r = gradeSpot(l, { picks, missing: l.missing.words.slice(0, 2).join(" ") });
    assert.equal(r.passed, true, id);
    assert.deepEqual(r.score, { found: 4, total: 4, falsePicks: 0 });
  }
  const ver2 = lesson("ver2");
  const none = gradeSpot(ver2, { picks: [{ index: 2, kind: "wrong" }], missing: "" });
  assert.equal(none.passed, false);
  assert.equal(none.coaching.detail, "표와 요약을 한 줄씩 맞춰 보기.");
  const ver3 = lesson("ver3");
  const falsy = gradeSpot(ver3, { picks: [0, 1, 2].map((index) => ({ index, kind: "wrong" })), missing: "" });
  assert.equal(falsy.coaching.question, "고른 문장이 공유 폴더 자료 어느 줄과 다른가?");
  assert.equal(falsy.coaching.detail, "맞는 문장까지 고치면 답이 오히려 틀어짐.");
});

test("예시 파일 결과 확인: file2는 표에 없는 숫자와 핵심, file3은 바뀐 점 네 가지 중 셋", () => {
  const file2 = lesson("file2");
  const strong2 = checkFileOutput(file2.check, file2.outputs.strong);
  assert.deepEqual(strong2.unknown, [], "순위(1위)와 목록 번호는 숫자로 세지 않는다");
  assert.equal(strong2.coreOk, true);
  assert.deepEqual(checkFileOutput(file2.check, "수납 선반이 130개로 1위예요").unknown, ["130"]);
  assert.equal(checkFileOutput(file2.check, file2.outputs.weak).coreOk, false);

  const file3 = lesson("file3");
  const strong3 = checkFileOutput(file3.check, file3.outputs.strong);
  assert.deepEqual(strong3.unknown, []);
  assert.deepEqual(strong3.core, ["출시일 12월 8일", "블로그 뺌", "경품 150개", "경품 담당 김 주임"]);
  assert.equal(checkFileOutput(file3.check, file3.outputs.weak).coreOk, false);
});

test("tryAsk는 결과 만들기 지시를 붙이고, flow2는 메모 자료를 함께 보낸다", () => {
  const mem3 = evaluationContents(lesson("mem3"), "나는 마케팅팀이야");
  assert.match(mem3, /<run>[\s\S]*"이번 주 SNS 게시물 아이디어 세 개 줘"라고 물었을 때의 답/);
  const flow2 = evaluationContents(lesson("flow2"), "[기간] 주간 보고를 써 줘");
  assert.match(flow2, /<material>[\s\S]*막힌 일: 디자인팀 일정이 밀려 배너가 늦어짐/);
  assert.doesNotMatch(flow2, /<run>/);
});

test("noRun 미션(tool2)은 Gemini가 결과를 써도 미리 만든 예시를 보여 준다", async () => {
  const tool2 = lesson("tool2");
  const ask = async () => ({ found: ["goal"], criteriaMet: tool2.criteria.map((_, index) => ({ index, met: true })), output: "지어낸 검색 결과" });
  const r = await runEvaluation({ lessonId: "tool2", prompt: tool2.model }, { ask });
  assert.equal(r.source, "ai");
  assert.equal(r.passed, true);
  assert.equal(r.output, tool2.outputs.strong);
});
