import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// 실제 Gemini API 키 없이 API 계약·예외 처리·5개 구간 응답을 확인하는 테스트.
// GoogleGenAI만 테스트 대역으로 교체하므로 네트워크 호출은 일어나지 않습니다.
const filename = new URL("../app/api/prompt/route.js", import.meta.url);
const source = readFileSync(filename, "utf8");
const fixture = `
class GoogleGenAI {
  constructor() {
    this.models = {generateContent: async ({contents}) => {
      globalThis.__lastGeminiInput = contents;
      if (globalThis.__failGemini) throw Object.assign(new Error("quota exceeded"), {status: 429});
      return {text:JSON.stringify({segments: {
        goal:"회의록에서 할 일을 추출해 주세요.",
        context:"다음 회의록을 대상으로 처리합니다.",
        constraint:"담당자와 마감일을 빠짐없이 포함하세요.",
        format:"담당자 | 업무 | 마감일을 표로 작성하세요.",
        criteria:"없는 정보는 임의로 만들지 마세요."
      }})};
    }};
  }
}`;
// data: URL 모듈은 "@/" 경로를 못 찾으므로 예시 결과 모듈은 파일 주소로 바꿔 불러온다.
const promptLib = new URL("../lib/server/prompt.js", import.meta.url).href;
const stubbed = source
  .replace('import { GoogleGenAI } from "@google/genai";', fixture)
  .replace('from "@/lib/server/prompt";', `from "${promptLib}";`);
assert.ok(!stubbed.includes("@google/genai") && !stubbed.includes("@/lib/"), "import patch failed");
const { POST } = await import(`data:text/javascript;base64,${Buffer.from(stubbed).toString("base64")}`);
process.env.GEMINI_API_KEY = "test-placeholder-do-not-use";

function req(body) {
  return new Request("http://localhost/api/prompt", {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body)
  });
}
const common = {
  level:"beginner",job:"사무·행정",userInput:"회의록 업무 정리"
};

test("생성 요청 -> 성공, 기존 prompt 필드와 목업 segments 5개", async () => {
  const res = await POST(req({mode:"generate",...common}));
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.ok(data.prompt.includes("회의록"));
  assert.deepEqual(data.segments.map(s => s.key), ["goal", "context", "constraint", "format", "criteria"]);
  assert.ok(data.segments.every(s => typeof s.why === "string"));
});

test("수정 요청 -> 기존 프롬프트와 추가 요구사항 전달", async () => {
  const res = await POST(req({
    mode:"revise",...common,previousPrompt:"예전 지시", revisionRequest:"표로 바꿔줘"
  }));
  assert.equal(res.status, 200);
  assert.match(globalThis.__lastGeminiInput, /예전 지시/);
  assert.match(globalThis.__lastGeminiInput, /표로 바꿔줘/);
});

test("빈 입력 거부 -> 400", async () => {
  const res = await POST(req({mode:"generate",...common,userInput:""}));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).success, false);
});

test("수정 필수 필드 누락 -> 400", async () => {
  const res = await POST(req({mode:"revise",...common}));
  assert.equal(res.status, 400);
});

test("Gemini 호출 제한 -> 오류 대신 예시 결과(source: rule)", async () => {
  globalThis.__failGemini = true;
  const error = console.error;
  console.error = () => {};
  try {
    const res = await POST(req({mode:"generate",...common}));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.source, "rule");
  } finally {
    globalThis.__failGemini = false;
    console.error = error;
  }
});

test("키 없음 -> 고른 값으로 만든 다섯 요소 예시 결과, 개발자용 오류 없음", async () => {
  const key = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const res = await POST(req({
      mode:"generate", level:"intermediate", job:"마케팅",
      userInput:"신제품 SNS 게시글\n읽는 대상: 우리 브랜드 팔로워\n원하는 출력 형식: 핵심 항목 목록",
    }));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.source, "rule");
    assert.doesNotMatch(JSON.stringify(data), /GEMINI_API_KEY/);
    assert.deepEqual(data.segments.map(s => s.key), ["goal", "context", "constraint", "format", "criteria"]);
    const text = Object.fromEntries(data.segments.map(s => [s.key, s.text]));
    assert.equal(text.goal, "신제품 SNS 게시글을 써 줘.");
    assert.match(text.context, /마케팅/);
    assert.match(text.context, /우리 브랜드 팔로워/);
    assert.match(text.format, /번호 목록/);
    assert.ok(data.segments.every(s => s.why && !/요\.?$/.test(s.why)), "이유는 개조식");
    assert.equal(data.prompt, data.segments.map(s => s.text).join("\n"));

    const revised = await (await POST(req({
      mode:"revise", level:"intermediate", job:"마케팅", userInput:"신제품 SNS 게시글",
      previousPrompt:data.prompt, revisionRequest:"표로 바꾸기",
    }))).json();
    assert.equal(revised.source, "rule");
    const after = Object.fromEntries(revised.segments.map(s => [s.key, s.text]));
    assert.match(after.format, /표로/);
    assert.equal(after.goal, text.goal);
  } finally {
    if (key !== undefined) process.env.GEMINI_API_KEY = key;
  }
});
