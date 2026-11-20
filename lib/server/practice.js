// 프롬프트를 쓰지 않는 실습의 채점(팀이 짠 정답표 규칙, LLM을 쓰지 않는다)과 파일 실습의 결과물 확인.
// 모두 순수 함수다. 응답 모양은 /api/evaluate의 다른 채점과 같다: { passed, criteria, found, coaching, output, xp, source }
// 그 위에 실습마다 화면이 그릴 것(score, cards, review, check)을 더한다.
import { josa } from "../josa.js";
import { XP_PER_LESSON } from "../../data/curriculum.js";

const xpOf = (lesson, passed) => (passed ? (lesson.xp ?? XP_PER_LESSON) : 0);
// 따옴표로 감싼 카드 글 뒤에 붙일 이/가. 숫자로 끝나면 읽는 소리(영·일·삼·육·칠·팔은 받침)로 고른다.
function subjectOf(text) {
  const t = text.trim();
  const last = t.at(-1);
  if (/\d/.test(last)) return `"${t}"${"013678".includes(last) ? "이" : "가"}`;
  return `"${t}"${josa(t, ["이", "가"]).slice(t.length)}`;
}
const MAX_FIX = 200;
const MAX_MISSING = 300;

// ---------- sort·choose: 카드마다 정답 칸이 있는 실습 ----------
// sort는 카드를 칸으로 나누고(mem1), choose는 상황 카드마다 방법을 고른다(tool1). 채점은 같다.
// lesson.pass: { min, must } min장 이상 맞히고, 정답이 must인 카드는 모두 맞혀야 통과
// lesson.coaching: { [must]: 꼭 맞혀야 할 카드를 놓쳤을 때, "정답>놓은 칸": …, [정답]: … } 질문. {card}는 "카드 글"이/가
// lesson.mustDetail: 꼭 맞혀야 할 카드를 놓쳤을 때 도움말. 문자열이거나 { [놓은 칸]: 문장 }

export function validateSort(lesson, answer) {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return "카드를 칸에 놓아야 채점할 수 있어요.";
  const bins = new Set(lesson.bins.map((b) => b.id));
  const left = lesson.cards.filter((c) => !bins.has(answer[c.id])).length;
  if (left && lesson.kind === "choose") return `아직 방법을 고르지 않은 상황이 ${left}개 있어요. 모두 골라 주세요.`;
  if (left) return `아직 놓지 않은 카드가 ${left}장 있어요. 모두 칸에 놓아 주세요.`;
  return null;
}

// answer: { [카드 id]: 칸 id }
export function gradeSort(lesson, answer) {
  const cards = lesson.cards.map((c) => ({ id: c.id, placed: answer[c.id], right: answer[c.id] === c.answer }));
  const right = cards.filter((c) => c.right).length;
  const mustOk = lesson.cards.filter((c) => c.answer === lesson.pass.must).every((c) => answer[c.id] === c.answer);
  const enough = right >= lesson.pass.min;
  const passed = enough && mustOk;
  const criteria = [
    { label: lesson.criteria[0].label, item: null, met: enough },
    { label: lesson.criteria[1].label, item: null, met: mustOk },
  ];

  // 코칭은 한 장만: 꼭 맞혀야 할 카드를 놓친 것부터, 그다음은 카드 순서대로.
  const must = lesson.pass.must;
  const wrong = lesson.cards.filter((c) => answer[c.id] !== c.answer);
  const pick = wrong.find((c) => c.answer === must) ?? wrong[0];
  let coaching = null;
  if (pick) {
    const placed = answer[pick.id];
    const isMust = pick.answer === must;
    const rule = isMust ? lesson.coaching[must] : (lesson.coaching[`${pick.answer}>${placed}`] ?? lesson.coaching[pick.answer]);
    const detail = typeof lesson.mustDetail === "string" ? lesson.mustDetail : lesson.mustDetail?.[placed];
    coaching = {
      item: null,
      card: pick.id,
      // showTarget인 강의(mem1)는 꼭 맞혀야 할 카드를 옮겨 볼 칸을 보드처럼 알려 준다. 나머지는 질문만 던진다.
      to: isMust && lesson.showTarget ? must : null,
      question: (rule?.question ?? "이 카드를 다시 볼까요?").replace("{card}", subjectOf(pick.text)),
      detail: isMust && detail ? detail : `다시 볼 카드: "${pick.text}"`,
    };
  }
  return {
    passed,
    criteria,
    found: [],
    coaching: passed ? null : coaching,
    // 통과했어도 틀린 카드가 남아 있으면 한 줄로 알려 준다.
    leftover: passed ? coaching : null,
    output: null,
    xp: xpOf(lesson, passed),
    source: "rule",
    score: { right, total: lesson.cards.length },
    cards,
  };
}

// ---------- spot: AI 답변에서 문제 있는 문장 찾기 ----------

