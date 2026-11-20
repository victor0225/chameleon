// 직무별 시험 채점(팀이 짠 규칙, LLM을 쓰지 않는다). 순수 함수다.
// 모든 사람을 같은 규칙으로 채점해야 랭킹이 공정하니, 키가 있어도 Gemini를 부르지 않는다.
// 문제 모양은 lib/server/exams/index.js 머리말, 부문과 kind는 data/exams.js.
import { analyze } from "./anatomy.js";
import { ITEM } from "./items.js";
import { EXAM_AREAS, EXAM_MEMORY_BINS, EXAM_TOOL_BINS, QUESTION_POINTS } from "../data/exams.js";

export const MAX_TEXT = 3000;

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const pct = (got, total) => (total > 0 ? Math.round((QUESTION_POINTS * Math.max(0, got)) / total) : 0);
export const binsOf = (q) => q.bins ?? (q.kind === "choose" ? EXAM_TOOL_BINS : EXAM_MEMORY_BINS);

// 답 모양 검사. 시간이 끝나 낸 답은 비어 있어도 된다(그 문제는 0점). → 오류 문장 | null
export function validateAnswers(exam, answers) {
  if (!Array.isArray(answers) || answers.length > exam.questions.length) return "답 형식이 올바르지 않음.";
  for (const [i, a] of answers.entries()) {
    if (a === null || a === undefined) continue;
    const q = exam.questions[i];
    if (!isObj(a)) return "답 형식이 올바르지 않음.";
    if (q.kind === "prompt" || q.kind === "template") {
      if (a.text !== undefined && (typeof a.text !== "string" || a.text.length > MAX_TEXT))
        return `프롬프트는 ${MAX_TEXT}자 이내.`;
    } else if (q.kind === "sort" || q.kind === "choose") {
      if (a.placed !== undefined && !isObj(a.placed)) return "답 형식이 올바르지 않음.";
    } else if (q.kind === "pick") {
      const picks = a.picks ?? [];
      if (!Array.isArray(picks) || picks.length > q.sentences.length) return "답 형식이 올바르지 않음.";
      if (picks.some((p) => !Number.isInteger(p) || p < 0 || p >= q.sentences.length)) return "답 형식이 올바르지 않음.";
    }
  }
  return null;
}

// prompt·template: 기준마다 check(정규식)가 있으면 그것으로, 없으면 다섯 요소 분석기로 item이 들어 있는지 본다.
// absent인 기준은 정규식이 안 맞아야 채운 것이다. 빈 답은 아무 기준도 못 채운다.
function gradeWriting(q, answer) {
  const text = typeof answer?.text === "string" ? answer.text : "";
  const blank = !text.trim();
  const { found } = analyze(text);
  const criteria = q.criteria.map((c) => ({
    label: c.label,
    item: c.item ?? null,
    met: !blank && (c.check ? c.check.test(text) !== Boolean(c.absent) : found.includes(c.item)),
  }));
  const miss = q.criteria.find((c, i) => !criteria[i].met);
  return {
    score: pct(criteria.filter((c) => c.met).length, criteria.length),
    criteria,
    question: miss ? (miss.question ?? ITEM[miss.item]?.question ?? q.question ?? null) : null,
  };
}

// sort·choose: answer.placed = { [카드 id]: 칸 id }
function gradeCards(q, answer) {
  const placed = isObj(answer?.placed) ? answer.placed : {};
  const title = Object.fromEntries(binsOf(q).map((b) => [b.id, b.title]));
  const cards = q.cards.map((c) => ({
    id: c.id,
    text: c.text,
    placed: Object.hasOwn(title, placed[c.id]) ? placed[c.id] : null,
    answer: c.answer,
    answerTitle: title[c.answer],
    right: placed[c.id] === c.answer,
  }));
  const right = cards.filter((c) => c.right).length;
  return { score: pct(right, cards.length), cards, question: right < cards.length ? (q.question ?? null) : null };
}

// pick: answer.picks = [문장 index]. 숨겨 둔 문장(answer: true)을 찾은 수에서 잘못 고른 수를 뺀다.
function gradePick(q, answer) {
  const picks = new Set(Array.isArray(answer?.picks) ? answer.picks : []);
  const sentences = q.sentences.map((s, index) => {
    const picked = picks.has(index);
    const status = s.answer ? (picked ? "found" : "missed") : picked ? "false" : "ok";
    return { index, text: s.text, status, ...(s.answer ? { miss: s.miss } : {}) };
  });
  const targets = sentences.filter((s) => s.status === "found" || s.status === "missed").length;
  const found = sentences.filter((s) => s.status === "found").length;
  const falsePicks = sentences.filter((s) => s.status === "false").length;
  return {
    score: pct(found - falsePicks, targets),
    sentences,
    counts: { found, total: targets, falsePicks },
    question: found < targets || falsePicks ? (q.question ?? null) : null,
  };
}

export function gradeQuestion(q, answer) {
  if (q.kind === "prompt" || q.kind === "template") return gradeWriting(q, answer);
  if (q.kind === "sort" || q.kind === "choose") return gradeCards(q, answer);
  if (q.kind === "pick") return gradePick(q, answer);
  throw new Error(`모르는 문제 종류: ${q.kind}`);
}

// answers: 문제 순서대로 [답 | null]. → { scores: [6개], total, details: [문제마다 채점 결과] }
export function gradeExam(exam, answers = []) {
  const details = exam.questions.map((q, i) => ({ area: q.area, kind: q.kind, ...gradeQuestion(q, answers[i]) }));
  const scores = details.map((d) => d.score);
  return { scores, total: scores.reduce((a, b) => a + b, 0), details };
}

// 낸 답이 있는 마지막 문제 번호(1부터). 시간이 끝났을 때 "4번까지 푼 답으로 채점"에 쓴다. 하나도 없으면 0.
export function lastAnswered(exam, answers = []) {
  let last = 0;
  exam.questions.forEach((q, i) => {
    const a = answers[i];
    const has =
      q.kind === "prompt" || q.kind === "template"
        ? Boolean(a?.text?.trim())
        : q.kind === "pick"
          ? Boolean(a?.picks?.length)
          : isObj(a?.placed) && Object.keys(a.placed).length > 0;
    if (has) last = i + 1;
  });
  return last;
}

// 점수가 가장 낮은 부문(같으면 앞 문제). 결과 화면의 "약한 부문 미션 하러 가기"가 쓴다. 다 만점이면 null.
export function weakestArea(scores) {
  let low = null;
  scores.forEach((s, i) => {
    if (s < QUESTION_POINTS && (low === null || s < scores[low])) low = i;
  });
  return low === null ? null : EXAM_AREAS[low];
}

// 랭킹: 점수가 높은 순, 같으면 걸린 시간이 짧은 순. 점수와 시간이 모두 같으면 같은 순위다.
// rows: [{ userId, total, seconds, ... }] → 같은 줄에 rank를 붙여 정렬한 배열
export function rankRows(rows) {
  const sorted = [...rows].sort((a, b) => b.total - a.total || a.seconds - b.seconds);
  let rank = 0;
  return sorted.map((row, i) => {
    const prev = sorted[i - 1];
    if (!prev || prev.total !== row.total || prev.seconds !== row.seconds) rank = i + 1;
    return { ...row, rank };
  });
}
