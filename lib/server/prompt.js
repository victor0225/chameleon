// 프롬프트 작성 도우미(POST /api/prompt)의 예시 결과.
// GEMINI_API_KEY가 없거나 Gemini 호출이 실패하면, 사용자가 고른 값(하고 싶은 일·읽는 사람·결과물 모양·수준)으로
// 다섯 요소 프롬프트를 규칙으로 만든다(source: "rule"). 일을 대신 하지 않고, 다른 AI에 넣을 프롬프트만 만든다.
// node --test로 바로 불러올 수 있게 상대 경로와 확장자를 쓴다.
import { analyze } from "../anatomy.js";
import { josa } from "../josa.js";

export const PROMPT_KEYS = ["goal", "context", "constraint", "format", "criteria"];
// 줄마다 붙는 이유는 화면에 그대로 나오는 글이라 짧은 개조식으로 쓴다. AI 결과와 예시 결과가 같은 말을 쓴다.
export const PROMPT_INFO = {
  goal: { label: "목표", item: "goal", why: "무엇을 만들지 먼저 밝힘" },
  context: { label: "맥락", item: "context", why: "읽는 사람을 알면 말투와 내용이 맞춰짐" },
  constraint: { label: "조건", item: "constraint", why: "분량과 말투 지정" },
  format: { label: "형식", item: "format", why: "받을 모양 지정" },
  criteria: { label: "기준", item: "criteria", why: "지어낸 내용을 막는 기준" },
};

// lib/api.js가 userInput에 붙이는 줄. 나머지 줄이 하고 싶은 일이다.
const READER_LINE = /^읽는 대상:\s*(.+)$/;
const SHAPE_LINE = /^원하는 출력 형식:\s*(.+)$/;

export function readUserInput(userInput) {
  let reader = "";
  let shape = "";
  const rest = [];
  for (const raw of userInput.split("\n")) {
    const line = raw.trim();
    const r = line.match(READER_LINE);
    const f = line.match(SHAPE_LINE);
    if (r) reader = r[1].trim();
    else if (f) shape = f[1].trim();
    else if (line) rest.push(line);
  }
  return { purpose: rest.join(" "), reader, shape };
}

const withPeriod = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);
// 끝이 이미 부탁·문장이면 그대로 쓴다.
const SENTENCE_END = /(줘|줄래|해|요|다|까)$/;
// "보고서 작성"처럼 '하다'가 붙는 일
const DO_NOUN = /(작성|정리|요약|분석|번역|검토|기획|계획|비교|추천|답장|답변|조사|개선|준비|안내|설명|보고|요청|수정|점검)$/;
// "SNS 게시글"처럼 글로 쓰는 것
const WRITE_NOUN = /(글|문구|메일|이메일|게시글|공지|안내문|보고서|소개|편지|문자|후기|초안)$/;
const VERB_NOUN = [
  [/만들기$/, "만들어 줘."],
  [/찾기$/, "찾아 줘."],
  [/쓰기$/, "써 줘."],
  [/짜기$/, "짜 줘."],
  [/고르기$/, "골라 줘."],
  [/하기$/, "해 줘."],
];

function goalLine(purpose) {
  const p = purpose.replace(/[\s.!?]+$/, "");
  if (/[.!?]/.test(p) || SENTENCE_END.test(p)) return withPeriod(p);
  for (const [end, ask] of VERB_NOUN) if (end.test(p)) return p.replace(end, ask);
  if (DO_NOUN.test(p)) return `${p}해 줘.`;
  return `${josa(p, ["을", "를"])} ${WRITE_NOUN.test(p) ? "써" : "만들어"} 줘.`;
}

function contextLine(job, reader) {
  const who = job && job !== "직무 미정" ? `나는 ${job} 일을 하고 있어. ` : "";
  const readBy = reader ? josa(reader, ["이고", "고"]) : "{{읽는 사람}}이고";
  return `${who}읽는 사람은 ${readBy}, {{쓸 곳}}에 쓸 거야.`;
}

function constraintLine(level) {
  const must = level === "beginner" ? "" : " 꼭 넣을 것: {{꼭 넣을 것}}.";
  return `분량은 {{분량}} 안으로, 읽는 사람에게 맞는 말투로 써 줘.${must}`;
}

