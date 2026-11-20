import assert from "node:assert/strict";
import { test } from "node:test";
import { ALL_LESSONS, COURSE, COURSES, COURSE_LESSONS, findAnyLesson } from "../data/courses.js";
import { LESSONS } from "../data/curriculum.js";
import { ITEMS } from "../lib/items.js";
import { runEvaluation, validateEvaluation } from "../lib/server/evaluate.js";
import { checkFileOutput, gradeSort, gradeSpot, numbersIn, validateSort, validateSpot } from "../lib/server/practice.js";

const IDS = ITEMS.map((i) => i.id);
const mem1 = findAnyLesson("mem1");
const ver1 = findAnyLesson("ver1");
const file1 = findAnyLesson("file1");
const mem2 = findAnyLesson("mem2");
const allRight = () => Object.fromEntries(mem1.cards.map((c) => [c.id, c.answer]));

test("여섯 과정: 강의 id가 모두 있고, 과정 1은 지금 15강 그대로, 5·6은 준비 중", () => {
  assert.deepEqual(COURSES.map((c) => c.id), ["prompt", "memory", "file", "verify", "tool", "flow"]);
  assert.deepEqual(COURSE.prompt.lessons, LESSONS.map((l) => l.id));
  for (const c of COURSES) {
    for (const id of [...c.lessons, ...c.related]) assert.ok(findAnyLesson(id), `${c.id}: ${id}`);
    for (const id of c.lessons) assert.equal(findAnyLesson(id).course, c.id);
  }
  assert.deepEqual(COURSES.filter((c) => !c.ready).map((c) => c.id), ["tool", "flow"]);
  assert.equal(new Set(ALL_LESSONS.map((l) => l.id)).size, ALL_LESSONS.length);
});

test("새 강의의 기준 item은 다섯 요소 id나 null이고, 프롬프트 강의는 모범 프롬프트로 통과한다", async () => {
  for (const l of COURSE_LESSONS) {
    for (const c of l.criteria) assert.ok(c.item === null || IDS.includes(c.item), `${l.id} ${c.label}`);
  }
  const good = await runEvaluation({ lessonId: "mem2", prompt: mem2.model });
  assert.equal(good.passed, true, JSON.stringify(good.criteria));
  const bad = await runEvaluation({ lessonId: "mem2", prompt: mem2.lecture.bad });
  assert.equal(bad.passed, false);
  assert.ok(bad.coaching.question);
});

test("mem1 분류: 모두 맞히면 통과, 한 장 틀려도 7/8이면 통과", () => {
  const all = gradeSort(mem1, allRight());
  assert.equal(all.passed, true);
  assert.deepEqual(all.score, { right: 8, total: 8 });
  assert.equal(all.xp, 30);
  const one = gradeSort(mem1, { ...allRight(), budget: "keep" });
  assert.equal(one.passed, true);
  assert.equal(one.coaching, null);
  assert.equal(one.leftover.question, "다음 달에 다른 일을 맡길 때도 이 정보가 맞을까요?");
});

