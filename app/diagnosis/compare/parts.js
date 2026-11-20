"use client";

// 결과 비교 화면의 두 모드(AI가 다듬은 프롬프트, 내가 고친 프롬프트)가 같이 쓰는 조각.
import { CheckIcon, ExampleChip, NO_AI_TEXT } from "@/components/Common";
import Link from "next/link";
import { ExpiredNotice } from "@/components/FileAttach";
import { countSentences, markRanges, splitBlanks } from "@/lib/compareText";
import { ITEM, ITEMS } from "@/lib/items";
import s from "./compare.module.css";

export const IDS = ITEMS.map((item) => item.id);
export const PHASES = ["내 프롬프트 실행", "프롬프트 다듬기", "다듬은 프롬프트 실행"];
export const COUNT_WORD = ["", "한", "두", "세", "네", "다섯"];

export const vars = (id) => ({ "--c": ITEM[id].color, "--t": ITEM[id].text });
export const joinSentences = (sentences) => sentences.map((x) => x.text).join("\n");

export function Chip({ id }) {
  return (
    <span className={s.chip} style={vars(id)}>
      {ITEM[id].name}
    </span>
  );
}

export function Num({ id, n, dim }) {
  if (!n) return null;
  return (
    <span className={`${s.num}${dim ? ` ${s.dim}` : ""}`} style={vars(id)}>
      {n}
    </span>
  );
}

export function Bar({ on }) {
  return (
    <span className={s.bar}>
      <span className={s.barSegs} aria-hidden="true">
        {IDS.map((id) => (
          <span key={id} className={on.includes(id) ? s.on : undefined} style={vars(id)} />
        ))}
      </span>
      <span className={s.barCount}>{on.length}/5</span>
    </span>
  );
}

// {{확인할 내용}} 같은 빈칸은 점선 테두리 칸으로 보여 준다.
export function WithBlanks({ text, className }) {
  return splitBlanks(text).map((part, i) =>
    part.blank ? (
      <span key={i} className={s.blank}>
        {part.text}
      </span>
    ) : (
      <span key={i} className={className}>
        {part.text}
      </span>
    ),
  );
}

// 결과물에 요소 표시를 입힌다. 내 결과는 점선(AI가 추측), 다듬은 결과는 실선(프롬프트가 바꾼 부분).
// 번호는 요소마다 처음 표시한 곳에만 붙인다. 조건의 번호는 아래 "길이" 줄에 붙인다.
// focus가 있으면 그 요소만 강조하고 나머지는 흐리게 한다.
export function MarkedOutput({ output, marks, solid, numOf, focus }) {
  const numbered = new Set(["constraint"]);
  return (
    <div className={s.output}>
      {markRanges(output, marks).map((part, i) => {
        if (!part.mark) return <WithBlanks key={i} text={part.text} className={focus ? s.dim : undefined} />;
        const id = part.mark.item;
        const first = !numbered.has(id);
        numbered.add(id);
        const tone = focus ? (focus === id ? ` ${s.hot}` : ` ${s.dim}`) : "";
        return (
          <span key={i}>
            <span
              className={`${s.mark} ${solid ? s.solid : s.dotted}${tone}`}
              style={vars(id)}
              title={part.mark.reason}
            >
              {part.text}
            </span>
            {first && <Num id={id} n={numOf(id)} dim={focus && focus !== id} />}
          </span>
        );
      })}
    </div>
  );
}

// sample: AI 미연결로 미리 만든 예시 결과면 길이 줄 끝에 같은 한 줄을 붙인다(캔버스 A5: 제목 아래가 아니라 결과 카드 안).
export function LengthLine({ output, solid, numOf, focus, sample = false }) {
  const n = numOf("constraint");
  const tone = focus ? (focus === "constraint" ? ` ${s.hot}` : ` ${s.dim}`) : "";
  return (
    <p className={s.length}>
      길이{" "}
      {n ? (
        <>
          <span className={`${s.mark} ${solid ? s.solid : s.dotted}${tone}`} style={vars("constraint")}>
            {countSentences(output)}문장
          </span>
          <Num id="constraint" n={n} dim={focus && focus !== "constraint"} />
        </>
      ) : (
        <span>{countSentences(output)}문장</span>
      )}
      {sample && ` · ${NO_AI_TEXT}`}
    </p>
  );
}

