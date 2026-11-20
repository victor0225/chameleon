import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanRefine,
  cleanRun,
  missingOf,
  REFINE_SYSTEM,
  RUN_SYSTEM,
  runCompare,
  validateCompare,
} from "../lib/server/compare.js";
import { GUESS_SYSTEM } from "../lib/server/guess.js";
import { countSentences, markRanges, splitBlanks } from "../lib/compareText.js";
import { COMPARE_SAMPLE } from "../data/compareSample.js";

// 실제 Gemini 키 없이 결과 비교 판단 로직을 검사한다. ask는 Gemini 호출 자리에 넣는 테스트 대역이다.
const base = { job: "marketing", prompt: "신제품 텀블러 SNS 글 써 줘", missing: ["context", "constraint", "format", "criteria"] };
const BEFORE = "드디어 출시! 완벽한 텀블러를 소개합니다.";
const SENTENCES = [
  { item: "goal", text: "신제품 텀블러 게시글을 써 줘.", why: "올릴 곳을 더했어요." },
  { item: "context", text: "읽는 사람은 20대 직장인이야.", why: "누가 읽는지 알려 줬어요." },
  { item: "constraint", text: "세 문장 이내로 써 줘. 가격은 {{가격}}이야.", why: "분량을 정했어요." },
  { item: "format", text: "해시태그 다섯 개를 붙여 줘.", why: "모양을 정했어요." },
  { item: "criteria", text: "모르는 건 {{확인할 내용}}으로 비워 둬.", why: "지어내지 않게 막아요." },
];

test("요청 검사: 단계 이름, 직무, 프롬프트, 빠진 요소, run의 두 글을 본다", () => {
  assert.equal(validateCompare(null), "요청 형식이 올바르지 않음.");
  assert.match(validateCompare({ ...base, step: "all" }), /step/);
  assert.equal(validateCompare({ ...base, step: "mine", job: "toString" }), "관심 직무 고르기");
  assert.match(validateCompare({ ...base, step: "mine", missing: ["mood"] }), /빠진 요소/);
  assert.match(validateCompare({ ...base, step: "run", improved: "써 줘" }), /처음 결과/);
  assert.match(validateCompare({ ...base, step: "run", before: BEFORE }), /다듬은 프롬프트/);
  assert.equal(validateCompare({ ...base, step: "refine" }), null);
  assert.equal(validateCompare({ ...base, step: "run", improved: "써 줘", before: BEFORE }), null);
});

test("빠진 요소: 화면이 준 목록을 다섯 요소 순서로 쓰고, 없으면 규칙 분석기로 찾는다", () => {
  assert.deepEqual(missingOf({ ...base, missing: ["criteria", "context"] }), ["context", "criteria"]);
  assert.deepEqual(missingOf({ prompt: "보고서 써줘" }), ["context", "constraint", "format", "criteria"]);
});

test("키가 없으면 어느 단계든 source만 rule로 돌려준다", async () => {
  for (const step of ["mine", "refine", "run"]) {
    assert.deepEqual(await runCompare({ ...base, step, improved: "써 줘", before: BEFORE }), { source: "rule" });
  }
});

test("mine: 추측 실행과 같은 지시문을 쓰고, 결과물이 없으면 규칙으로 대신하지 않고 실패한다", async () => {
  let system;
  const r = await runCompare(
    { ...base, step: "mine" },
    {
      ask: async (req) => {
        system = req.system;
        return { output: BEFORE, guesses: [{ item: "context", quote: "완벽한 텀블러", reason: "읽는 사람을 몰랐어요." }] };
      },
    },
  );
  assert.equal(system, GUESS_SYSTEM);
  assert.equal(r.source, "ai");
  assert.equal(r.guesses.length, 1);
  await assert.rejects(runCompare({ ...base, step: "mine" }, { ask: async () => ({ output: "" }) }));
});