test("mem1 분류: 금지 카드를 하나라도 다른 칸에 두면 7/8이어도 통과 못 하고, 그 카드를 묻는다", () => {
  const r = gradeSort(mem1, { ...allRight(), review: "once" });
  assert.equal(r.passed, false);
  assert.deepEqual(r.score, { right: 7, total: 8 });
  assert.deepEqual(r.criteria.map((c) => c.met), [true, false]);
  assert.equal(r.coaching.question, '"옆 팀 동료의 인사 평가 내용"이 AI 서비스 기록에 남아도 괜찮을까요?');
  assert.equal(r.coaching.detail, "이번 작업에만 쓰더라도, 대화 기록은 서비스에 남을 수 있어요.");
  assert.equal(r.coaching.to, "never");
  const pw = gradeSort(mem1, { ...allRight(), password: "keep" });
  assert.match(pw.coaching.question, /^"회사 공용 계정 비밀번호"가 /);
  const phone = gradeSort(mem1, { ...allRight(), phone: "once" });
  assert.match(phone.coaching.question, /5678"이 /);
});

test("mem1 분류: 오래↔이번만을 바꿔 놓으면 그 방향의 질문, 금지 카드가 먼저", () => {
  const r = gradeSort(mem1, { ...allRight(), role: "once", deadline: "keep" });
  assert.equal(r.passed, false);
  assert.equal(r.coaching.question, "매번 다시 말하고 있는 정보는 아닌가요?");
  assert.equal(r.coaching.to, null);
  const first = gradeSort(mem1, { ...allRight(), role: "once", deadline: "keep", password: "once" });
  assert.equal(first.coaching.card, "password");
});

test("mem1 검사: 놓지 않은 카드가 있으면 채점하지 않는다", () => {
  assert.match(validateSort(mem1, { role: "keep" }), /7장/);
  assert.equal(validateSort(mem1, allRight()), null);
  assert.ok(validateSort(mem1, { ...allRight(), role: "trash" }));
  assert.ok(validateEvaluation({ lessonId: "mem1", answer: null }));
});

const spotAnswer = (over = {}) => ({
  picks: [
    { index: 0, kind: "wrong", fix: "예산은 300만 원으로 정했어요." },
    { index: 3, kind: "wrong" },
  ],
  missing: "이 대리가 금요일까지 경품 업체 두 곳 알아보기로 한 게 빠졌어요",
  ...over,
});

test("ver1 오류 찾기: 보드의 예(3곳 찾고 출처 문장 놓침)는 통과, 놓친 곳의 질문을 보여 준다", () => {
  const r = gradeSpot(ver1, spotAnswer());
  assert.equal(r.passed, true);
  assert.deepEqual(r.score, { found: 3, total: 4, falsePicks: 0 });
  const [s1, , s3, s4] = r.review.sentences;
  assert.equal(s1.status, "found");
  assert.equal(s1.fix, "예산은 300만 원으로 정했어요.");
  assert.equal(s1.note, "");
  assert.equal(s3.status, "missed");
  assert.equal(s3.question, "이 조사는 회의록 어디에 나오나요?");
  // 종류가 달라도 문장을 맞게 골랐으면 찾은 것으로 치고, 한 줄로 알려 준다.
  assert.equal(s4.status, "found");
  assert.equal(s4.note, "회의록에 아예 없는 내용이라 '지어낸 내용'에 더 가까워요.");
  assert.equal(r.review.missing.status, "found");
});

test("ver1 오류 찾기: 2곳만 찾으면 실패하고, 놓친 문장의 답은 숨긴 채 질문 하나만 던진다", () => {
  const r = gradeSpot(ver1, spotAnswer({ missing: "" }));
  assert.equal(r.passed, false);
  assert.equal(r.score.found, 2);
  assert.equal(r.coaching.question, "이 조사는 회의록 어디에 나오나요?");
  assert.equal(r.review.sentences[2].question, undefined);
  assert.equal(r.review.missing.status, "empty");
});

test("ver1 오류 찾기: 맞는 문장을 2개 이상 틀렸다고 고르면 통과하지 못한다", () => {
  const picks = [0, 1, 2, 3, 4].map((index) => ({ index, kind: "made" }));
  const r = gradeSpot(ver1, spotAnswer({ picks }));
  assert.equal(r.score.found, 4);
  assert.equal(r.score.falsePicks, 2);
  assert.equal(r.passed, false);
  assert.deepEqual(r.criteria.map((c) => c.met), [true, false]);
  assert.match(r.coaching.question, /회의록 어느 줄/);
});

test("ver1 검사: 같은 문장 두 번, 없는 종류, 아무것도 안 고름은 막는다", () => {
  assert.ok(validateSpot(ver1, { picks: [{ index: 0, kind: "wrong" }, { index: 0, kind: "made" }], missing: "" }));
  assert.ok(validateSpot(ver1, { picks: [{ index: 0, kind: "oops" }], missing: "" }));
  assert.ok(validateSpot(ver1, { picks: [], missing: "  " }));
  assert.ok(validateSpot(ver1, { picks: [{ index: 9, kind: "wrong" }], missing: "" }));
  assert.equal(validateSpot(ver1, spotAnswer()), null);
});

test("file1 결과 확인: 목록 번호는 빼고, 보고서에 없는 숫자를 찾는다", () => {
  assert.deepEqual(numbersIn("1. 문의 1,240건\n2) 9월에 212건"), ["1240", "9", "212"]);
  const weak = checkFileOutput(file1.sample, file1.outputs.weak);
  assert.deepEqual(weak.unknown, ["3.5", "30"]);
  assert.equal(weak.coreOk, true);
  const strong = checkFileOutput(file1.sample, file1.outputs.strong);
  assert.deepEqual(strong.unknown, []);
  assert.deepEqual(strong.core, ["총 문의 1,240건", "배송 지연 38%", "개선 제안"]);
});

test("file1 채점: 보드의 프롬프트는 4개 중 3개, 예시 보고서면 키 없이도 결과물 숫자를 확인한다", async () => {
  const files = [{ name: "3분기_고객문의_보고서.pdf", mimeType: "application/pdf" }];
  const prompt = "첨부한 보고서에서 팀장님께 올릴 핵심 세 가지를 뽑아 줘. 번호 목록으로.";
  assert.equal(validateEvaluation({ lessonId: "file1", prompt }), "파일을 붙여야 평가할 수 있어요.");
  assert.equal(validateEvaluation({ lessonId: "file1", prompt, files }), null);
  const r = await runEvaluation({ lessonId: "file1", prompt, files, sample: true });
  assert.deepEqual(r.criteria.map((c) => c.met), [true, true, true, false]);
  assert.equal(r.passed, false);
  assert.equal(r.coaching.question, "보고서에 없는 내용이 필요해지면 AI가 어떻게 해야 하나요?");
  assert.deepEqual(r.check.unknown, ["3.5", "30"]);
  const good = await runEvaluation({ lessonId: "file1", prompt: file1.model, files, sample: true });
  assert.equal(good.passed, true);
  assert.deepEqual(good.check.unknown, []);
  // 내 파일인데 AI가 읽지 못했으면 지어낸 결과물을 보여 주지 않는다.
  const own = await runEvaluation({ lessonId: "file1", prompt: file1.model, files: [{ name: "내보고서.pdf", mimeType: "application/pdf" }] });
  assert.equal(own.output, null);
  assert.equal(own.check, null);
});

test("Gemini 채점: 자료와 다섯 요소가 아닌 기준을 함께 보낸다", async () => {
  let sent;
  const ask = async (req) => {
    sent = req;
    return { found: ["context"], criteriaMet: mem2.criteria.map((_, index) => ({ index, met: true })), output: "요약" };
  };
  const r = await runEvaluation({ lessonId: "mem2", prompt: mem2.model }, { ask });
  assert.equal(r.passed, true);
  assert.match(sent.contents, /<material>[\s\S]*010-9876-5432[\s\S]*<\/material>/);
  assert.match(sent.contents, /0 \[기타\]: 지금까지 정한 것을/);
});