export function PromptText({ segments, prompt }) {
  const list = segments?.length ? segments : [{ text: prompt, items: [] }];
  return list.map((seg, i) =>
    seg.items?.length ? (
      <span key={i} className={`${s.mark} ${s.solid}`} style={vars(seg.items[0])}>
        {seg.text}
      </span>
    ) : (
      <span key={i}>{seg.text}</span>
    ),
  );
}

export function SampleBadge({ on }) {
  return on ? <ExampleChip /> : null;
}

export function Arrow({ back }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={back ? "M13 8H3M7 4 3 8l4 4" : "M3 8h10M9 4l4 4-4 4"} />
    </svg>
  );
}

// 첨부 파일 이름 줄. 키가 없을 때 보여 주는 예시에는 첨부가 없다.
export function FilesLine({ files }) {
  if (!files?.length) return null;
  return <p className={s.files}>첨부: {files.map((f) => f.name).join(", ")}</p>;
}

export function Pending({ phase, failure, onRetry, onReupload, phases = PHASES, title = "두 프롬프트를 AI에게 보내는 중" }) {
  return (
    <>
      <section className={s.pending} aria-live="polite">
        {failure ? (
          <div className={s.pendingHead}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="9" />
              <path d="M11 6.5v5.5M11 15.2v.3" />
            </svg>
            <p className={s.failText} role="alert">
              {failure.message || "결과를 받지 못함. 잠시 뒤 다시 시도."}
            </p>
          </div>
        ) : (
          <div className={s.pendingHead}>
            <svg className={s.spin} width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="9" stroke="var(--wash)" strokeWidth="3" />
              <path d="M11 2a9 9 0 0 1 9 9" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <p>{title}</p>
          </div>
        )}
        <ol className={s.phases}>
          {phases.map((label, i) => {
            const state = i < phase ? "done" : i > phase ? "wait" : failure ? "fail" : "now";
            return (
              <li key={label}>
                <span className={`${s.dot} ${s[state]}`}>{state === "done" ? "✓" : state === "fail" ? "!" : i + 1}</span>
                <span className={s.phaseText}>
                  <strong>{label}</strong>
                  <span className={state === "fail" ? s.failSub : undefined}>
                    {{ done: "끝남", now: "진행 중", fail: "응답 없음", wait: "기다리는 중" }[state]}
                  </span>
                </span>
                {i < phases.length - 1 && <span className={`${s.phaseLine}${state === "done" ? ` ${s.done}` : ""}`} aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
        {failure?.expired && <ExpiredNotice onDone={onReupload} />}
        {failure && !failure.expired && (
          <div className={s.pendingActions}>
            <button type="button" className={s.primary} onClick={onRetry}>
              다시 시도
            </button>
            <Link href="/diagnosis/result" className={s.secondary}>
              진단 결과로
            </Link>
          </div>
        )}
      </section>
      {!failure && (
        <div className={s.skeletons} aria-hidden="true">
          {[0, 1].map((k) => (
            <div key={k} className={s.skel}>
              <span style={{ width: "40%", height: 14 }} />
              <span />
              <span style={{ width: "92%" }} />
              <span className={s.skelBox} />
              <span style={{ width: "70%" }} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// 비교 단계 이동. 누르면 그 단계로 간다.
export function FlowNav({ labels, step, onStep }) {
  return (
    <nav aria-label="비교 단계" className={s.flow} data-tour="compare-steps">
      <ol>
        {labels.map((label, i) => {
          const n = i + 1;
          const state = n === step ? "current" : n < step ? "done" : "wait";
          return (
            <li key={label}>
              <button
                type="button"
                className={`${s.flowBtn} ${s[state]}`}
                aria-current={n === step ? "step" : undefined}
                onClick={() => onStep(n)}
              >
                {state === "done" ? <CheckIcon /> : <span className={s.flowDot}>{n}</span>}
                {label}
              </button>
              {n < labels.length && <span className={s.flowLine} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
