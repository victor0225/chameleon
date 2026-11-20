"use client";

import { useMemo, useState } from "react";
import * as api from "@/lib/api";
import { analyze } from "@/lib/anatomy";
import { ITEM } from "@/lib/items";
import { AnatomyText, Output, ScaleBar, segVar } from "@/components/Anatomy";
const STAGES = [
  { id: "lecture", name: "강의" },
  { id: "practice", name: "실습" },
  { id: "result", name: "평가·피드백" },
];
export function LessonRunner({ lesson, alreadyDone, isLast, onExit, onAttempt, onNext }) {
  const [stage, setStage] = useState("lecture");
  const [draft, setDraft] = useState("");
  const [grade, setGrade] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wasDone] = useState(alreadyDone);
  const live = useMemo(() => analyze(draft), [draft]);
  const focus = ITEM[lesson.focus];
  const stageIndex = STAGES.findIndex((s) => s.id === stage);
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
    setStage("result");
    window.scrollTo({ top: 0 });
  }
  const metCount = grade?.criteria.filter((c) => c.met).length ?? 0;
  return (
    <section className="card runner" style={segVar(focus.color)} aria-labelledby="lesson-title">
      <div className="runner-top">
        <button type="button" className="btn ghost small" onClick={onExit}>
          ← 레슨 목록
        </button>
        <ol className="stepper" aria-label="진행 단계">
          {STAGES.map((s, i) => (
            <li
              key={s.id}
              className={i === stageIndex ? "active" : i < stageIndex ? "done" : undefined}
              aria-current={i === stageIndex ? "step" : undefined}
            >
              {s.name}
            </li>
          ))}
        </ol>
      </div>

      <div className="runner-title">
        <p className="kicker focus-kicker">
          {lesson.level} · {focus.name} 익히기
        </p>
        <h2 id="lesson-title" className="display">
          {lesson.title}
        </h2>
      </div>

      {stage === "lecture" && (
        <>
          <p className="lecture-point">{lesson.lecture.point}</p>
          <div className="compare">
            <div>
              <p className="label">이렇게 쓰면</p>
              <AnatomyText text={lesson.lecture.bad} />
              <ScaleBar found={analyze(lesson.lecture.bad).found} />
            </div>
            <div>
              <p className="label">이렇게 바꾸면</p>
              <AnatomyText text={lesson.lecture.good} />
              <ScaleBar found={analyze(lesson.lecture.good).found} />
            </div>
          </div>
          <div className="row">
            <button type="button" className="btn" onClick={() => setStage("practice")}>
              실습 문제 풀기
            </button>
          </div>
        </>
      )}

      {stage === "practice" && (
        <>
          <div className="mission">
            <p className="label">실습 문제</p>
            <p className="mission-text">{lesson.mission}</p>
            <p className="label">통과 기준</p>
            <ul className="criteria">
              {lesson.criteria.map((c) => (
                <li key={c.label}>
                  <span className="mark" aria-hidden="true">
                    ·
                  </span>
                  <span>{c.label}</span>
                  <span className="cause" style={segVar(ITEM[c.item].color)}>
                    {ITEM[c.item].name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="field">
            <label htmlFor="attempt">AI에게 보낼 프롬프트</label>
            <textarea
              id="attempt"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="AI에게 말하듯 그대로 써 보세요"
            />
          </div>
          <ScaleBar found={live.found} />
          <div className="row">
            <button type="button" className="btn" onClick={submit} disabled={busy}>
              {busy ? "평가하는 중…" : "제출하고 평가 받기"}
            </button>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
        </>
      )}

      {stage === "result" && grade && (
        <>
          <div className="verdict" aria-live="polite">
            <strong className={grade.passed ? "pass" : "fail"}>{grade.passed ? "통과했어요" : "아직이에요"}</strong>
            <span className="muted">
              {grade.passed
                ? wasDone
                  ? "이미 마친 레슨이라 XP는 그대로예요"
                  : `+${grade.xp} XP`
                : `통과 기준 ${grade.criteria.length}개 중 ${metCount}개 충족`}
            </span>
          </div>

          <div className="grid-2">
            <div className="stack">
              <p className="label">통과 기준</p>
              <ul className="criteria">
                {grade.criteria.map((c, i) => (
                  <li key={c.label} className={c.met ? "met" : "miss"}>
                    <span className="mark" aria-label={c.met ? "충족" : "미충족"}>
                      {c.met ? "✓" : "✗"}
                    </span>
                    <span>{c.label}</span>
                    {!c.met && (
                      <span className="cause" style={segVar(ITEM[c.item].color)}>
                        {/* check로 판정한 기준은 요소가 빠진 게 아니라 쓰는 법을 고칠 일이라 '다시 보기'로 쓴다. */}
                        {lesson.criteria[i]?.check ? `${ITEM[c.item].name} 다시 보기` : `원인: ${ITEM[c.item].name} 빠짐`}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="label">내 프롬프트</p>
              <AnatomyText text={draft} />
              <ScaleBar found={grade.found} />
            </div>
            <div className="stack">
              <p className="label">이 프롬프트로 받은 AI 결과물 (예시)</p>
              <Output text={grade.output} />
            </div>
          </div>

          {grade.coaching ? (
            <>
              <div className="coach" style={segVar(ITEM[grade.coaching.item].color)}>
                <p className="label">코치의 질문</p>
                <q>{grade.coaching.question}</q>
                <p className="small muted">정답을 대신 써 드리지 않아요. 이 질문에 답하듯 프롬프트를 고쳐 보세요.</p>
                <div className="row">
                  <button type="button" className="btn" onClick={() => setStage("practice")}>
                    고쳐서 다시 내기
                  </button>
                </div>
              </div>
              <p className="locked-box">모범 프롬프트는 통과하면 열려요.</p>
            </>
          ) : (
            <div className="coach">
              <p className="label">모범 프롬프트</p>
              <AnatomyText text={lesson.model} />
              <div className="row">
                <button type="button" className="btn" onClick={onNext}>
                  {isLast ? "레슨 목록으로" : "다음 레슨"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
