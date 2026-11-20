"use client";

// 결과 비교의 "내가 고친 프롬프트" 모드. 고쳐서 다시 진단해 diagnosis.before가 있으면 이 모드로 연다.
//   1단계 고치기 전 결과: before.guess 결과물을 다시 쓴다. 없으면 /api/compare mine을 before.prompt로 부른다.
//   2단계 내가 고친 프롬프트: 새 진단의 밑줄과, 고치기 전보다 늘어난 요소("새로 채움").
//   3단계 두 결과 비교: run을 { prompt: before.prompt, missing: before.missing, improved: 새 프롬프트, before: 처음 결과물 }로 부른다.
// 받은 결과는 diagnosis.before.guess와 diagnosis.compareBefore에 붙여 저장한다.
// 키가 없으면 결과물 없이, 비어 있던 요소마다 AI가 무엇을 마음대로 정하게 되는지와 프롬프트끼리의 차이를 보여 준다.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import * as api from "@/lib/api";
import { useAppState } from "@/components/AppState";
import { ITEM } from "@/lib/items";
import { RULE_REASONS } from "@/lib/server/guess";
import s from "./compare.module.css";
import {
  Arrow,
  Bar,
  Chip,
  FilesLine,
  FlowNav,
  IDS,
  LengthLine,
  MarkedOutput,
  Num,
  Pending,
  PromptText,
  vars,
} from "./parts";

const FLOW = ["고치기 전 결과", "내가 고친 프롬프트", "두 결과 비교"];
const PHASES = ["고치기 전 프롬프트 실행", "내가 고친 프롬프트 실행"];

