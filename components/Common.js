// 여러 화면이 같이 쓰는 작은 조각(디자인 캔버스 '공통 칸'): 첫 점수 규칙 칩, 예시 결과 칩, 단계 표시, 아이콘.
// 진단(설문 → 프롬프트 → 결과), 결과 비교, 미션(배우기 → 해 보기 → 피드백)이 같은 단계 표시를 쓴다.
import { Fragment } from "react";
import { ITEMS } from "@/lib/items";
import c from "./common.module.css";

export const RULE_TEXT = "처음 푼 점수만 부문 점수와 랭킹에 반영";
export const RETRY_TEXT = "다시 푸는 중 · 이번 점수는 랭킹 미반영";
// 예시 결과 칩 옆에 붙이는 한 줄. AI가 연결되지 않아 미리 만든 결과를 보여 줄 때 모든 화면이 같은 말을 쓴다.
export const NO_AI_TEXT = "AI 미연결 · 미리 만든 예시 결과";

export function InfoIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </svg>
  );
}

export function ArrowIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function BackIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function CheckIcon({ size = 14, width = 3 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function ChevronIcon({ open = false, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d={open ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
    </svg>
  );
}

// 첫 점수 규칙 칩: 해 보기 위, 랭킹에서 같은 문장. retry면 이미 푼 미션을 다시 푸는 중이라는 칩.
export function RuleChip({ retry = false, className = "" }) {
  return (
    <p className={`${c.rule} ${retry ? c.retry : ""} ${className}`}>
      <InfoIcon size={18} />
      {retry ? RETRY_TEXT : RULE_TEXT}
    </p>
  );
}

export function ExampleChip({ children = "예시 결과" }) {
  return (
    <span className={c.example}>
      <InfoIcon size={14} />
      {children}
    </span>
  );
}

// 단계 표시. steps: 이름 목록, current: 지금 단계 번호(0부터). tours: 단계마다 붙일 data-tour(없으면 생략)
export function Steps({ steps, current, label, tour, tours = [], className = "" }) {
  return (
    <ol className={`${c.steps} ${className}`} aria-label={label} data-tour={tour}>
      {steps.map((name, i) => (
        <Fragment key={name}>
          {i > 0 && <li aria-hidden="true" className={c.line} />}
          <li
            className={i === current ? c.now : i < current ? c.done : undefined}
            aria-current={i === current ? "step" : undefined}
            data-tour={tours[i]}
          >
            {i < current ? <CheckIcon /> : <span className={c.mono}>{i + 1}</span>}
            {name}
            {i < current && <span className={c.srOnly}> 마침</span>}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}

// "비어 있음: 맥락 · 기준"처럼 빠진 요소를 한 줄로. 셋 이상이면 "비어 있음: 목표 외 3개".
export function emptyLine(found) {
  const missing = ITEMS.filter((item) => !found.includes(item.id)).map((item) => item.name);
  if (!missing.length) return "다섯 요소 모두 채움";
  return `비어 있음: ${missing.length <= 2 ? missing.join(" · ") : `${missing[0]} 외 ${missing.length - 1}개`}`;
}
