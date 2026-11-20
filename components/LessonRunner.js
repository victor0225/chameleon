"use client";

// 강의 한 개를 강의 → 실습 → 평가·피드백 세 단계로 진행한다. 디자인 보드 2-D(강의), 2-F(실습), 2-E(평가·피드백).
import { Fragment, useMemo, useRef, useState } from "react";
import * as api from "@/lib/api";
import { analyze } from "@/lib/anatomy";
import { ITEM, ITEMS } from "@/lib/items";
import { Output } from "@/components/Anatomy";
import s from "./lesson.module.css";

const STAGES = [
  { id: "lecture", name: "강의" },
  { id: "practice", name: "실습" },
  { id: "result", name: "평가·피드백" },
];
const BLANK = /(\{\{[^{}\n]+\}\})/;
const BLANK_NAMES = /\{\{([^{}\n]+)\}\}/g;
// 글 전체를 한 글자도 빠뜨리지 않고 문장 조각으로 나눈다. 입력 칸 위에 겹쳐 그릴 때 글자가 빠지면 줄이 어긋난다.
const PIECE = /[^.!?\n]*[.!?]+[ \t]*|[^.!?\n]+|\n+/g;

// 요소 색: 밑줄·막대는 --seg(원래 색), 글자는 --seg-t(글자색을 섞은 색)
export const itemVars = (id) => ({ "--seg": ITEM[id].color, "--seg-t": ITEM[id].text });

// 조각마다 들어 있는 요소 하나(가장 구체적인 것)를 고른다. [[조각, 요소 id | null], ...]
export function marksOf(text) {
  return (text.match(PIECE) ?? []).map((t) => [t, t.trim() ? (analyze(t).found[0] ?? null) : null]);
}

const foundOf = (marks) => ITEMS.map((item) => item.id).filter((id) => marks.some(([, item]) => item === id));

