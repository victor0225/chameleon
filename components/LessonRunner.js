"use client";

// 미션 한 개를 배우기 → 해 보기 → 피드백 세 단계로 진행한다. 디자인 캔버스 '화면 전체 점검'의 D1(배우기), D3(해 보기), D4·D7(피드백).
// 미션 kind가 prompt가 아니면 해 보기·피드백 칸은 components/Practice.js가 그린다(D5·D8·D9·D10·D13·D14).
// 모든 미션이 같은 틀을 쓴다: 위 칸(뒤로·단계·과정·미션 번호), 해 보기 위 첫 점수 칩, 내가 하는 칸 왼쪽·자료와 기준 오른쪽, 공통 피드백 머리 칸.
import { useMemo, useRef, useState } from "react";
import * as api from "@/lib/api";
import { analyze } from "@/lib/anatomy";
import { Output } from "@/components/Anatomy";
import { ArrowIcon, BackIcon, emptyLine, ExampleChip, NO_AI_TEXT, RuleChip, Steps } from "./Common";
import {
  isMaterialPiece,
  CoachCard,
  CriteriaDots,
  CriteriaResult,
  criteriaDesc,
  ElementChip,
  FeedbackHead,
  foundOf,
  marksOf,
  MiniBar,
  PencilIcon,
  PromptEditor,
  PromptText,
  TodoCard,
} from "./lessonBits";
import { Tour } from "./Tour";
import { MaterialPanel, PracticeChoose, PracticeFile, PracticeSort, PracticeSpot } from "./Practice";
import s from "./lesson.module.css";

export { ElementChip, itemVars, marksOf, MiniBar, PromptText } from "./lessonBits";

const STAGES = [
  { id: "lecture", name: "배우기" },
  { id: "practice", name: "해 보기" },
  { id: "result", name: "피드백" },
];
const BLANK_NAMES = /\{\{([^{}\n]+)\}\}/g;