export function validateSpot(lesson, answer) {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return "고른 문장이 없어요.";
  const { picks = [], missing = "" } = answer;
  if (!Array.isArray(picks) || picks.length > lesson.sentences.length) return "고른 문장 정보가 올바르지 않아요.";
  const kinds = new Set(lesson.kinds.map((k) => k.id));
  const seen = new Set();
  for (const p of picks) {
    if (!p || !Number.isInteger(p.index) || p.index < 0 || p.index >= lesson.sentences.length || seen.has(p.index)) {
      return "고른 문장 정보가 올바르지 않아요.";
    }
    seen.add(p.index);
    if (!kinds.has(p.kind)) return "고른 문장마다 문제 종류를 골라 주세요.";
    if (p.fix !== undefined && (typeof p.fix !== "string" || p.fix.length > MAX_FIX)) return `고친 문장은 ${MAX_FIX}자 이내로 써 주세요.`;
  }
  if (typeof missing !== "string" || missing.length > MAX_MISSING) return `빠진 내용은 ${MAX_MISSING}자 이내로 써 주세요.`;
  if (!picks.length && !missing.trim()) return "문제 있는 문장을 고르거나 빠진 내용을 적어 주세요.";
  return null;
}

const kindName = (lesson, id) => lesson.kinds.find((k) => k.id === id)?.name ?? "";

// answer: { picks: [{ index, kind, fix? }], missing: "빠진 내용" }
export function gradeSpot(lesson, answer) {
  const picks = new Map(answer.picks.map((p) => [p.index, p]));
  const sentences = lesson.sentences.map((s, index) => {
    const p = picks.get(index);
    if (s.answer && p) {
      return { index, status: "found", kind: p.kind, fix: p.fix?.trim() || "", note: p.kind === s.answer ? "" : s.kindNote };
    }
    if (s.answer) return { index, status: "missed" };
    if (p) return { index, status: "false", kind: p.kind };
    return { index, status: "ok" };
  });
  const text = answer.missing.trim();
  const hits = lesson.missing.words.filter((w) => text.includes(w)).length;
  const missingFound = hits >= lesson.missing.min;

  const hidden = lesson.sentences.filter((s) => s.answer).length + 1;
  const foundCount = sentences.filter((s) => s.status === "found").length + (missingFound ? 1 : 0);
  const falsePicks = sentences.filter((s) => s.status === "false").length;
  const enough = foundCount >= lesson.pass.min;
  const fewFalse = falsePicks <= lesson.pass.maxFalse;
  const passed = enough && fewFalse;

  // 놓친 곳의 질문과 이유는 통과했을 때만 문장 옆에 보여 준다. 통과 전에는 코칭 질문 하나만 던진다.
  if (passed) {
    for (const s of sentences) {
      if (s.status === "missed") Object.assign(s, { question: lesson.sentences[s.index].question, why: lesson.sentences[s.index].why });
    }
  }
  let coaching = null;
  if (!passed) {
    const missed = sentences.find((s) => s.status === "missed");
    // 맞춰 볼 자료(source, 예: 회의록)와 AI가 쓴 글(answerName, 예: 요약)의 이름은 미션마다 다르다.
    const source = lesson.source ?? "자료";
    const answerName = lesson.answerName ?? "답";
    if (!fewFalse) {
      coaching = {
        item: null,
        question: `고른 문장이 ${source} 어느 줄과 다른가요?`,
        detail: `맞는 문장까지 고치면 ${josa(answerName, ["이", "가"])} 오히려 틀어져요.`,
      };
    } else if (missed) {
      coaching = {
        item: null,
        question: lesson.sentences[missed.index].question,
        detail: `${josa(source, ["과", "와"])} ${josa(answerName, ["을", "를"])} 한 줄씩 맞춰 보세요.`,
      };
    } else {
      coaching = { item: null, question: lesson.missing.question, detail: `${source}에 있는데 ${answerName}에 없는 것을 찾아 보세요.` };
    }
  }

  return {
    passed,
    criteria: [
      { label: lesson.criteria[0].label, item: null, met: enough },
      { label: lesson.criteria[1].label, item: null, met: fewFalse },
    ],
    found: [],
    coaching,
    output: null,
    xp: xpOf(lesson, passed),
    source: "rule",
    score: { found: foundCount, total: hidden, falsePicks },
    review: {
      sentences: sentences.map((s) => (s.kind ? { ...s, kindName: kindName(lesson, s.kind) } : s)),
      missing: missingFound
        ? { status: "found", note: lesson.missing.found }
        : passed
          ? { status: "missed", question: lesson.missing.question }
          : { status: text ? "tried" : "empty" },
    },
  };
}

// ---------- file: 예시 보고서로 받은 결과물 확인 ----------

// 결과물의 숫자를 뽑는다. 줄 앞의 목록 번호(1. 2) 같은 것)와 순위(1위)는 빼고, 1,240처럼 쉼표가 있는 숫자는 1240으로 본다.
export function numbersIn(text) {
  const body = String(text ?? "").replace(/^\s*\d+[.)]\s/gm, "");
  return [...body.matchAll(/\d[\d,]*(?:\.\d+)?(?![\d,.]*\s*위)/g)].map((m) => m[0].replace(/,(?=\d{3}\b)/g, "").replace(/,$/, ""));
}

// check: lesson.check { numbers, core, coreMin } → { unknown: [예시 파일에 없는 숫자], core: [담은 핵심 label], coreOk }
export function checkFileOutput(check, output) {
  const known = new Set(check.numbers);
  const unknown = [...new Set(numbersIn(output).filter((n) => !known.has(n)))];
  const core = check.core.filter((c) => c.check.test(String(output ?? ""))).map((c) => c.label);
  return { unknown, core, coreOk: core.length >= check.coreMin };
}
