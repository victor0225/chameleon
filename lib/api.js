// 화면이 부르는 API 함수 네 개. 이름과 입출력 모양은 프론트와 백엔드가 처음 정한 약속 그대로다.
//
// diagnose({ job, experience, prompt })                       → POST /api/diagnose
//   -> { level, found, missing, comment, segments: [{ text, items }], source }
// generatePrompt({ job, level, purpose, reader, shape })      → POST /api/prompt (mode: generate)
//   -> { version, prompt, segments: [{ key, label, item, text, why, isNew }], requestContext }
// refinePrompt(basePrompt, request: string)                   → POST /api/prompt (mode: revise), 생성과 같은 모양
// gradeAttempt(lessonId, prompt)                              → POST /api/evaluate
//   -> { passed, criteria: [{ label, item, met }], found, coaching: { item, question } | null, output, xp, source }
//
// 실패하면 화면에 그대로 보여 줄 한국어 문장을 담은 Error를 던진다.
// source가 "rule"이면 서버에 GEMINI_API_KEY가 없거나 Gemini 호출이 실패해 규칙 기반으로 답한 것이다.
// ItemId = "goal" | "context" | "constraint" | "format" | "criteria" (lib/items.js)
import { JOB } from "@/data/jobs";
import { generatePrompt as aiGenerate, revisePrompt as aiRevise } from "@/lib/promptClient";

async function post(url, body, failMessage) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error || failMessage);
  return data;
}

export function diagnose({ job, experience, prompt }) {
  return post("/api/diagnose", { job, experience, prompt }, "진단하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
}

// guessAssumptions({ job, prompt }) → POST /api/guess
//   -> { output: string | null, guesses: [{ item, quote, reason }], source }
// source가 "rule"이면 output은 null이고 guesses는 빠진 요소마다 고정 설명 하나(quote "")다.
export function guessAssumptions({ job, prompt }) {
  return post("/api/guess", { job, prompt }, "AI가 추측한 부분을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
}

export function gradeAttempt(lessonId, prompt) {
  return post("/api/evaluate", { lessonId, prompt }, "평가하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
}

// 기능 1(프롬프트 작성 도우미): 프론트의 한글 숙련도·직무 ID·형식을 /api/prompt 계약으로 바꾼다.
const LEVEL_MAP = { "초급": "beginner", "중급": "intermediate", "고급": "advanced" };
const SHAPE_MAP = {
  auto: null,
  text: "문단으로 구성된 글",
  list: "핵심 항목 목록",
  table: "표",
  email: "이메일(제목과 본문)",
};

function makeUserInput({ purpose, reader, shape }) {
  const lines = [purpose.trim()];
  if (reader?.trim()) lines.push(`읽는 대상: ${reader.trim()}`);
  if (SHAPE_MAP[shape]) lines.push(`원하는 출력 형식: ${SHAPE_MAP[shape]}`);
  return lines.join("\n");
}

function adaptSegments(data, previous) {
  const oldText = Object.fromEntries((previous?.segments ?? []).map(s => [s.key, s.text]));
  return data.segments.map(s => ({
    ...s,
    item: s.item ?? s.key,
    label: s.label ?? s.key,
    why: s.why ?? "이 항목은 프롬프트의 품질을 높이는 데 도움을 줍니다.",
    isNew: Boolean(previous && oldText[s.key] !== s.text),
  }));
}

export async function generatePrompt(req) {
  const context = {
    level: LEVEL_MAP[req.level] ?? "beginner",
    job: JOB[req.job]?.name ?? "사무·행정",
    userInput: makeUserInput(req),
  };
  const data = await aiGenerate(context);
  return { version: 1, prompt: data.prompt, segments: adaptSegments(data), requestContext: context };
}

export async function refinePrompt(base, request) {
  const context = base.requestContext;
  if (!context) throw new Error("이전 프롬프트의 요청 정보가 없습니다. 처음부터 다시 만들어 주세요.");
  const data = await aiRevise({
    ...context,
    previousPrompt: base.prompt || base.segments.map(s => s.text).join("\n"),
    revisionRequest: request,
  });
  return {
    version: base.version + 1,
    prompt: data.prompt,
    segments: adaptSegments(data, base),
    requestContext: context,
  };
}
