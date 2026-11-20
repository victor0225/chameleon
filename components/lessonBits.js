"use client";

// 강의 화면의 공용 조각: 요소 칩, 다섯 칸 막대, 밑줄 그린 프롬프트, 밑줄 입력 칸, 코칭 질문 카드, 충족·미충족 아이콘.
// LessonRunner와 kind별 실습 칸(components/Practice.js)이 같이 쓴다.
import { Fragment } from "react";
import { analyze } from "@/lib/anatomy";
import { ITEM, ITEMS } from "@/lib/items";
import s from "./lesson.module.css";

const BLANK = /(\{\{[^{}\n]+\}\})/;
// 글 전체를 한 글자도 빠뜨리지 않고 문장 조각으로 나눈다. 입력 칸 위에 겹쳐 그릴 때 글자가 빠지면 줄이 어긋난다.
const PIECE = /[^.!?\n]*[.!?]+[ \t]*|[^.!?\n]+|\n+/g;

// 요소 색: 밑줄·막대는 --seg(원래 색), 글자는 --seg-t(글자색을 섞은 색)
export const itemVars = (id) => ({ "--seg": ITEM[id].color, "--seg-t": ITEM[id].text });

// 조각마다 들어 있는 요소 하나(가장 구체적인 것)를 고른다. [[조각, 요소 id | null], ...]
export function marksOf(text) {
  return (text.match(PIECE) ?? []).map((t) => [t, t.trim() ? (analyze(t).found[0] ?? null) : null]);
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

// marks를 주면 그 밑줄을, 없으면 규칙 기반 분석기로 문장마다 요소를 칠한다.
export function PromptText({ text, marks, className = "" }) {
  const list = marks ?? marksOf(text);
  return (
    <p className={`${s.prompt} ${className}`}>
      {list.map(([t, item], i) => (
        <Piece key={i} text={t} item={item} />
      ))}
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
        placeholder="AI에게 말하듯 그대로 써 보세요"
        aria-label={label}
        spellCheck={false}
      />
    </div>
  );
}

// 평가·피드백의 코칭 질문(보드 2-E 모양). 정답 대신 질문 하나와 도움말 한 줄.
export function CoachCard({ question, hint }) {
  return (
    <section className={`${s.card} ${s.coach}`} aria-labelledby="coach" data-tour="feedback-coach">
      <h2 id="coach" className={`${s.cardTitle} ${s.smallTitle}`}>
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
      <p className={s.hintText}>{hint ?? "정답을 대신 써 드리지 않아요. 이 질문에 답하듯 프롬프트를 고쳐 보세요."}</p>
    </section>
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
