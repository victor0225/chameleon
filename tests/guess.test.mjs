import assert from "node:assert/strict";
import { test } from "node:test";
import { GUESS_SYSTEM, RULE_REASONS, runGuess, validateGuess } from "../lib/server/guess.js";

// 실제 Gemini 키 없이 추측 판단 로직을 검사한다. ask는 Gemini 호출 자리에 넣는 테스트 대역이다.
const body = { job: "office", prompt: "보고서 써줘" };
const OUTPUT = "팀장님께 드리는 주간 업무 보고서입니다. 이번 주에는 신규 고객 3곳과 계약했습니다.";

const quietly = async (fn) => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.warn = warn;
  }
};

test("요청 검사: 진단과 같은 문장을 쓰고 experience는 받지 않는다", () => {
  assert.equal(validateGuess(null), "요청 형식이 올바르지 않아요.");
  assert.equal(validateGuess([]), "요청 형식이 올바르지 않아요.");
  assert.equal(validateGuess({ ...body, job: "constructor" }), "관심 직무를 골라 주세요.");
  assert.match(validateGuess({ ...body, prompt: "  " }), /한 줄 이상/);
  assert.match(validateGuess({ ...body, prompt: "가".repeat(3001) }), /3000자/);
  assert.equal(validateGuess(body), null);
});

test("키가 없으면 빠진 요소마다 고정 문장 하나를 rule 모양으로 돌려준다", async () => {
  const r = await runGuess(body);
  assert.equal(r.source, "rule");
  assert.equal(r.output, null);
  // "보고서 써줘"는 목표만 들어 있다.
  assert.deepEqual(
    r.guesses.map((g) => g.item),
    ["context", "constraint", "format", "criteria"],
  );
  for (const g of r.guesses) {
    assert.equal(g.quote, "");
    assert.equal(g.reason, RULE_REASONS[g.item]);
  }
});

test("Gemini 결과물에 없는 quote와 잘못된 item은 버리고 최대 5개만 남긴다", async () => {
  let sent;
  const ask = async (req) => {
    sent = req;
    return {
      output: OUTPUT,
      guesses: [
        { item: "context", quote: "팀장님께", reason: "읽는 사람을 몰라서 팀장님이라고 가정했어요." },
        { item: "context", quote: "사장님께", reason: "결과물에 없는 구절이에요." },
        { item: "nonsense", quote: "주간 업무 보고서", reason: "없는 요소예요." },
        { item: "criteria", quote: "신규 고객 3곳", reason: "실제 숫자를 몰라서 3곳이라고 지어냈어요." },
        { item: "format", quote: "", reason: "빈 구절이에요." },
        { item: "goal", quote: "주간", reason: "" },
        { item: "goal", quote: "주간 업무 보고서", reason: "어떤 보고서인지 몰라서 주간 보고서로 정했어요." },
        { item: "constraint", quote: "이번 주", reason: "기간을 몰라서 이번 주로 정했어요." },
        { item: "format", quote: "입니다.", reason: "말투를 몰라서 격식체로 썼어요." },
        { item: "constraint", quote: "계약했습니다", reason: "여섯 번째라 버려요." },
      ],
    };
  };
  const r = await runGuess(body, { ask });
  assert.equal(sent.system, GUESS_SYSTEM);
  assert.match(sent.contents, /직무: 사무·행정/);
  assert.doesNotMatch(sent.contents, /과제:/);
  assert.match(sent.contents, /<request>\n보고서 써줘\n<\/request>/);
  assert.equal(r.source, "ai");
  assert.equal(r.output, OUTPUT);
  assert.deepEqual(
    r.guesses.map((g) => g.quote),
    ["팀장님께", "신규 고객 3곳", "주간 업무 보고서", "이번 주", "입니다."],
  );
  assert.ok(r.guesses.every((g) => OUTPUT.includes(g.quote)));
});

test("Gemini가 실패하거나 결과물이 없으면 rule로 대신한다", async () => {
  const failed = await quietly(() =>
    runGuess(body, {
      ask: async () => {
        throw Object.assign(new Error("quota"), { status: 429 });
      },
    }),
  );
  assert.equal(failed.source, "rule");
  assert.equal(failed.output, null);
  const empty = await quietly(() => runGuess(body, { ask: async () => ({ guesses: [] }) }));
  assert.equal(empty.source, "rule");
});