// 밑줄은 그 미션 요소(focus) 색을 먼저 쓰고, 막대는 글 전체에 들어 있는 요소 수를 센다.
function ExampleCard({ kind, text, marks, output, note, focus }) {
  const good = kind === "good";
  const list = marks ?? marksOf(text, focus);
  const found = marks ? foundOf(marks) : analyze(text).found;
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
        <MiniBar found={found} />
      </div>
      <PromptText text={text} marks={list} />
      {list.some(isMaterialPiece) && (
        <p className={s.note}>
          <ElementChip id="context" /> 초록 칸 = AI가 읽을 자료
        </p>
      )}
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

// 결과물 카드: 예시 결과면 '예시 결과' 칩과 안내 한 줄을 붙인다(공통 칸 ④).
export function OutputCard({ title, example, note, children, chip }) {
  return (
    <section className={s.card} aria-labelledby="out">
      <div className={s.cardHead}>
        <h2 id="out" className={s.smallTitle}>
          {title}
        </h2>
        {example && <ExampleChip />}
        {chip && <span className={s.headEnd}>{chip}</span>}
      </div>
      <div className={s.outWrap}>{children}</div>
      {(example || note) && <p className={s.note}>{note ?? NO_AI_TEXT}</p>}
    </section>
  );
}

const PRACTICE = { sort: PracticeSort, choose: PracticeChoose, spot: PracticeSpot, file: PracticeFile };

// backLabel: 왼쪽 위 돌아가기 글, metaLabel: 제목 위 과정 글(없으면 "과정 1 · 초급"), nextLabel: 통과 뒤 버튼 글
// tried: 이 미션을 전에 풀어 본 적이 있음(처음 푼 점수는 이미 정해짐) · onOpenCourse(id): 다른 과정으로 가기
export function LessonRunner({
  lesson,
  position,
  total,
  alreadyDone,
  tried = false,
  isLast,
  onExit,
  onAttempt,
  onNext,
  backLabel = "과정 1 · 프롬프트 작성",
  metaLabel,
  nextLabel,
  onOpenCourse,
}) {
  const kind = lesson.kind ?? "prompt";
  const Practice = PRACTICE[kind];
  const [stage, setStage] = useState("lecture");
  const [draft, setDraft] = useState("");
  const [grade, setGrade] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wasDone] = useState(alreadyDone);
  const [wasTried] = useState(tried);
  // 이 화면에서 채점받은 횟수. 두 번째부터는 다시 푼 점수다.
  const [tries, setTries] = useState(0);
  const inputRef = useRef(null);
  const live = useMemo(() => analyze(draft), [draft]);
  const blanks = useMemo(() => [...new Set([...draft.matchAll(BLANK_NAMES)].map((m) => m[1].trim()))], [draft]);
  const stageIndex = STAGES.findIndex((st) => st.id === stage);
  const template = lesson.practice?.template;
  const { lecture } = lesson;
  // 해 보기 칩: 이미 한 번 채점받았으면 이번 점수는 랭킹에 들어가지 않는다. 피드백 머리 칸: 지금 본 점수가 첫 점수인지.
  const retryNext = wasTried || tries > 0;
  const retryShown = wasTried || tries > 1;

  function go(next) {
    setStage(next);
    window.scrollTo({ top: 0 });
  }

  // extra: { answer }(sort·choose·spot) 또는 { prompt, files, sample }(file). 실패하면 오류를 돌려줘 부른 쪽이 다시 시도할 수 있게 한다.
  async function submit(extra) {
    const prompt = kind === "prompt" ? draft : extra?.prompt;
    if ((kind === "prompt" || kind === "file") && !prompt?.trim()) {
      setError("프롬프트를 써야 평가 가능");
      return null;
    }
    setError("");
    setBusy(true);
    let result;
    try {
      const options = extra?.answer !== undefined ? { answer: extra.answer } : extra?.files ? { files: extra.files, sample: extra.sample } : {};
      result = await api.gradeAttempt(lesson.id, prompt, options);
    } catch (err) {
      setError(err?.message || "평가하지 못함. 잠시 뒤 다시 시도.");
      return err;
    } finally {
      setBusy(false);
    }
    setGrade(result);
    setTries((n) => n + 1);
    onAttempt(result);
    go("result");
    return null;
  }

  const runner = {
    stage,
    grade,
    busy,
    error,
    wasDone,
    retryNext,
    retryShown,
    submit,
    setError,
    go,
    onNext,
    nextLabel: nextLabel ?? (isLast ? "미션 목록으로" : "다음 미션"),
    onOpenCourse,
  };

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
  // 미리 만든 결과(키 없이 채점, noRun 미션)면 '예시 결과' 칩. noRun 미션(tool2)은 왜 예시인지 미션 안내를 붙인다.
  const example = Boolean(lesson.noRun || grade?.source === "rule");
  const outputNote = lesson.noRun ? lesson.outputs?.weakNote : undefined;
  const nextAction = { label: runner.nextLabel, onClick: onNext, icon: <ArrowIcon /> };
  const retryAction = { label: "다시 해 보기", onClick: () => go("practice"), icon: <PencilIcon /> };

  return (
    <div className={`${s.wrap} ${stage === "result" ? s.result : ""}`}>
      {/* 화면 안내(작업 J): 미션을 처음 열 때, 피드백을 처음 볼 때 */}
      <Tour id="mission" when={stage !== "result"} />
      <Tour id="feedback" when={stage === "result" && Boolean(grade)} />
      <div className={s.top}>
        <button type="button" className={s.back} onClick={onExit}>
          <BackIcon />
          {backLabel}
        </button>
        <Steps
          steps={STAGES.map((st) => st.name)}
          current={stageIndex}
          label="미션 단계"
          tour="mission-steps"
          tours={[undefined, "mission-try"]}
        />
      </div>

      <div>
        <p className={s.meta}>
          <span>{metaLabel ?? `과정 1 · ${lesson.level}`}</span>
          <span aria-hidden="true">·</span>
          <span className={s.mono}>
            미션 {String(position).padStart(2, "0")}/{String(total).padStart(2, "0")}
          </span>
          {lesson.focus && <ElementChip id={lesson.focus} />}
        </p>
        <h1 className={s.title}>{lesson.title}</h1>
      </div>

      {stage === "lecture" && (
        <>
          <section className={`${s.card} ${s.core}`} aria-labelledby="lesson-core" data-tour="mission-learn">
            <h2 id="lesson-core" className={s.smallTitle}>
              핵심
            </h2>
            <p className={s.coreText}>{lecture.point}</p>
            {lecture.points && (
              <ul className={s.bullets}>
                {lecture.points.map((t) => (
                  <li key={t}>
                    <span className={s.dot} aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            )}
            {lecture.note && <p className={s.note}>{lecture.note}</p>}
          </section>

          {lecture.bad && (
            <div className={s.cols}>
              <ExampleCard
                kind="bad"
                text={lecture.bad}
                marks={lecture.badMarks}
                output={lecture.badOutput}
                note={lecture.badNote}
                focus={lesson.focus}
              />
              <ExampleCard
                kind="good"
                text={lecture.good}
                marks={lecture.goodMarks}
                output={lecture.goodOutput}
                note={lecture.goodNote}
                focus={lesson.focus}
              />
            </div>
          )}

          {lecture.extra && (
            <section className={`${s.card} ${s.extra}`} aria-labelledby="lesson-extra">
              <h2 id="lesson-extra" className={s.cardTitle}>
                한 줄 더 하면
              </h2>
              <PromptText text={lecture.extra.marks.map(([t]) => t).join("")} marks={lecture.extra.marks} />
              <span className={s.note}>{lecture.extra.note}</span>
            </section>
          )}

          <section className={`${s.card} ${s.missionGrid}`} aria-labelledby="lesson-mission">
            <div>
              <h2 id="lesson-mission" className={s.smallTitle}>
                할 일
              </h2>
              <p className={s.missionText}>{lesson.mission}</p>
              <h3 className={s.smallTitle} style={{ marginTop: 16 }}>
                통과 기준
              </h3>
              <CriteriaDots criteria={lesson.criteria} />
            </div>
            <div className={s.missionButtons}>
              <button type="button" className={s.primary} onClick={() => go("practice")}>
                해 보러 가기
                <ArrowIcon />
              </button>
              <button type="button" className={s.textBtn} onClick={onExit}>
                목록으로
              </button>
            </div>
          </section>
        </>
      )}

      {/* 배우기 단계로 돌아가도 고른 것을 남기려고, 다른 kind의 해 보기 칸은 숨기기만 한다. */}
      {Practice && (
        <div hidden={stage === "lecture"} className={s.practiceArea}>
          <Practice lesson={lesson} runner={runner} />
        </div>
      )}

      {stage === "practice" && !Practice && (
        <>
          <TodoCard lesson={lesson} />
          <div>
            <RuleChip retry={retryNext} />
          </div>

          <div className={s.work}>
            <section className={`${s.card} ${s.editorCard}`} aria-labelledby="practice-editor">
              <div className={s.cardHead}>
                <h2 id="practice-editor" className={s.cardTitle}>
                  {template ? "내 프롬프트 템플릿" : "내 프롬프트"}
                </h2>
                <span className={s.headEnd}>
                  <span className={s.empty}>{emptyLine(live.found)}</span>
                  <MiniBar found={live.found} />
                </span>
              </div>
              <PromptEditor
                value={draft}
                onChange={setDraft}
                inputRef={inputRef}
                label={template ? "내 프롬프트 템플릿" : "AI에게 보낼 프롬프트"}
              />
              <div className={s.submitRow}>
                <span className={s.note}>입력에 따라 막대가 바뀜</span>
                {template && (
                  <button type="button" className={s.secondary} onClick={insertBlank}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                      <path d="M8 3v10M3 8h10" />
                    </svg>
                    빈칸 넣기
                  </button>
                )}
                <button type="button" className={s.primary} onClick={() => submit()} disabled={busy}>
                  {busy ? "평가하는 중…" : "제출하고 평가 받기"}
                </button>
              </div>
              {error && (
                <p className={s.error} role="alert">
                  {error}
                </p>
              )}
            </section>

            <aside className={s.aside}>
              {lesson.material && <MaterialPanel material={lesson.material} />}
              {template && (
                <section className={`${s.card} ${s.sideCard}`} aria-labelledby="practice-blanks">
                  <h2 id="practice-blanks" className={s.cardTitle}>
                    빈칸 <span className={s.blankCount}>{blanks.length}</span>
                  </h2>
                  {blanks.length === 0 ? (
                    <p className={s.note}>바뀌는 부분을 고르고 빈칸 넣기 누르기</p>
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
                <CriteriaDots criteria={lesson.criteria} />
              </section>
            </aside>
          </div>
        </>
      )}

      {stage === "result" && grade && !Practice && (
        <>
          <FeedbackHead
            passed={grade.passed}
            desc={criteriaDesc(grade)}
            got={metCount}
            total={grade.criteria.length}
            xp={grade.xp}
            wasDone={wasDone}
            retry={retryShown}
            action={grade.passed ? nextAction : retryAction}
          />
          {grade.coaching && <CoachCard question={grade.coaching.question} hint={coachCriterion?.hint} />}

          {grade.passed ? (
            <div className={`${s.work} ${s.passed}`}>
              <div className={s.aside}>
                <section className={s.card} aria-labelledby="mine">
                  <h2 id="mine" className={s.smallTitle}>
                    내 프롬프트
                  </h2>
                  <PromptText text={draft} className={s.small} />
                  <h3 className={s.smallTitle}>채운 통과 기준</h3>
                  <CriteriaResult items={grade.criteria} />
                </section>
                <section className={`${s.card} ${s.model}`} aria-labelledby="model">
                  <h2 id="model" className={s.smallTitle}>
                    모범 프롬프트
                  </h2>
                  <PromptText text={lesson.model} />
                </section>
              </div>
              <OutputCard
                title={lesson.tryAsk ? `이 설정으로 "${lesson.tryAsk}"라고 물으면` : "AI 결과물"}
                example={example}
                note={outputNote}
              >
                <Output text={grade.output} />
              </OutputCard>
            </div>
          ) : (
            <div className={`${s.work} ${s.result}`}>
              <section className={s.card} aria-labelledby="result-criteria">
                <h2 id="result-criteria" className={s.cardTitle}>
                  통과 기준
                </h2>
                <div>
                  <CriteriaResult items={grade.criteria} />
                </div>
                <div className={s.after}>
                  <button type="button" className={s.secondary} onClick={() => go("lecture")}>
                    배우기 다시 보기
                  </button>
                </div>
              </section>
              <div className={s.aside}>
                <section className={s.card} aria-labelledby="mine">
                  <div className={s.cardHead}>
                    <h2 id="mine" className={s.smallTitle}>
                      내 프롬프트
                    </h2>
                    <MiniBar found={grade.found} />
                  </div>
                  <PromptText text={draft} className={s.small} />
                </section>
                <OutputCard
                  title={lesson.tryAsk ? `이 설정으로 "${lesson.tryAsk}"라고 물으면` : "AI 결과물"}
                  example={example}
                  note={outputNote}
                >
                  <Output text={grade.output} />
                </OutputCard>
              </div>
            </div>
          )}

          {grade.passed && (
            <div className={s.after}>
              <button type="button" className={s.secondary} onClick={() => go("lecture")}>
                배우기 다시 보기
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
