"use client";

// 결과 비교: 내 프롬프트로 받은 결과와, 빠진 요소를 채운 프롬프트로 받은 결과를 나란히 보여 준다.
// 한 화면에 세 단계(내 결과 → 다듬은 프롬프트 → 두 결과 비교)를 두고 단계마다 내용을 바꾼다.
// 세 단계 결과는 진단 결과(diagnosis.compare)에 붙여 저장해서, 다시 들어와도 AI를 다시 부르지 않는다.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import * as api from "@/lib/api";
import { useAppState } from "@/components/AppState";
import { COMPARE_SAMPLE } from "@/data/compareSample";
import { JOB } from "@/data/jobs";
import { countSentences, markRanges, splitBlanks } from "@/lib/compareText";
import { ITEM, ITEMS } from "@/lib/items";
import { RULE_REASONS } from "@/lib/server/guess";
import s from "./compare.module.css";

const IDS = ITEMS.map((item) => item.id);
const FLOW = ["내 결과 보기", "다듬은 프롬프트", "두 결과 비교"];
const PHASES = ["내 프롬프트 실행", "프롬프트 다듬기", "다듬은 프롬프트 실행"];
const COUNT_WORD = ["", "한", "두", "세", "네", "다섯"];

const vars = (id) => ({ "--c": ITEM[id].color, "--t": ITEM[id].text });
const joinSentences = (sentences) => sentences.map((x) => x.text).join("\n");

function Chip({ id }) {
  return (
    <span className={s.chip} style={vars(id)}>
      {ITEM[id].name}
    </span>
  );
}

function Num({ id, n, dim }) {
  if (!n) return null;
  return (
    <span className={`${s.num}${dim ? ` ${s.dim}` : ""}`} style={vars(id)}>
      {n}
    </span>
  );
}

