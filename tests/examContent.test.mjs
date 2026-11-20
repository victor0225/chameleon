// 작업 L: 직무별 시험 문제(lib/server/exams/<직무>.js)가 약속한 모양을 지키는지와 채점 규칙(lib/examScore.js).
// 한 직무만 볼 때: node --test --test-name-pattern="sales" tests/examContent.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { EXAM_AREAS, EXAM_MEMORY_BINS, EXAM_TOOL_BINS } from "../data/exams.js";
import { JOB_MISSIONS } from "../lib/jobContent.js";
import { ALL_LESSONS } from "../data/courses.js";
import { JOBS } from "../data/jobs.js";
import { gradeExam, gradeQuestion, lastAnswered, rankRows, validateAnswers, weakestArea } from "../lib/examScore.js";
import { BLANKS_CHECK, examFor, publicExam } from "../lib/server/exams/index.js";

const BANNED = [/직무\s*전환/, /새\s*직무로\s*옮기/];
const perfect = (q) => {
  if (q.kind === "prompt" || q.kind === "template") return { text: q.model };
  if (q.kind === "sort" || q.kind === "choose") return { placed: Object.fromEntries(q.cards.map((c) => [c.id, c.answer])) };
  return { picks: q.sentences.flatMap((s, i) => (s.answer ? [i] : [])) };
};

test("채점 규칙: 부분 점수, 잘못 고른 문장 감점, 0점 바닥, 동점은 시간으로", () => {
  const q = {
    kind: "pick",
    sentences: [
      { text: "a", answer: true, miss: "a" },
      { text: "b", answer: true, miss: "b" },
      { text: "c", answer: false },
    ],
  };
  assert.equal(gradeQuestion(q, { picks: [0] }).score, 50);
  assert.equal(gradeQuestion(q, { picks: [0, 2] }).score, 0);
  assert.equal(gradeQuestion(q, { picks: [2] }).score, 0, "0점 아래로 내려가지 않는다");
  const cards = { kind: "sort", cards: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `c${n}`, text: `${n}`, answer: "keep" })) };
  assert.equal(gradeQuestion(cards, { placed: { c1: "keep", c2: "keep", c3: "keep", c4: "keep", c5: "keep" } }).score, 83);
  const w = {
    kind: "prompt",
    criteria: [
      { label: "x", item: null, check: /가/ },
      { label: "y", item: null, check: /나/ },
    ],
  };
  assert.equal(gradeQuestion(w, { text: "가" }).score, 50);
  assert.equal(gradeQuestion(w, { text: "  " }).score, 0);
  const ranked = rankRows([
    { id: "a", total: 480, seconds: 261 },
    { id: "b", total: 520, seconds: 270 },
    { id: "c", total: 480, seconds: 240 },
    { id: "d", total: 480, seconds: 240 },
  ]);
  assert.deepEqual(
    ranked.map((r) => [r.id, r.rank]),
    [
      ["b", 1],
      ["c", 2],
      ["d", 2],
      ["a", 4],
    ],
  );
  assert.equal(weakestArea([100, 83, 50, 67, 100, 80]).id, "file");
  assert.equal(weakestArea([100, 100, 100, 100, 100, 100]), null);
});

