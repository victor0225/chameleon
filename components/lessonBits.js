"use client";

// 강의 화면의 공용 조각: 요소 칩, 다섯 칸 막대, 밑줄 그린 프롬프트, 밑줄 입력 칸, 코칭 질문 카드, 충족·미충족 아이콘.
// LessonRunner와 kind별 실습 칸(components/Practice.js)이 같이 쓴다.
import { Fragment, useState } from "react";
import { analyze } from "@/lib/anatomy";
import { ITEM, ITEMS } from "@/lib/items";
import { ChevronIcon, InfoIcon } from "./Common";
import s from "./lesson.module.css";

const BLANK = /(\{\{[^{}\n]+\}\})/;
// 글 전체를 한 글자도 빠뜨리지 않고 문장 조각으로 나눈다. 입력 칸 위에 겹쳐 그릴 때 글자가 빠지면 줄이 어긋난다.
const PIECE = /[^.!?\n]*[.!?]+[ \t]*|[^.!?\n]+|\n+/g;

// 요소 색: 밑줄·막대는 --seg(원래 색), 글자는 --seg-t(글자색을 섞은 색)
export const itemVars = (id) => ({ "--seg": ITEM[id].color, "--seg-t": ITEM[id].text });

// 조각마다 들어 있는 요소 하나(가장 구체적인 것)를 고른다. [[조각, 요소 id | null], ...]
// prefer: 조각에 이 요소가 들어 있으면 그 색으로 칠한다(배우기 예시는 그 미션의 요소 색으로).
export function marksOf(text, prefer) {
  return (text.match(PIECE) ?? []).map((t) => {
    const found = t.trim() ? analyze(t).found : [];
    return [t, prefer && found.includes(prefer) ? prefer : (found[0] ?? null)];
  });
}

export const foundOf = (marks) => ITEMS.map((item) => item.id).filter((id) => marks.some(([, item]) => item === id));

export function ElementChip({ id }) {
  // 다섯 요소가 아닌 기준(item: null)은 칩 없이 그린다.
  if (!ITEM[id]) return null;
  return (
    <span className={s.chip} style={itemVars(id)}>
      {ITEM[id].name}
    </span>
  );
}

export function MiniBar({ found }) {
  return (
    <span className={s.minibar}>
      <span className={s.cells} aria-hidden="true">
        {ITEMS.map((item) => (
          <span key={item.id} style={found.includes(item.id) ? { background: item.color } : undefined} />
        ))}
      </span>
      <span className={s.count}>
        <span className={s.srOnly}>다섯 요소 중 </span>
        {found.length}/5
      </span>
    </span>
  );
}

// 앞뒤 공백은 밑줄 밖에 두고, {{빈칸}}은 점선 칸으로 그린다.
function Piece({ text, item }) {
  return text.split(BLANK).map((part, j) => {
    if (!part) return null;
    if (BLANK.test(part)) {
      return (
        <span key={j} className={s.blank}>
          {part}
        </span>
      );
    }
    if (!item || !part.trim()) return <Fragment key={j}>{part}</Fragment>;
    const [, lead, core, trail] = part.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return (
      <Fragment key={j}>
        {lead}
        <span className={s.mark} style={itemVars(item)}>
          {core}
        </span>
        {trail}
      </Fragment>
    );
  });
}

// "---"로 둘러싼 자료 조각(맥락)은 밑줄 대신 요소 색 점선 상자로 그린다(D1 좋은 예: 초록 칸 = AI가 읽을 자료).
export const isMaterialPiece = ([t, item]) => item === "context" && /^\s*---/.test(t);

// marks를 주면 그 밑줄을, 없으면 규칙 기반 분석기로 문장마다 요소를 칠한다.
export function PromptText({ text, marks, className = "" }) {
  const list = marks ?? marksOf(text);
  return (
    <p className={`${s.prompt} ${className}`}>
      {list.map(([t, item], i) =>
        isMaterialPiece([t, item]) ? (
          <span key={i} className={s.materialBlock} style={itemVars(item)}>
            {t.trim()}
          </span>
        ) : (
          <Piece key={i} text={t} item={item} />
        ),
      )}
    </p>
  );
}

// 투명한 입력 칸 뒤에 같은 글을 밑줄·빈칸 칩과 함께 그린다. 쓰는 대로 칠해진다.
export function PromptEditor({ value, onChange, inputRef, label }) {
  return (
    <div className={s.editor}>
      <div className={`${s.prompt} ${s.mirror}`} aria-hidden="true">
        {marksOf(value).map(([t, item], i) => (
          <Piece key={i} text={t} item={item} />
        ))}
        {/* 끝에 빈 줄이 있어도 높이가 줄지 않게 */}
        {"​"}
      </div>
      <textarea
        ref={inputRef}
        className={s.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          e.currentTarget.scrollTop = 0;
        }}
        placeholder="AI에게 말하듯 그대로 쓰기"
        aria-label={label}
        spellCheck={false}
      />
    </div>
  );
}

// 평가·피드백의 코칭 질문(공통 칸 ⑦). 피드백 머리 칸 바로 아래, 정답 대신 질문 하나와 도움말 한 줄.
export function CoachCard({ question, hint }) {
  return (
    <section className={s.coach} aria-labelledby="coach" data-tour="feedback-coach">
      <h2 id="coach" className={s.coachLabel}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
        </svg>
        코칭 질문
      </h2>
      <p className={s.question}>{question}</p>
      <p className={s.hintText}>{hint ?? "정답은 대신 쓰지 않음. 이 질문에 답하듯 프롬프트 고치기."}</p>
    </section>
  );
}