function Bar({ on }) {
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
function WithBlanks({ text, className }) {
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
function MarkedOutput({ output, marks, solid, numOf, focus }) {
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

function LengthLine({ output, solid, numOf, focus }) {
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
    </p>
  );
}

function PromptText({ segments, prompt }) {
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

function SampleBadge({ on }) {
  return on ? <span className={s.badge}>예시 결과</span> : null;
}

function Arrow({ back }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={back ? "M13 8H3M7 4 3 8l4 4" : "M3 8h10M9 4l4 4-4 4"} />
    </svg>
  );
}

function Pending({ phase, failure, onRetry }) {
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
              {failure.message || "결과를 받지 못했어요. 잠시 뒤 다시 시도해 주세요."}
            </p>
          </div>
        ) : (
          <div className={s.pendingHead}>
            <svg className={s.spin} width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="9" stroke="var(--wash)" strokeWidth="3" />
              <path d="M11 2a9 9 0 0 1 9 9" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <p>두 프롬프트를 AI에게 보내는 중이에요</p>
          </div>
        )}
        <ol className={s.phases}>
          {PHASES.map((label, i) => {
            const state = i < phase ? "done" : i > phase ? "wait" : failure ? "fail" : "now";
            return (
              <li key={label}>
                <span className={`${s.dot} ${s[state]}`}>{state === "done" ? "✓" : state === "fail" ? "!" : i + 1}</span>
                <span className={s.phaseText}>
                  <strong>{label}</strong>
                  <span className={state === "fail" ? s.failSub : undefined}>
                    {{ done: "끝났어요", now: "진행 중이에요", fail: "응답이 오지 않았어요", wait: "기다리는 중이에요" }[state]}
                  </span>
                </span>
                {i < PHASES.length - 1 && <span className={`${s.phaseLine}${state === "done" ? ` ${s.done}` : ""}`} aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
        {failure && (
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

export default function ComparePage() {
  const { ready, diagnosis, setDiagnosis } = useAppState();
  const [step, setStep] = useState(1);
  const [focus, setFocus] = useState(null);
  // 실패와 예시 모드는 어느 진단에서 생겼는지(at)와 함께 둔다.
  const [failure, setFailure] = useState(null);
  const [sampleAt, setSampleAt] = useState(null);
  const [copied, setCopied] = useState(false);
  const running = useRef(null);

  // cacheComponents에서는 다른 화면으로 가도 이 화면을 숨겨 두고 상태를 그대로 둔다.
  // 숨겨질 때 단계와 강조를 처음으로 돌리고, 실패와 예시 모드를 풀어 다시 들어오면 새로 받아 오게 한다.
  useLayoutEffect(
    () => () => {
      setStep(1);
      setFocus(null);
      setFailure(null);
      setSampleAt(null);
      setCopied(false);
    },
    [],
  );

  const at = diagnosis?.at;
  const saved = diagnosis?.compare;
  const savedMine = saved?.mine ?? (diagnosis?.guess?.output ? diagnosis.guess : null);
  const phase = !savedMine ? 0 : !saved?.refined ? 1 : !saved?.run ? 2 : 3;
  const sample = Boolean(at && sampleAt === at);
  const fail = failure?.at === at ? failure : null;
  const needsRun = Boolean(ready && diagnosis && diagnosis.missing?.length && phase < 3 && !fail && !sample);

  const start = useCallback(
    async (target) => {
      running.current = target.at;
      const base = { job: target.job, prompt: target.prompt, missing: target.missing };
      const keep = (patch) =>
        setDiagnosis((prev) => (prev?.at === target.at ? { ...prev, ...patch(prev) } : prev));
      let mine = target.compare?.mine ?? (target.guess?.output ? target.guess : null);
      let refined = target.compare?.refined ?? null;
      let current = 0;
      try {
        if (!mine) {
          const r = await api.compareStep("mine", base);
          if (r.source === "rule") return setSampleAt(target.at);
          mine = r;
          // 진단 결과 화면의 "AI는 이렇게 추측했어요"도 같은 결과를 쓰게 한다.
          keep((prev) => ({ guess: prev.guess?.output ? prev.guess : r, compare: { ...prev.compare, mine: r } }));
        }
        current = 1;
        if (!refined) {
          const r = await api.compareStep("refine", base);
          if (r.source === "rule") return setSampleAt(target.at);
          refined = r;
          keep((prev) => ({ compare: { ...prev.compare, mine, refined: r } }));
        }
        current = 2;
        if (!target.compare?.run) {
          const r = await api.compareStep("run", {
            ...base,
            improved: joinSentences(refined.sentences),
            before: mine.output,
          });
          if (r.source === "rule") return setSampleAt(target.at);
          keep((prev) => ({ compare: { ...prev.compare, mine, refined, run: r } }));
        }
      } catch (err) {
        setFailure({ at: target.at, phase: current, message: err?.message });
      } finally {
        running.current = null;
      }
    },
    [setDiagnosis],
  );

  useEffect(() => {
    if (needsRun && running.current !== diagnosis.at) start(diagnosis);
  }, [needsRun, diagnosis, start]);

  if (!ready) return <div className={s.wrap} />;

  if (!diagnosis) {
    return (
      <div className={s.wrap}>
        <div className={s.empty}>
          <h1 className="display">아직 진단 결과가 없어요</h1>
          <p className={s.sub}>프롬프트를 한 번 진단받으면, 다듬은 프롬프트와 결과를 나란히 비교할 수 있어요.</p>
          <Link href="/diagnosis" className={s.primary}>
            진단하러 가기
          </Link>
        </div>
      </div>
    );
  }

  if (!diagnosis.missing?.length) {
    return (
      <div className={s.wrap}>
        <div className={s.empty}>
          <h1 className="display">다섯 요소가 모두 들어 있어요</h1>
          <p className={s.sub}>채울 요소가 없어서 비교할 것이 없어요. 더 어려운 업무로 연습해 보세요.</p>
          <Link href="/diagnosis/result" className={s.primary}>
            진단 결과로
          </Link>
        </div>
      </div>
    );
  }

  const data = sample
    ? COMPARE_SAMPLE
    : {
        job: diagnosis.job,
        prompt: diagnosis.prompt,
        segments: diagnosis.segments,
        found: diagnosis.found,
        missing: diagnosis.missing,
        mine: savedMine,
        refined: saved?.refined,
        run: saved?.run,
      };
  const job = JOB[data.job];
  const done = sample || phase === 3;
  const compared = IDS.filter((id) => data.missing.includes(id));
  const numOf = (id) => compared.indexOf(id) + 1;
  const lit = step === 3 ? focus : null;

  async function copyImproved() {
    try {
      await navigator.clipboard.writeText(joinSentences(data.refined.sentences));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={s.wrap}>
      <Link href="/diagnosis/result" className={s.back}>
        <Arrow back />
        진단 결과로
      </Link>

      <div className={s.top}>
        <div>
          <h1 className={`display ${s.title}`}>같은 일, 두 결과</h1>
          <p className={s.sub}>내가 쓴 프롬프트와 다섯 요소를 채운 프롬프트를 AI에게 똑같이 보내 봤어요.</p>
          {sample && <p className={s.note}>AI가 연결되어 있지 않아 미리 만든 예시 결과를 보여 줘요.</p>}
        </div>
        {job && (
          <div className={s.task}>
            <span className={s.jobChip}>{job.name}</span>
            <span>{job.diagnosisTask}</span>
          </div>
        )}
      </div>

      {!done && <Pending phase={fail ? fail.phase : phase} failure={fail} onRetry={() => setFailure(null)} />}

      {done && (
        <>
          <nav aria-label="비교 단계" className={s.flow}>
            <ol>
              {FLOW.map((label, i) => {
                const n = i + 1;
                const state = n === step ? "current" : n < step ? "done" : "wait";
                return (
                  <li key={label}>
                    <button
                      type="button"
                      className={`${s.flowBtn} ${s[state]}`}
                      aria-current={n === step ? "step" : undefined}
                      onClick={() => setStep(n)}
                    >
                      <span className={s.flowDot}>{state === "done" ? "✓" : n}</span>
                      {label}
                    </button>
                    {n < FLOW.length && <span className={`${s.flowLine}${n < step ? ` ${s.done}` : ""}`} aria-hidden="true" />}
                  </li>
                );
              })}
            </ol>
          </nav>

          {step === 1 && (
            <>
              <div className={s.stepHead}>
                <h2 className="display">먼저, 내 프롬프트로 받은 결과예요</h2>
                <p>점선 밑줄은 정보가 없어서 AI가 마음대로 정한 부분이에요.</p>
              </div>
              <div className={s.row}>
                <section className={`${s.card} ${s.mineCard}`} aria-labelledby="mine-p">
                  <div className={s.cardHead}>
                    <h3 id="mine-p">{sample ? "예시 프롬프트" : "내가 쓴 프롬프트"}</h3>
                    <Bar on={data.found} />
                  </div>
                  <p className={s.prompt}>
                    <PromptText segments={data.segments} prompt={data.prompt} />
                  </p>
                  <div className={s.empties}>
                    <span>비어 있는 요소</span>
                    {compared.map((id) => (
                      <span key={id} className={s.emptyChip}>
                        {ITEM[id].name}
                      </span>
                    ))}
                  </div>
                </section>
                <section className={`${s.card} ${s.mineResult}`} aria-labelledby="mine-r">
                  <div className={s.cardHead}>
                    <h3 id="mine-r">내 프롬프트로 받은 결과</h3>
                    <SampleBadge on={sample} />
                  </div>
                  <MarkedOutput output={data.mine.output} marks={data.mine.guesses} numOf={numOf} />
                  <LengthLine output={data.mine.output} numOf={numOf} />
                  <ul className={s.bubbles}>
                    {compared.map((id) => (
                      <li key={id} style={vars(id)}>
                        <Num id={id} n={numOf(id)} />
                        <span>
                          <Chip id={id} /> {data.mine.guesses.find((g) => g.item === id)?.reason ?? RULE_REASONS[id]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
              <div className={s.nextRow}>
                <button type="button" className={s.cta} onClick={() => setStep(2)}>
                  AI가 다듬은 프롬프트 보기
                  <Arrow />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <div className={s.narrow}>
              <div className={s.stepHead}>
                <h2 className="display">빠진 {COUNT_WORD[compared.length]} 요소를 채웠어요</h2>
                <p>새로 들어간 문장마다 왜 넣었는지 적었어요.</p>
              </div>
              <div className={s.orig}>
                <span className={s.origLabel}>원래 프롬프트</span>
                <span className={s.origText}>
                  <PromptText segments={data.segments} prompt={data.prompt} />
                </span>
                <Bar on={data.found} />
              </div>
              <section className={`${s.card} ${s.fixed}`} aria-labelledby="fixed-p">
                <div className={s.cardHead}>
                  <h3 id="fixed-p">다섯 요소를 채운 프롬프트</h3>
                  <Bar on={data.refined.sentences.map((x) => x.item)} />
                </div>
                <ol className={s.sentences}>
                  {data.refined.sentences.map((x) => (
                    <li key={x.item}>
                      <span className={s.tags}>
                        <Chip id={x.item} />
                        {x.added && <span className={s.added}>추가</span>}
                      </span>
                      <span className={s.sentenceBody}>
                        <span className={`${s.sentence} ${s.mark} ${s.solid}`} style={vars(x.item)}>
                          <WithBlanks text={x.text} />
                        </span>
                        <span className={s.why}>{x.why}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
              <div className={`${s.nextRow} ${s.between}`}>
                <button type="button" className={s.secondary} onClick={() => setStep(1)}>
                  <Arrow back />
                  이전
                </button>
                <button type="button" className={s.cta} onClick={() => setStep(3)}>
                  두 결과 비교하기
                  <Arrow />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <>
              <div className={s.stepHead}>
                <h2 className="display">두 결과를 나란히 볼까요</h2>
                <p>달라진 점을 누르면 양쪽 결과에서 함께 보여요.</p>
              </div>
              <div className={s.compareRow}>
                <section className={`${s.card} ${s.side}`} aria-labelledby="c-mine">
                  <div className={s.cardHead}>
                    <h3 id="c-mine">내 프롬프트로 받은 결과</h3>
                    <SampleBadge on={sample} />
                  </div>
                  <MarkedOutput output={data.mine.output} marks={data.mine.guesses} numOf={numOf} focus={lit} />
                  <LengthLine output={data.mine.output} numOf={numOf} focus={lit} />
                </section>

                <section className={s.diffCol} aria-labelledby="diff-h">
                  <h3 id="diff-h" className="display">
                    무엇이 달라졌나
                  </h3>
                  {data.run.diffs.map((d) => {
                    const on = lit === d.item;
                    return (
                      <button
                        key={d.item}
                        type="button"
                        className={s.diff}
                        style={vars(d.item)}
                        aria-pressed={on}
                        onClick={() => setFocus(on ? null : d.item)}
                      >
                        <span className={s.diffTop}>
                          <Chip id={d.item} />
                          <Num id={d.item} n={numOf(d.item)} />
                        </span>
                        <span className={s.before}>
                          <b>전</b>
                          <span>{d.before}</span>
                        </span>
                        <span className={s.after}>
                          <b>후</b>
                          <span>{d.after}</span>
                        </span>
                      </button>
                    );
                  })}
                  {IDS.filter((id) => data.found.includes(id)).map((id) => (
                    <div key={id} className={s.same}>
                      <Chip id={id} />
                      <span>두 프롬프트 모두 있어요</span>
                      <b>같음</b>
                    </div>
                  ))}
                </section>

                <section className={`${s.card} ${s.side}`} aria-labelledby="c-fixed">
                  <div className={s.cardHead}>
                    <h3 id="c-fixed">다듬은 프롬프트로 받은 결과</h3>
                    <SampleBadge on={sample} />
                  </div>
                  <MarkedOutput output={data.run.output} marks={data.run.marks} solid numOf={numOf} focus={lit} />
                  <LengthLine output={data.run.output} solid numOf={numOf} focus={lit} />
                </section>
              </div>

              <div className={s.ctaBar}>
                <button type="button" className={s.textBtn} onClick={() => setStep(2)}>
                  <Arrow back />
                  이전
                </button>
                <p className="display">이제 내 프롬프트를 직접 고쳐 볼까요?</p>
                <Link href="/prompt" className={s.textLink}>
                  프롬프트 도우미에서 이어서 다듬기
                </Link>
                <button type="button" className={s.secondary} onClick={copyImproved} aria-live="polite">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
                    <rect x="5" y="5" width="8.5" height="8.5" rx="2" />
                    <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
                  </svg>
                  {copied ? "복사했어요" : "다듬은 프롬프트 복사"}
                </button>
                <Link href="/diagnosis/prompt?edit=1" className={`${s.cta} ${s.ctaBig}`}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12.5 2.5l3 3L6 15H3v-3z" />
                  </svg>
                  내 프롬프트 직접 고쳐 보기
                </Link>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