test("refine: 다섯 요소 순서로 세우고, 추가 표시는 진단에서 빠졌던 요소로 정한다", async () => {
  let req;
  const shuffled = [...SENTENCES].reverse().map((x) => ({ ...x, added: x.item === "goal" }));
  const r = await runCompare({ ...base, step: "refine" }, { ask: async (q) => ((req = q), { sentences: shuffled }) });
  assert.equal(req.system, REFINE_SYSTEM);
  assert.match(req.contents, /<prompt>\n신제품 텀블러 SNS 글 써 줘\n<\/prompt>/);
  assert.match(req.contents, /빠진 요소: 맥락, 조건, 형식, 기준/);
  assert.deepEqual(
    r.sentences.map((x) => [x.item, x.added]),
    [
      ["goal", false],
      ["context", true],
      ["constraint", true],
      ["format", true],
      ["criteria", true],
    ],
  );
});

test("refine: 한 요소라도 빠지거나 너무 길면 실패로 본다", () => {
  assert.throws(() => cleanRefine({ sentences: SENTENCES.slice(1) }, base.missing));
  const long = SENTENCES.map((x) => (x.item === "format" ? { ...x, text: "가".repeat(201) } : x));
  assert.throws(() => cleanRefine({ sentences: long }, base.missing));
  assert.throws(() => cleanRefine(null, base.missing));
});

test("run: 결과물에 없는 구절과 비교 대상이 아닌 요소는 버리고, 차이는 다섯 요소 순서로 둔다", async () => {
  const answer = {
    output: "출근길 커피가 따뜻하게. 가격은 {{가격}}이에요.\n#출근길 #커피",
    marks: [
      { item: "context", quote: "출근길 커피가 따뜻하게." },
      { item: "format", quote: "#출근길 #커피" },
      { item: "criteria", quote: "결과물에 없는 말" },
      { item: "mood", quote: "커피" },
    ],
    diffs: [
      { item: "format", before: "해시태그 8개", after: "해시태그 2개" },
      { item: "goal", before: "글", after: "게시글" },
      { item: "context", before: "모든 사람", after: "출근길 직장인" },
      { item: "criteria", before: "", after: "받은 정보만" },
    ],
  };
  let req;
  const r = await runCompare(
    { ...base, step: "run", improved: "써 줘", before: BEFORE },
    { ask: async (q) => ((req = q), answer) },
  );
  assert.equal(req.system, RUN_SYSTEM);
  assert.match(req.contents, /<before>\n드디어 출시!/);
  assert.deepEqual(
    r.marks.map((m) => m.item),
    ["context", "format"],
  );
  assert.deepEqual(
    r.diffs.map((d) => d.item),
    ["context", "format"],
  );
  assert.throws(() => cleanRun({ output: " " }, base.missing));
});

test("글 나누기: 문장 수는 해시태그를 빼고 세고, 빈칸과 표시는 겹치지 않게 자른다", () => {
  assert.equal(countSentences(COMPARE_SAMPLE.mine.output), 6);
  assert.equal(countSentences(COMPARE_SAMPLE.run.output), 3);
  assert.equal(countSentences(""), 0);
  assert.deepEqual(
    splitBlanks("가격은 {{가격}}이에요").map((p) => p.blank),
    [false, true, false],
  );
  const parts = markRanges("커피 커피 텀블러", [
    { item: "context", quote: "커피" },
    { item: "format", quote: "커피" },
    { item: "goal", quote: "" },
  ]);
  assert.deepEqual(
    parts.map((p) => [p.text, p.mark?.item ?? null]),
    [
      ["커피", "context"],
      [" ", null],
      ["커피", "format"],
      [" 텀블러", null],
    ],
  );
});

test("예시 결과는 세 단계 응답과 같은 모양이고 표시 구절이 결과물에 들어 있다", () => {
  const S = COMPARE_SAMPLE;
  assert.deepEqual(
    S.refined.sentences.map((x) => x.item),
    ["goal", "context", "constraint", "format", "criteria"],
  );
  for (const g of S.mine.guesses) if (g.quote) assert.ok(S.mine.output.includes(g.quote), g.quote);
  for (const m of S.run.marks) assert.ok(S.run.output.includes(m.quote), m.quote);
  assert.deepEqual(
    S.run.diffs.map((d) => d.item),
    S.missing,
  );
});
