// 화면이 부르는 API 함수들. 이름과 입출력 모양은 프론트와 백엔드가 처음 정한 약속 그대로다.
//
// diagnose({ job, experience, prompt, files? })               → POST /api/diagnose
//   -> { level, found, missing, comment, segments: [{ text, items }], source }
// generatePrompt({ job, level, purpose, reader, shape })      → POST /api/prompt (mode: generate)
//   -> { version, prompt, segments: [{ key, label, item, text, why, isNew }], requestContext, source }
//      source "rule"이면 AI 없이 고른 값으로 만든 예시 결과(lib/server/prompt.js)
// refinePrompt(basePrompt, request: string)                   → POST /api/prompt (mode: revise), 생성과 같은 모양
// gradeAttempt(lessonId, prompt, extra?)                      → POST /api/evaluate
//   extra: { answer }(sort·spot 강의) 또는 { files, sample }(file 강의), 그리고 관심 직무 { job }
//   -> { passed, criteria: [{ label, item | null, met }], found, coaching: { item, question, detail? } | null, output, xp, source }
//      sort는 score·cards, spot은 score·review, file은 check({ unknown, core, coreOk })가 더 붙는다.
//
// uploadFile(file, onProgress?)                               → POST /api/files (FormData)
//   -> { name, mimeType, size, uri?, sig?, source }   source "rule"이면 키가 없어 uri 없이 이름만 돌려준 것
// files: [{ name, mimeType, uri?, sig? }] 3개까지. sig는 업로드 때 받은 서명 그대로 보낸다. diagnose, guessAssumptions, compareStep이 받는다.
//
// 실패하면 화면에 그대로 보여 줄 한국어 문장을 담은 Error를 던진다.
// 첨부 파일이 만료됐으면(48시간) error.expired가 true다.
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
    throw new Error("서버에 연결하지 못함. 인터넷 연결 확인.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw Object.assign(new Error(data?.error || failMessage), { expired: Boolean(data?.expired) });
  return data;
}

// 서버로 보낼 때는 이름, 형식, uri만 보낸다(크기·상태는 화면에서만 쓴다).
const sendable = (files) =>
  (files ?? []).map(({ name, mimeType, uri, sig }) => (uri ? { name, mimeType, uri, sig } : { name, mimeType }));

// 올리는 동안 얼마나 올렸는지 보여 주려고 fetch 대신 XMLHttpRequest를 쓴다.
export function uploadFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      const data = xhr.response;
      if (xhr.status >= 200 && xhr.status < 300 && data) resolve(data);
      else reject(new Error(data?.error || "파일을 올리지 못함. 다시 올리기."));
    };
    xhr.onerror = () => reject(new Error("서버에 연결하지 못함. 인터넷 연결 확인."));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export function diagnose({ job, experience, prompt, files }) {
  return post(
    "/api/diagnose",
    { job, experience, prompt, files: sendable(files) },
    "진단하지 못함. 잠시 뒤 다시 시도.",
  );
}

// guessAssumptions({ job, prompt }) → POST /api/guess
//   -> { output: string | null, guesses: [{ item, quote, reason }], source }
// source가 "rule"이면 output은 null이고 guesses는 빠진 요소마다 고정 설명 하나(quote "")다.
export function guessAssumptions({ job, prompt, files }) {
  return post(
    "/api/guess",
    { job, prompt, files: sendable(files) },
    "AI가 추측한 부분을 불러오지 못함. 잠시 뒤 다시 시도.",
  );
}

// compareStep(step, { job, prompt, missing, improved?, before?, files? }) → POST /api/compare
//   step "mine"   -> { output, guesses: [{ item, quote, reason }], source }
//   step "refine" -> { sentences: [{ item, text, why, added }], source }
//   step "run"    -> { output, marks: [{ item, quote }], diffs: [{ item, before, after }], source }
// source가 "rule"이면 서버에 키가 없다는 뜻이고 나머지 필드는 없다. 화면은 예시 결과를 보여 준다.
export function compareStep(step, payload) {
  return post(
    "/api/compare",
    { step, ...payload, files: sendable(payload.files) },
    "결과를 받지 못함. 잠시 뒤 다시 시도.",
  );
}

// job: 관심 직무. 서버가 그 직무 상황으로 바꾼 미션(정답표·기준)으로 채점한다.
export function gradeAttempt(lessonId, prompt, { answer, files, sample, job } = {}) {
  const body = { lessonId, prompt };
  if (job) body.job = job;
  if (answer !== undefined) body.answer = answer;
  if (files !== undefined) Object.assign(body, { files: sendable(files), sample: Boolean(sample) });
  return post("/api/evaluate", body, "평가하지 못함. 잠시 뒤 다시 시도.");
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

const sourceOf = (data) => (data.source === "rule" ? "rule" : "ai");

export async function generatePrompt(req) {
  const context = {
    level: LEVEL_MAP[req.level] ?? "beginner",
    job: JOB[req.job]?.name ?? "직무 미정", // 진단 전이라 직무가 없으면 아무 직무나 넣지 않는다
    userInput: makeUserInput(req),
  };
  const data = await aiGenerate(context);
  return { version: 1, prompt: data.prompt, segments: adaptSegments(data), requestContext: context, source: sourceOf(data) };
}

export async function refinePrompt(base, request) {
  const context = base.requestContext;
  if (!context) throw new Error("이전 프롬프트의 요청 정보 없음. 처음부터 다시 만들기.");
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
    source: sourceOf(data),
  };
}