export function ElementChip({ id }) {
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
function PromptEditor({ value, onChange, inputRef, label }) {
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

function Steps({ index }) {
  return (
    <ol className={s.steps} aria-label="강의 진행">
      {STAGES.map((st, i) => (
        <Fragment key={st.id}>
          {i > 0 && <li aria-hidden="true" className={`${s.stepLine} ${i <= index ? s.lineDone : ""}`} />}
          <li
            className={`${s.step} ${i === index ? s.now : i < index ? s.done : ""}`}
            aria-current={i === index ? "step" : undefined}
          >
            {i < index ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2.5 7.5 5.5 10.5 11.5 3.5" />
              </svg>
            ) : (
              <span className={s.mono}>{i + 1}</span>
            )}
            {st.name}
            {i < index && <span className={s.srOnly}> 마침</span>}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}

function ExampleCard({ kind, text, marks, output, note }) {
  const good = kind === "good";
  const list = marks ?? marksOf(text);
  return (
    <section className={s.card} aria-label={good ? "좋은 예" : "나쁜 예"}>
      <div className={s.cardHead}>
        <h2 className={s.cardTitle}>
          {good ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--c-context)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3.5 9.5l3.5 3.5 7.5-8" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--danger)" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" />
            </svg>
          )}
          {good ? "좋은 예" : "나쁜 예"}
        </h2>
        <MiniBar found={foundOf(list)} />
      </div>
      <PromptText text={text} marks={list} />
      {output && (
        <div className={s.outBox}>
          <h3>AI 결과물 예시</h3>
          {Array.isArray(output) ? (
            <ol className={s.outList}>
              {output.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          ) : (
            <p className={s.outText}>{output}</p>
          )}
          {note && <p className={s.note}>{note}</p>}
        </div>
      )}
    </section>
  );
}

function CriteriaTodo({ criteria, plain = false }) {
  return (
    <ul className={`${s.todo} ${plain ? s.plain : ""}`}>
      {criteria.map((c) => (
        <li key={c.label}>
          <span className={s.box} aria-hidden="true" />
          <span className={s.grow}>{c.label}</span>
          <ElementChip id={c.item} />
        </li>
      ))}
    </ul>
  );
}

export function LessonRunner({ lesson, position, total, alreadyDone, isLast, onExit, onAttempt, onNext }) {
  const [stage, setStage] = useState("lecture");
  const [draft, setDraft] = useState("");
  const [grade, setGrade] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wasDone] = useState(alreadyDone);
  const inputRef = useRef(null);
  const live = useMemo(() => analyze(draft), [draft]);
  const blanks = useMemo(() => [...new Set([...draft.matchAll(BLANK_NAMES)].map((m) => m[1].trim()))], [draft]);
  const stageIndex = STAGES.findIndex((st) => st.id === stage);
  const template = lesson.practice?.template;
  const { lecture } = lesson;

  function go(next) {
    setStage(next);
    window.scrollTo({ top: 0 });
  }

  async function submit() {
    if (!draft.trim()) {
      setError("프롬프트를 써야 평가할 수 있어요.");
      return;
    }
    setError("");
    setBusy(true);
    let result;
    try {
      result = await api.gradeAttempt(lesson.id, draft);
    } catch (err) {
      setError(err?.message || "평가하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      return;
    } finally {
      setBusy(false);
    }
    setGrade(result);
    onAttempt(result);
    go("result");
  }

  // 고른 글자가 있으면 그 글자를 빈칸 이름으로, 없으면 커서 자리에 {{빈칸}}을 넣고 이름을 바로 고칠 수 있게 고른다.
  function insertBlank() {
    const el = inputRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? start;
    const picked = draft.slice(start, end).trim();
    const name = picked && !/[{}\n]/.test(picked) ? picked : "빈칸";
    setDraft(`${draft.slice(0, start)}{{${name}}}${draft.slice(end)}`);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + 2, start + 2 + name.length);
    });
  }

  const metCount = grade?.criteria.filter((c) => c.met).length ?? 0;
  const coachCriterion = grade?.coaching ? lesson.criteria.find((c) => c.question === grade.coaching.question) : null;
  const outputNote = grade?.source === "rule" && !grade.passed ? lesson.outputs.weakNote : null;

  return (
    <div className={`${s.wrap} ${stage === "lecture" ? s.narrow : ""} ${stage === "result" ? s.result : ""}`}>
      <div className={s.top}>
        <button type="button" className={s.back} onClick={onExit}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 3 5 8l5 5" />
          </svg>
          AI 활용 교육
        </button>
        <Steps index={stageIndex} />
      </div>

      <div>
        <p className={s.meta}>
          <span className={s.mono}>
            {lesson.level} · {String(position).padStart(2, "0")}/{String(total).padStart(2, "0")}
          </span>
          <ElementChip id={lesson.focus} />
        </p>
        <h1 className={s.title}>{lesson.title}</h1>
      </div>

      {stage === "lecture" && (
        <>
          <section className={`${s.card} ${s.core}`} aria-labelledby="lesson-core">
            <h2 id="lesson-core" className={s.smallTitle}>
              핵심
            </h2>
            <p className={s.coreText}>{lecture.point}</p>
          </section>

          <div className={s.cols}>
            <ExampleCard kind="bad" text={lecture.bad} marks={lecture.badMarks} output={lecture.badOutput} note={lecture.badNote} />
            <ExampleCard kind="good" text={lecture.good} marks={lecture.goodMarks} output={lecture.goodOutput} note={lecture.goodNote} />
          </div>

          {lecture.extra && (
            <section className={`${s.card} ${s.extra}`} aria-labelledby="lesson-extra">
              <h2 id="lesson-extra" className={s.cardTitle}>
                한 줄 더 하면
              </h2>
              <PromptText text={lecture.extra.marks.map(([t]) => t).join("")} marks={lecture.extra.marks} />
              <span className={s.note}>{lecture.extra.note}</span>
            </section>
          )}

          <section className={`${s.card} ${s.mission}`} aria-labelledby="lesson-mission">
            <div>
              <h2 id="lesson-mission" className={s.missionTitle}>
                미션
              </h2>
              <p className={s.missionText}>{lesson.mission}</p>
            </div>
            <div className={s.stack}>
              <h3 className={s.smallTitle}>통과 기준</h3>
              <CriteriaTodo criteria={lesson.criteria} />
            </div>
            <div className={s.actions}>
              <button type="button" className={s.primary} onClick={() => go("practice")}>
                실습하러 가기
              </button>
              <button type="button" className={s.secondary} onClick={onExit}>
                목록으로
              </button>
            </div>
          </section>
        </>
      )}

      {stage === "practice" && (
        <>
          <section className={`${s.card} ${s.missionCard}`} aria-labelledby="practice-mission">
            <h2 id="practice-mission" className={s.smallTitle}>
              미션
            </h2>
            <p>{lesson.mission}</p>
          </section>

          <div className={s.split}>
            <section className={`${s.card} ${s.editorCard} ${s.main}`} aria-labelledby="practice-editor">
              <div className={s.cardHead}>
                <h2 id="practice-editor" className={s.cardTitle}>
                  {template ? "내 프롬프트 템플릿" : "내 프롬프트"}
                </h2>
                <MiniBar found={live.found} />
              </div>
              <PromptEditor
                value={draft}
                onChange={setDraft}
                inputRef={inputRef}
                label={template ? "내 프롬프트 템플릿" : "AI에게 보낼 프롬프트"}
              />
              <div className={s.empties}>
                {live.found.length === ITEMS.length ? (
                  <span>다섯 요소가 모두 들어 있어요</span>
                ) : (
                  <>
                    <span>비어 있는 요소</span>
                    {ITEMS.filter((item) => !live.found.includes(item.id)).map((item) => (
                      <span key={item.id} className={s.dashChip}>
                        {item.name}
                      </span>
                    ))}
                  </>
                )}
                <span className={s.pushRight}>쓰는 대로 막대가 바뀌어요</span>
              </div>
              <div className={s.actions}>
                <button type="button" className={s.primary} onClick={submit} disabled={busy}>
                  {busy ? "평가하는 중…" : "제출하고 평가 받기"}
                </button>
                {template && (
                  <button type="button" className={s.secondary} onClick={insertBlank}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                      <path d="M8 3v10M3 8h10" />
                    </svg>
                    빈칸 넣기
                  </button>
                )}
                {error && (
                  <p className={s.error} role="alert">
                    {error}
                  </p>
                )}
              </div>
            </section>

            <aside className={s.side}>
              {template && (
                <section className={`${s.card} ${s.sideCard}`} aria-labelledby="practice-blanks">
                  <h2 id="practice-blanks" className={s.cardTitle}>
                    빈칸 <span className={s.blankCount}>{blanks.length}</span>
                  </h2>
                  {blanks.length === 0 ? (
                    <p className={s.note}>바뀌는 부분을 고르고 빈칸 넣기를 눌러 보세요.</p>
                  ) : (
                    <ul className={s.blanks}>
                      {blanks.map((name) => (
                        <li key={name}>
                          <span className={s.blankTag}>{`{{${name}}}`}</span>
                          {lesson.practice.blankHints?.[name] && <span className={s.note}>{lesson.practice.blankHints[name]}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
              <section className={`${s.card} ${s.sideCard}`} aria-labelledby="practice-criteria">
                <h2 id="practice-criteria" className={s.cardTitle}>
                  통과 기준
                </h2>
                <CriteriaTodo criteria={lesson.criteria} plain />
              </section>
            </aside>
          </div>
        </>
      )}

      {stage === "result" && grade && (
        <>
          <section className={`${s.card} ${s.verdict}`} aria-live="polite" aria-labelledby="verdict">
            <h2 id="verdict" className={s.verdictTitle}>
              {grade.passed ? "통과했어요" : "아직이에요"}
            </h2>
            <span className={s.meter}>
              <span className={s.meterCells} aria-hidden="true">
                {grade.criteria.map((c, i) => (
                  <span key={c.label} className={i < metCount ? s.on : undefined} />
                ))}
              </span>
              {grade.passed
                ? `${grade.criteria.length}개 모두 충족`
                : `${grade.criteria.length}개 중 ${metCount}개 충족`}
            </span>
            {grade.passed &&
              (wasDone ? (
                <span className={s.note}>이미 마친 강의라 XP는 그대로예요</span>
              ) : (
                <span className={s.xpPill}>+{grade.xp} XP</span>
              ))}
          </section>

          <div className={s.split}>
            <div className={`${s.main} ${s.resultMain}`}>
              <section className={s.card} aria-labelledby="result-criteria">
                <h2 id="result-criteria" className={s.cardTitle}>
                  통과 기준
                </h2>
                <ul className={s.checks}>
                  {grade.criteria.map((c) => (
                    <li key={c.label} className={c.met ? s.met : s.miss}>
                      <span className={s.icon}>
                        {c.met ? (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="충족">
                            <path d="M2.5 7.5 5.5 10.5 11.5 3.5" />
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" role="img" aria-label="미충족">
                            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
                          </svg>
                        )}
                      </span>
                      <span className={s.grow}>{c.label}</span>
                      <ElementChip id={c.item} />
                    </li>
                  ))}
                </ul>
              </section>

              {grade.coaching ? (
                <>
                  <section className={`${s.card} ${s.coach}`} aria-labelledby="coach">
                    <h2 id="coach" className={`${s.cardTitle} ${s.smallTitle}`}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
                      </svg>
                      코칭 질문
                    </h2>
                    <p className={s.question}>{grade.coaching.question}</p>
                    <p className={s.hintText}>
                      {coachCriterion?.hint ?? "정답을 대신 써 드리지 않아요. 이 질문에 답하듯 프롬프트를 고쳐 보세요."}
                    </p>
                  </section>
                  <div className={s.actions}>
                    <button type="button" className={s.primary} onClick={() => go("practice")}>
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12.5 2.5l3 3L6 15H3v-3z" />
                      </svg>
                      다시 써 보기
                    </button>
                    <button type="button" className={s.secondary} onClick={() => go("lecture")}>
                      강의 다시 보기
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <section className={`${s.card} ${s.model}`} aria-labelledby="model">
                    <h2 id="model" className={s.cardTitle}>
                      모범 프롬프트
                    </h2>
                    <PromptText text={lesson.model} />
                  </section>
                  <div className={s.actions}>
                    <button type="button" className={s.primary} onClick={onNext}>
                      {isLast ? "강의 목록으로" : "다음 강의"}
                    </button>
                    <button type="button" className={s.secondary} onClick={() => go("lecture")}>
                      강의 다시 보기
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className={`${s.side} ${s.resultSide}`}>
              <section className={s.card} aria-labelledby="mine">
                <div className={s.cardHead}>
                  <h2 id="mine" className={s.cardTitle}>
                    내 프롬프트
                  </h2>
                  <MiniBar found={grade.found} />
                </div>
                <PromptText text={draft} />
              </section>
              <section className={`${s.card} ${s.outCard}`} aria-labelledby="out">
                <h2 id="out" className={s.cardTitle}>
                  AI 결과물 예시
                </h2>
                <div className={s.outWrap}>
                  <Output text={grade.output} />
                </div>
                {outputNote && <p className={s.note}>{outputNote}</p>}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