const FORMAT = {
  email: "이메일로 써 줘. 제목 한 줄, 본문, 끝인사 순서로.",
  table: "표로 정리하고, 맨 위 줄에 열 이름을 넣어 줘.",
  list: "핵심 항목을 번호 목록으로, 항목마다 한 줄씩 써 줘.",
  text: "두세 문단의 글로 쓰고, 첫 문단에 핵심을 먼저 써 줘.",
  auto: "소제목으로 나눠 읽기 쉽게 정리해 줘.",
};

function formatLine(shape) {
  if (/메일/.test(shape)) return FORMAT.email;
  if (/표/.test(shape)) return FORMAT.table;
  if (/목록/.test(shape)) return FORMAT.list;
  if (/글/.test(shape)) return FORMAT.text;
  return FORMAT.auto;
}

const CRITERIA = {
  beginner: "내가 준 정보에 없는 내용은 지어내지 말고, 모르는 부분은 [확인 필요]로 표시해 줘.",
  intermediate:
    "내가 준 정보에 없는 내용은 지어내지 말고 [확인 필요]로 표시해 줘. 다 쓴 뒤 빠진 내용이 없는지 한 번 더 확인해 줘.",
  advanced: "내가 준 정보에 없는 사실·수치는 지어내지 말고 [확인 필요]로 표시해 줘. 끝에 내가 직접 확인할 점을 세 줄로 붙여 줘.",
};

function respond(texts) {
  const segments = PROMPT_KEYS.map((key) => ({ key, ...PROMPT_INFO[key], text: texts[key], isNew: false }));
  return { success: true, prompt: segments.map((s) => s.text).join("\n"), segments, source: "rule" };
}

function exampleTexts({ level, job, userInput }) {
  const { purpose, reader, shape } = readUserInput(userInput);
  return {
    goal: goalLine(purpose || userInput.trim()),
    context: contextLine(job.trim(), reader),
    constraint: constraintLine(level),
    format: formatLine(shape),
    criteria: CRITERIA[level] ?? CRITERIA.beginner,
  };
}

// body: /api/prompt 요청({ mode: "generate", level, job, userInput }). 검사를 마친 값만 받는다.
export function examplePrompt(body) {
  return respond(exampleTexts(body));
}

// 고치기 요청을 해당 줄에 반영한다. 이미 들어 있는 말이면 다시 붙이지 않는다.
const addTo = (text, line) => (text.includes(line) ? text : `${text} ${line}`);
const REVISIONS = [
  [/짧/, (t) => ({ ...t, constraint: addTo(t.constraint, "전체를 지금보다 짧게, 핵심만 남겨 줘.") })],
  [/표/, (t) => ({ ...t, format: FORMAT.table })],
  [/목록/, (t) => ({ ...t, format: FORMAT.list })],
  [/메일/, (t) => ({ ...t, format: FORMAT.email })],
  [/요약/, (t) => ({ ...t, format: addTo(t.format, "맨 위에 한 줄 요약을 붙여 줘.") })],
  [/예시/, (t) => ({ ...t, constraint: addTo(t.constraint, "이해를 돕는 예시를 하나 넣어 줘.") })],
];

// body: { mode: "revise", level, job, userInput, previousPrompt, revisionRequest }
// 앞 버전이 다섯 줄(요소 순서)이면 그 위에 고치고, 아니면 처음 예시에서 고친다.
export function exampleRevise(body) {
  const lines = body.previousPrompt.split("\n").map((line) => line.trim());
  let texts =
    lines.length === PROMPT_KEYS.length && lines.every(Boolean)
      ? Object.fromEntries(PROMPT_KEYS.map((key, i) => [key, lines[i]]))
      : exampleTexts(body);
  const request = body.revisionRequest.trim();
  const matched = REVISIONS.filter(([pattern]) => pattern.test(request));
  if (matched.length) {
    for (const [, apply] of matched) texts = apply(texts);
  } else {
    // 정해진 요청이 아니면 요청 글이 가장 가까운 요소 줄 끝에 붙인다(못 고르면 조건).
    const key = analyze(request).found[0] ?? "constraint";
    texts = { ...texts, [key]: addTo(texts[key], withPeriod(request)) };
  }
  return respond(texts);
}
