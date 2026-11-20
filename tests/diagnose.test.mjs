import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIAGNOSIS_SYSTEM,
  runDiagnosis,
  validateDiagnosis,
} from "../lib/server/diagnosis.js";

// 실제 Gemini 키 없이 진단 판단 로직을 검사한다. ask는 Gemini 호출 자리에 넣는 테스트 대역이다.
const ALL = ["goal", "context", "constraint", "format", "criteria"];
const body = {
  job: "marketing",
  experience: "none",
  prompt: "신제품 출시 SNS 글을 써 줘. 20대 고객이 읽을 거야. 세 줄 이내로 써 줘.",
};

test("요청 검사: 직무·경험은 없어도 되지만 보냈다면 아는 값, 빈 프롬프트, 너무 긴 프롬프트", () => {
  assert.equal(validateDiagnosis(null), "요청 형식이 올바르지 않음.");
  assert.equal(validateDiagnosis({ ...body, job: "nope" }), "모르는 관심 직무");
  assert.equal(validateDiagnosis({ ...body, experience: "x" }), "모르는 AI 사용 경험");
  assert.equal(validateDiagnosis({ ...body, experience: "toString" }), "모르는 AI 사용 경험");
  assert.equal(validateDiagnosis({ ...body, job: "constructor" }), "모르는 관심 직무");
  assert.equal(validateDiagnosis({ prompt: body.prompt }), null, "설문이 없어져 직무·경험 없이도 진단");
  assert.match(validateDiagnosis({ ...body, prompt: "   " }), /한 줄 이상/);
  assert.match(validateDiagnosis({ ...body, prompt: "가".repeat(3001) }), /3000자/);
  assert.equal(validateDiagnosis(body), null);
});

test("키가 없으면 규칙 기반으로 같은 모양을 돌려준다", async () => {
  const r = await runDiagnosis(body);
  assert.equal(r.source, "rule");
  assert.deepEqual([...r.found, ...r.missing].sort(), [...ALL].sort());
  assert.ok(["초급", "중급", "고급"].includes(r.level));
  assert.ok(r.comment.length > 0);
  assert.equal(r.segments.map((s) => s.text).join(""), body.prompt);
});

test("Gemini가 고른 문장별 요소로 found, 수준, 밑줄을 정한다", async () => {
  let sent;
  const ask = async (req) => {
    sent = req;
    return {
      sentences: [
        { index: 0, items: ["goal", "nonsense"] },
        // 규칙 기반은 못 찾는 기준(criteria)을 Gemini가 찾았다고 가정
        { index: 1, items: ["context", "criteria"] },
        { index: 2, items: ["goal", "constraint"] },
        { index: 99, items: ["format"] },
      ],
      comment: "글의 목적이 분명해요. 결과를 어떤 모양으로 받을지 정해 보세요.",
    };
  };
  const r = await runDiagnosis(body, { ask });
  assert.equal(sent.system, DIAGNOSIS_SYSTEM);
  assert.match(sent.contents, /<sentences>[\s\S]*0: 신제품 출시 SNS 글을 써 줘\.[\s\S]*<\/sentences>/);
  assert.equal(r.source, "ai");
  assert.deepEqual(r.found, ["goal", "context", "constraint", "criteria"]);
  assert.deepEqual(r.missing, ["format"]);
  assert.equal(r.level, "고급");
  assert.equal(r.comment, "글의 목적이 분명해요. 결과를 어떤 모양으로 받을지 정해 보세요.");
  // 한 문장에 요소가 여럿이면 더 구체적인 요소가 앞에 온다(밑줄 색).
  assert.deepEqual(r.segments[1].items, ["criteria", "context"]);
  assert.deepEqual(r.segments[2].items, ["constraint", "goal"]);
  assert.equal(r.segments.map((s) => s.text).join(""), body.prompt);
});

test("Gemini가 실패하거나 엉뚱한 답을 주면 규칙 기반으로 대신한다", async () => {
  const quiet = console.warn;
  console.warn = () => {};
  try {
    const failed = await runDiagnosis(body, {
      ask: async () => {
        throw Object.assign(new Error("quota"), { status: 429 });
      },
    });
    assert.equal(failed.source, "rule");
    const garbage = await runDiagnosis(body, { ask: async () => ({ hello: "world" }) });
    assert.equal(garbage.source, "rule");
  } finally {
    console.warn = quiet;
  }
});

test("총평이 비었거나 너무 길면 규칙 기반 총평을 쓴다", async () => {
  const ask = async () => ({ sentences: [{ index: 0, items: ["goal"] }], comment: "가".repeat(400) });
  const r = await runDiagnosis(body, { ask });
  assert.equal(r.source, "ai");
  assert.match(r.comment, /목표는 잘 드러남/);
});