const dateOf = (at) => new Date(at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

export function SelfCompare({ onAiCompare }) {
  const { diagnosis, setDiagnosis } = useAppState();
  const [step, setStep] = useState(1);
  const [focus, setFocus] = useState(null);
  const [failure, setFailure] = useState(null);
  const [ruleAt, setRuleAt] = useState(null);
  const running = useRef(null);

  // 숨겨질 때 단계와 강조를 처음으로 돌리고, 실패와 규칙 모드를 풀어 다시 들어오면 새로 받아 오게 한다.
  useLayoutEffect(
    () => () => {
      setStep(1);
      setFocus(null);
      setFailure(null);
      setRuleAt(null);
    },
    [],
  );

  const before = diagnosis.before;
  const at = diagnosis.at;
  const mineOut = before.guess?.output ? before.guess : null;
  const run = diagnosis.compareBefore?.run ?? null;
  const phase = !mineOut ? 0 : !run ? 1 : 2;
  const rule = ruleAt === at || (before.guess && !before.guess.output && before.guess.source === "rule");
  const fail = failure?.at === at ? failure : null;
  const needsRun = Boolean(phase < 2 && !fail && !rule);

  const start = useCallback(
    async (target) => {
      running.current = target.at;
      const b = target.before;
      const keep = (patch) => setDiagnosis((prev) => (prev?.at === target.at ? { ...prev, ...patch(prev) } : prev));
      let mine = b.guess?.output ? b.guess : null;
      let current = 0;
      try {
        if (!mine) {
          const r = await api.compareStep("mine", { job: target.job, prompt: b.prompt, missing: b.missing, files: b.files });
          if (r.source === "rule") return setRuleAt(target.at);
          mine = r;
          keep((prev) => ({ before: { ...prev.before, guess: r } }));
        }
        current = 1;
        if (!target.compareBefore?.run) {
          const r = await api.compareStep("run", {
            job: target.job,
            prompt: b.prompt,
            missing: b.missing,
            improved: target.prompt,
            before: mine.output,
            files: target.files,
          });
          if (r.source === "rule") return setRuleAt(target.at);
          keep(() => ({ compareBefore: { run: r } }));
        }
      } catch (err) {
        setFailure({ at: target.at, phase: current, message: err?.message, expired: Boolean(err?.expired) });
      } finally {
        running.current = null;
      }
    },
    [setDiagnosis],
  );

  useEffect(() => {
    if (needsRun && running.current !== diagnosis.at) start(diagnosis);
  }, [needsRun, diagnosis, start]);

  const done = rule || phase === 2;
  const compared = IDS.filter((id) => before.missing.includes(id));
  const numOf = (id) => compared.indexOf(id) + 1;
  const added = IDS.filter((id) => diagnosis.found.includes(id) && !before.found.includes(id));
  const lit = step === 3 && !rule ? focus : null;

  // 키가 없을 때 "무엇이 달라졌나": 비어 있던 요소가 채워졌는지로만 말한다.
  const ruleDiffs = compared.map((id) => ({
    item: id,
    before: "비어 있어 AI가 마음대로 정함",
    after: diagnosis.found.includes(id) ? "내가 정함" : "아직 비어 있음",
  }));
  const diffs = rule ? ruleDiffs : (run?.diffs ?? []);

  return (
    <div className={s.wrap}>
      <Link href="/diagnosis/result" className={s.back}>
        <Arrow back />
        진단 결과로
      </Link>

      <div className={s.top}>
        <div>
          <h1 className={`display ${s.title}`}>같은 일, 두 결과</h1>
          <p className={s.sub}>고치기 전 프롬프트와 내가 고친 프롬프트를 AI에게 똑같이 보냄</p>
          {rule && (
            <p className={s.note}>
              AI 미연결 · 결과물 없이 두 프롬프트에서 채워진 요소만 비교
            </p>
          )}
        </div>
        {diagnosis.missing?.length > 0 && (
          <button type="button" className={s.textLink} onClick={onAiCompare}>
            AI가 다듬은 프롬프트와도 비교해 보기
            <Arrow />
          </button>
        )}
      </div>

      {!done && (
        <Pending
          phase={fail ? fail.phase : phase}
          failure={fail}
          phases={PHASES}
          onRetry={() => setFailure(null)}
          onReupload={(files) => {
            setDiagnosis((prev) => (prev?.at === at ? { ...prev, files, before: { ...prev.before, files } } : prev));
            setFailure(null);
          }}
        />
      )}

      {done && (
        <>
          <FlowNav labels={FLOW} step={step} onStep={setStep} />

          {step === 1 && (
            <>
              <div className={s.stepHead}>
                <h2 className="display">고치기 전 프롬프트로 받은 결과</h2>
                <p>
                  {rule
                    ? "비어 있던 요소마다 AI가 마음대로 정하게 되는 것"
                    : "점선 밑줄 = 정보가 없어 AI가 임의로 정한 부분"}
                </p>
              </div>
              <div className={s.row}>
                <section className={`${s.card} ${s.mineCard}`} aria-labelledby="before-p">
                  <div className={s.cardHead}>
                    <h3 id="before-p">고치기 전 · {dateOf(before.at)} 진단</h3>
                    <Bar on={before.found} />
                  </div>
                  <p className={s.prompt}>
                    <PromptText segments={before.segments} prompt={before.prompt} />
                  </p>
                  <FilesLine files={before.files} />
                  {compared.length > 0 && (
                    <div className={s.empties}>
                      <span>비어 있던 요소</span>
                      {compared.map((id) => (
                        <span key={id} className={s.emptyChip}>
                          {ITEM[id].name}
                        </span>
                      ))}
                    </div>
                  )}
                </section>
                <section className={`${s.card} ${s.mineResult}`} aria-labelledby="before-r">
                  <div className={s.cardHead}>
                    <h3 id="before-r">고치기 전 결과</h3>
                  </div>
                  {mineOut && (
                    <>
                      <MarkedOutput output={mineOut.output} marks={mineOut.guesses} numOf={numOf} />
                      <LengthLine output={mineOut.output} numOf={numOf} />
                    </>
                  )}
                  <ul className={s.bubbles}>
                    {compared.map((id) => (
                      <li key={id} style={vars(id)}>
                        <Num id={id} n={numOf(id)} />
                        <span>
                          <Chip id={id} /> {mineOut?.guesses.find((g) => g.item === id)?.reason ?? RULE_REASONS[id]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
              <div className={s.nextRow}>
                <button type="button" className={s.cta} onClick={() => setStep(2)}>
                  내가 고친 프롬프트 보기
                  <Arrow />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <div className={s.narrow}>
              <div className={s.stepHead}>
                <h2 className="display">
                  {added.length > 0 ? `요소 ${added.length}개 새로 채움` : "새로 채운 요소 없음"}
                </h2>
                <p>{added.length > 0 ? "고치기 전에는 비어 있던 요소" : "고친 프롬프트도 같은 요소 포함"}</p>
              </div>
              <div className={s.orig}>
                <span className={s.origLabel}>고치기 전</span>
                <span className={s.origText}>
                  <PromptText segments={before.segments} prompt={before.prompt} />
                </span>
                <Bar on={before.found} />
              </div>
              <section className={`${s.card} ${s.fixed}`} aria-labelledby="mine-fixed">
                <div className={s.cardHead}>
                  <h3 id="mine-fixed">
                    내가 고친 프롬프트
                    {added.length > 0 && (
                      <span className={s.newCount} data-tour="compare-new">
                        새로 채움 {added.length}
                      </span>
                    )}
                  </h3>
                  <Bar on={diagnosis.found} />
                </div>
                <p className={s.prompt}>
                  <PromptText segments={diagnosis.segments} prompt={diagnosis.prompt} />
                </p>
                <FilesLine files={diagnosis.files} />
                <ul className={s.filled} aria-label="다섯 요소">
                  {IDS.map((id) => (
                    <li key={id} className={diagnosis.found.includes(id) ? undefined : s.notFilled}>
                      <Chip id={id} />
                      {added.includes(id) && <span className={s.added}>새로</span>}
                      {!diagnosis.found.includes(id) && <span>아직 비어 있음</span>}
                    </li>
                  ))}
                </ul>
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
                <h2 className="display">{rule ? "두 프롬프트 나란히 보기" : "두 결과 나란히 보기"}</h2>
                <p>{rule ? "비어 있던 요소가 채워졌는지 표시" : "달라진 점을 누르면 양쪽 결과에 함께 표시"}</p>
              </div>
              <div className={s.compareRow}>
                <section className={`${s.card} ${s.side}`} aria-labelledby="c-before">
                  <div className={s.cardHead}>
                    <h3 id="c-before">고치기 전 · {dateOf(before.at)} 진단</h3>
                  </div>
                  {rule ? (
                    <p className={s.prompt}>
                      <PromptText segments={before.segments} prompt={before.prompt} />
                    </p>
                  ) : (
                    <>
                      <MarkedOutput output={mineOut.output} marks={mineOut.guesses} numOf={numOf} focus={lit} />
                      <LengthLine output={mineOut.output} numOf={numOf} focus={lit} />
                    </>
                  )}
                  <FilesLine files={before.files} />
                  <Bar on={before.found} />
                </section>

                <section className={s.diffCol} aria-labelledby="diff-h">
                  <h3 id="diff-h" className="display">
                    무엇이 달라졌나
                  </h3>
                  {diffs.map((d) => {
                    const on = lit === d.item;
                    const body = (
                      <>
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
                      </>
                    );
                    return rule ? (
                      <div key={d.item} className={s.diff} style={vars(d.item)}>
                        {body}
                      </div>
                    ) : (
                      <button
                        key={d.item}
                        type="button"
                        className={s.diff}
                        style={vars(d.item)}
                        aria-pressed={on}
                        onClick={() => setFocus(on ? null : d.item)}
                      >
                        {body}
                      </button>
                    );
                  })}
                  {IDS.filter((id) => before.found.includes(id)).map((id) => (
                    <div key={id} className={s.same}>
                      <Chip id={id} />
                      <span>두 프롬프트 모두 있음</span>
                      <b>같음</b>
                    </div>
                  ))}
                </section>

                <section className={`${s.card} ${s.side}`} aria-labelledby="c-after">
                  <div className={s.cardHead}>
                    <h3 id="c-after">
                      내가 고친 프롬프트
                      {added.length > 0 && (
                      <span className={s.newCount} data-tour="compare-new">
                        새로 채움 {added.length}
                      </span>
                    )}
                    </h3>
                  </div>
                  {rule ? (
                    <p className={s.prompt}>
                      <PromptText segments={diagnosis.segments} prompt={diagnosis.prompt} />
                    </p>
                  ) : (
                    <>
                      <MarkedOutput output={run.output} marks={run.marks} solid numOf={numOf} focus={lit} />
                      <LengthLine output={run.output} solid numOf={numOf} focus={lit} />
                    </>
                  )}
                  <FilesLine files={diagnosis.files} />
                  <Bar on={diagnosis.found} />
                </section>
              </div>

              <div className={s.ctaBar}>
                <button type="button" className={s.textBtn} onClick={() => setStep(2)}>
                  <Arrow back />
                  이전
                </button>
                <p className="display">
                  {added.length > 0
                    ? "고친 만큼 결과가 달라짐. 다음 과정으로."
                    : "아직 비어 있는 요소 있음. 한 번 더 고치기."}
                </p>
                <Link href="/diagnosis/prompt?edit=1" className={s.secondary}>
                  한 번 더 고쳐 보기
                </Link>
                <Link href="/diagnosis/result#next-course" className={`${s.cta} ${s.ctaBig}`}>
                  다음에 배울 과정 보기
                </Link>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