// 피드백 머리 칸(공통 칸 ⑥): 상태 아이콘 · 제목 · 점수 · 주 버튼 · 첫 점수 줄. 미션 종류와 상관없이 같은 모양이다.
// got/total: 점수, action: { label, onClick, icon }, retry: 이번이 다시 푼 것(랭킹에 들어가지 않음)
export function FeedbackHead({ passed, desc, got, total, xp, wasDone, retry, action }) {
  const note = retry
    ? "다시 해 본 점수 · 부문 점수와 랭킹 미반영"
    : `첫 풀이 점수 · 부문 점수와 랭킹에 반영${passed ? "" : ". 다시 해 본 점수는 미반영."}`;
  return (
    <section className={s.fh} aria-live="polite" aria-labelledby="feedback-title" data-tour="feedback-score">
      <span className={`${s.fhState} ${passed ? s.fhPass : s.fhFail}`} aria-hidden="true">
        {passed ? <MetIcon size={22} /> : <MissIcon size={18} />}
      </span>
      <div>
        <h2 id="feedback-title" className={s.fhTitle}>
          {passed ? "통과" : "아직 통과 전"}
        </h2>
        <p className={s.fhDesc}>{desc}</p>
      </div>
      <div className={s.fhScore}>
        <p className={s.fhNum}>
          {got}
          <small> / {total}</small>
        </p>
        <div className={s.fhSegRow}>
          <span className={s.fhSeg} aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <i key={i} className={i < got ? s.on : undefined} />
            ))}
          </span>
          {passed &&
            (wasDone ? <span className={s.note}>이미 마친 미션 · XP 그대로</span> : <span className={s.xpPill}>+{xp} XP</span>)}
        </div>
      </div>
      {action && (
        <button type="button" className={s.primary} onClick={action.onClick}>
          {action.icon}
          {action.label}
        </button>
      )}
      <p className={s.fhNote}>
        <InfoIcon size={16} />
        {note}
      </p>
    </section>
  );
}

// 해 보기·배우기의 통과 기준: 체크 상자가 아닌 점 목록(공통 칸 ⑧). 누르는 것처럼 보이지 않게 한다.
export function CriteriaDots({ criteria, extra = [] }) {
  return (
    <ul className={s.dots}>
      {criteria.map((c) => (
        <li key={c.label}>
          <span className={s.dot} aria-hidden="true" />
          <span className={s.grow}>{c.label}</span>
          <ElementChip id={c.item} />
        </li>
      ))}
      {extra.map((t) => (
        <li key={t}>
          <span className={s.dot} aria-hidden="true" />
          <span className={s.grow}>{t}</span>
        </li>
      ))}
    </ul>
  );
}

// 피드백의 기준 목록(공통 칸 ⑧): 못 넘은 것 먼저, 맞은 것은 접는다. 모두 맞았으면 맞은 것을 그대로 보인다.
// items: [{ key, label, item, met, after }]  after: 줄 오른쪽 끝에 붙일 글(예: 내가 고른 방법)
export function CriteriaResult({ items, foldLabel = (n) => `채운 기준 ${n}개 보기` }) {
  const [open, setOpen] = useState(false);
  const miss = items.filter((c) => !c.met);
  const met = items.filter((c) => c.met);
  const row = (c) => (
    <li key={c.key ?? c.label} className={c.met ? s.critMet : s.critMiss}>
      <span className={c.met ? s.icOk : s.icNo}>{c.met ? <MetIcon size={12} /> : <MissIcon size={10} />}</span>
      <span className={s.grow}>{c.label}</span>
      {c.after && <span className={s.critAfter}>{c.after}</span>}
      <ElementChip id={c.item} />
    </li>
  );
  if (!miss.length) return <ul className={s.crit}>{met.map(row)}</ul>;
  return (
    <>
      <ul className={s.crit}>{miss.map(row)}</ul>
      {met.length > 0 && (
        <>
          <button type="button" className={s.fold} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "접기" : foldLabel(met.length)}
            <span className={s.foldIcon}>
              <ChevronIcon open={open} />
            </span>
          </button>
          {open && <ul className={s.crit}>{met.map(row)}</ul>}
        </>
      )}
    </>
  );
}

export function MetIcon({ size = 14, color = "#fff" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="충족"
    >
      <path d="M2.5 7.5 5.5 10.5 11.5 3.5" />
    </svg>
  );
}

export function MissIcon({ size = 12 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      stroke="var(--danger)"
      strokeWidth="2"
      strokeLinecap="round"
      role="img"
      aria-label="미충족"
    >
      <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.5 2.5l3 3L6 15H3v-3z" />
    </svg>
  );
}

// 해 보기·피드백 위 '할 일' 한 줄 카드. children은 할 일 아래에 붙는 조작 안내(분류·오류 찾기).
export function TodoCard({ lesson, children }) {
  return (
    <section className={`${s.card} ${s.todoRow}`} aria-labelledby="practice-mission">
      <h2 id="practice-mission" className={s.smallTitle}>
        할 일
      </h2>
      <div>
        <p>{lesson.mission}</p>
        {children}
      </div>
    </section>
  );
}

// 피드백 머리 칸의 설명 한 줄: 프롬프트·파일 미션
export function criteriaDesc(grade) {
  const total = grade.criteria.length;
  const met = grade.criteria.filter((c) => c.met).length;
  if (grade.passed) return `통과 기준 ${total}개 모두 충족`;
  return `${total}개 중 ${met}개 충족.${total - met === 1 ? " 1개만 고치면 통과." : ""}`;
}