for (const job of JOBS) {
  const exam = examFor(job.id);
  test(`${job.id}: 시험 6문제가 부문 순서와 모양을 지킨다`, { skip: !exam && "아직 문제 없음" }, () => {
    assert.equal(exam.questions.length, EXAM_AREAS.length);
    const text = JSON.stringify(exam, (k, v) => (v instanceof RegExp ? v.source : v));
    for (const re of BANNED) assert.doesNotMatch(text, re);
    // 미션에 나온 할 일과 같은 상황을 쓰지 않는다.
    const missionTexts = ALL_LESSONS.map((l) => JOB_MISSIONS[job.id]?.[l.id]?.mission ?? l.mission);
    exam.questions.forEach((q, i) => {
      const area = EXAM_AREAS[i];
      assert.equal(q.area, area.id, `${i + 1}번 부문`);
      assert.equal(q.kind, area.kind, `${i + 1}번 kind`);
      assert.equal(typeof q.task, "string");
      assert.ok(q.task.length >= 10 && q.task.length <= 160, `${i + 1}번 할 일 길이`);
      assert.ok(!missionTexts.includes(q.task), `${i + 1}번 할 일이 미션과 같음`);
      assert.equal(typeof q.question, "string", `${i + 1}번 코칭 질문`);
      if (q.kind === "prompt" || q.kind === "template") {
        assert.ok(q.criteria.length >= 4 && q.criteria.length <= 6, `${i + 1}번 기준 4~6개`);
        for (const c of q.criteria) assert.equal(typeof c.label, "string");
        if (q.kind === "template")
          assert.ok(
            q.criteria.some((c) => c.check?.source === BLANKS_CHECK.source),
            "템플릿은 빈칸 기준",
          );
        assert.equal(gradeQuestion(q, { text: q.model }).score, 100, `${i + 1}번 모범 답은 만점`);
        assert.ok(gradeQuestion(q, { text: q.bad }).score <= 40, `${i + 1}번 나쁜 답은 40점 이하`);
      }
      if (q.kind === "sort" || q.kind === "choose") {
        const bins = new Set((q.kind === "sort" ? EXAM_MEMORY_BINS : EXAM_TOOL_BINS).map((b) => b.id));
        assert.ok(q.cards.length >= 4 && q.cards.length <= 8, `${i + 1}번 카드 4~8장`);
        assert.equal(new Set(q.cards.map((c) => c.id)).size, q.cards.length);
        for (const c of q.cards) assert.ok(bins.has(c.answer), `${i + 1}번 ${c.id} 정답 칸`);
        assert.equal(new Set(q.cards.map((c) => c.answer)).size >= 3, true, `${i + 1}번 정답 칸이 세 가지 이상`);
      }
      if (q.kind === "pick") {
        assert.ok(["table", "list"].includes(q.material?.kind));
        if (q.material.kind === "table") for (const row of q.material.rows) assert.equal(row.length, q.material.columns.length);
        const targets = q.sentences.filter((s) => s.answer);
        assert.ok(targets.length >= 2 && targets.length <= 3, `${i + 1}번 숨긴 문장 2~3개`);
        assert.ok(q.sentences.length >= 4 && q.sentences.length <= 6, `${i + 1}번 문장 4~6개`);
        for (const s of targets) assert.equal(typeof s.miss, "string", `${i + 1}번 놓친 문장 설명`);
      }
      assert.equal(gradeQuestion(q, perfect(q)).score, 100, `${i + 1}번 정답은 만점`);
    });
    const answers = exam.questions.map(perfect);
    assert.equal(validateAnswers(exam, answers), null);
    assert.equal(gradeExam(exam, answers).total, 600);
    assert.equal(gradeExam(exam, []).total, 0);
    assert.equal(lastAnswered(exam, answers.slice(0, 4)), 4);
  });

  test(`${job.id}: 화면에 보내는 문제에는 정답과 기준이 없다`, { skip: !exam && "아직 문제 없음" }, () => {
    const sent = JSON.stringify(publicExam(exam));
    for (const word of ['"answer"', '"criteria"', '"check"', '"miss"', '"model"', '"bad"', '"question"']) {
      assert.ok(!sent.includes(word), `${word}가 화면으로 나감`);
    }
  });

  // 코칭은 질문으로만 한다(index.js 머리말 "~인가?" 꼴). 결과 화면 '코칭 질문' 카드에 그대로 보인다.
  test(`${job.id}: 코칭 질문은 물음표로 끝난다`, { skip: !exam && "아직 문제 없음" }, () => {
    exam.questions.forEach((q, i) => {
      for (const text of [q.question, ...(q.criteria ?? []).map((c) => c.question).filter(Boolean)]) {
        assert.match(text, /\?$/, `${i + 1}번 "${text}"`);
      }
    });
  });
}

test("marketing: 보드 L4 예시 답(목표·맥락만)은 40점, 보드 L5 상황 네 장 그대로", { skip: !examFor("marketing") }, () => {
  const exam = examFor("marketing");
  const l4 = "다음 달 성수동 팝업 스토어 안내 문자를 써 줘. 지난 1년 동안 우리 제품을 산 고객에게 보낼 거야.";
  const graded = gradeQuestion(exam.questions[0], { text: l4 });
  assert.equal(graded.score, 40);
  assert.deepEqual(
    graded.criteria.filter((c) => c.met).map((c) => c.item),
    ["goal", "context"],
  );
  assert.deepEqual(
    exam.questions[4].cards.map((c) => [c.text, c.answer]),
    [
      ["이번 주 경쟁사 신제품 반응 정리", "search"],
      ["지난 캠페인 성과 엑셀 요약", "file"],
      ["광고 문구 세 가지 다른 말투로", "ask"],
      ["고객 명단으로 생일 쿠폰 대상 정하기", "no"],
    ],
  );
  // 보드 L6: 3번에서 하나만 찾으면 50점, 놓친 문장 설명이 그대로 보인다.
  const file = gradeQuestion(exam.questions[2], { picks: [3] });
  assert.equal(file.score, 50);
  assert.deepEqual(
    file.sentences.filter((s) => s.status === "missed").map((s) => s.miss),
    ["'재구매율 34%'는 표에 없는 숫자"],
  );
});
