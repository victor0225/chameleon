"use client";

// 진단 결과(디자인 캔버스 A4): 결과 요약 카드(수준·막대·한 문장·진한 버튼 하나) → 내 프롬프트와 빠진 요소(요소별 한 줄: 빠지면 / 채울 것)
// → 다음에 할 일(과정 카드 셋, 서비스 둘) → 맨 아래 PDF 저장·처음부터 다시 진단.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as api from "@/lib/api";
import { AnatomyText, ScaleBar, segVar } from "@/components/Anatomy";
import { useAppState } from "@/components/AppState";
import { ArrowIcon, ExampleChip } from "@/components/Common";
import { AttachedLine, ClipIcon, ExpiredNotice } from "@/components/FileAttach";
import { ElementChip } from "@/components/LessonRunner";
import { Tour } from "@/components/Tour";
import { courseSignals } from "@/lib/courseSignals";
import { fileCoaching } from "@/lib/fileSignals";
import { COURSE } from "@/data/courses";
import { EXPERIENCE, JOB } from "@/data/jobs";
import { ITEM, ITEMS } from "@/lib/items";
import { josa } from "@/lib/josa";
import { Progress } from "../_components/Progress";
import s from "../diagnosis.module.css";

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

// output 안에서 guesses의 quote가 처음 나오는 자리를 찾아 [{ text, guess?, n? }] 조각으로 나눈다.
// 앞에서 잡은 자리와 겹치면 그 뒤에 다시 나오는 자리를 찾고, 없으면 칠하지 않는다(이유 목록에는 남는다).
function markQuotes(output, guesses) {
  const ranges = [];
  guesses.forEach((guess, i) => {
    if (!guess.quote) return;
    for (let from = 0; ; ) {
      const start = output.indexOf(guess.quote, from);
      if (start < 0) return;
      const end = start + guess.quote.length;
      if (ranges.every((r) => end <= r.start || start >= r.end)) {
        ranges.push({ start, end, guess, n: i + 1 });
        return;
      }
      from = start + 1;
    }
  });
  ranges.sort((a, b) => a.start - b.start);
  const parts = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start > at) parts.push({ text: output.slice(at, r.start) });
    parts.push({ text: output.slice(r.start, r.end), guess: r.guess, n: r.n });
    at = r.end;
  }
  if (at < output.length) parts.push({ text: output.slice(at) });
  return parts;
}

// 빠진 요소(요소별 한 줄): AI가 그 요소 때문에 정한 부분(빠지면)과 채울 것. 실제 AI 결과가 있으면 위에 결과를 두고 번호로 잇는다.
function MissingSection({ guess, missing, error, onRetry, notice }) {
  const real = Boolean(guess?.output);
  const guesses = guess?.guesses ?? [];
  const ids = ITEMS.map((i) => i.id).filter((id) => missing.includes(id) || guesses.some((g) => g.item === id));

  let rows;
  if (notice) rows = notice;
  else if (error) {
    rows = (
      <div className={s.guessError}>
        <p className="error" role="alert">
          {error}
        </p>
        <button type="button" className="btn ghost small" onClick={onRetry}>
          다시 시도
        </button>
      </div>
    );
  } else if (!guess) {
    rows = (
      <div className="skeleton" role="status" aria-label="AI가 프롬프트를 실행하는 중">
        <span />
        <span />
        <span style={{ width: "62%" }} />
      </div>
    );
  } else if (ids.length === 0) {
    rows = <p className={s.note}>빠진 요소 없음. AI가 마음대로 정할 부분이 거의 없음.</p>;
  } else {
    rows = (
      <ul className={s.missList}>
        {ids.map((id) => {
          const mine = guesses.map((g, i) => ({ ...g, n: i + 1 })).filter((g) => g.item === id);
          return (
            <li key={id} className={s.miss}>
              <ElementChip id={id} />
              <div>
                <span className={s.missKey}>빠지면</span>
                {mine.length > 0
                  ? mine.map((g) => (
                      <p key={g.n} style={segVar(ITEM[id].color)}>
                        {real && <span className={s.guessNum}>{g.n}</span>} {g.reason}
                      </p>
                    ))
                  : "이번 결과에서는 눈에 띄지 않음"}
              </div>
              <div>
                <span className={s.missKey}>채울 것</span>
                {ITEM[id].hint}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section aria-labelledby="result-missing" data-tour="result-guess">
      <div className={s.rowHead}>
        <h2 id="result-missing" className={s.h3}>
          {missing.length > 0 ? `빠진 요소 ${missing.length}개` : "AI가 정한 부분"}
        </h2>
        {guess && !real && <ExampleChip>예시 설명 · 실제 AI 실행 결과 아님</ExampleChip>}
      </div>
      {real && (
        <>
          <p className={s.note}>이 프롬프트를 AI에게 그대로 보낸 결과. 색칠한 곳 = 정보가 없어 AI가 정한 부분</p>
          <p className={`anatomy ${s.guessOutput}`}>
            {markQuotes(guess.output, guesses).map((part, i) =>
              part.guess ? (
                <mark key={i} className={`seg ${s.guessMark}`} style={segVar(ITEM[part.guess.item].color)} title={part.guess.reason}>
                  {part.text}
                  <sup className={s.guessNum}>{part.n}</sup>
                </mark>
              ) : (
                <span key={i}>{part.text}</span>
              ),
            )}
          </p>
        </>
      )}
      {rows}
    </section>
  );
}

export default function DiagnosisResult() {
  const { ready, diagnosis, setDiagnosis, survey } = useAppState();
  // 오류는 어느 진단에서 났는지(at)와 함께 둔다. 화면이 숨겨졌다 다시 보일 때 지난 진단의 오류를 띄우지 않는다.
  const [guessError, setGuessError] = useState(null);
  // 같은 진단으로 두 번 부르지 않게 마지막으로 부른 진단의 시각(at)을 기억한다.
  const asked = useRef(null);
  const needsGuess = Boolean(ready && diagnosis && !diagnosis.guess);

  // 진단 결과에 guess가 없으면 한 번 불러서 그 진단에 붙여 저장한다.
  const loadGuess = useCallback(
    (target) => {
      asked.current = target.at;
      api
        .guessAssumptions({ job: target.job, prompt: target.prompt, files: target.files })
        .then((guess) => setDiagnosis((prev) => (prev?.at === target.at ? { ...prev, guess } : prev)))
        .catch((err) =>
          setGuessError({
            at: target.at,
            expired: Boolean(err?.expired),
            message: err?.message || "AI가 추측한 부분을 불러오지 못함.",
          }),
        );
    },
    [setDiagnosis],
  );

  useEffect(() => {
    if (needsGuess && asked.current !== diagnosis.at) loadGuess(diagnosis);
  }, [needsGuess, diagnosis, loadGuess]);

  function retryGuess() {
    setGuessError(null);
    loadGuess(diagnosis);
  }

  // 첨부 파일이 만료돼 다시 올렸으면 그 파일로 바꿔 저장하고 다시 부른다.
  function reuploaded(files) {
    const next = { ...diagnosis, files };
    setDiagnosis((prev) => (prev?.at === diagnosis.at ? { ...prev, files } : prev));
    setGuessError(null);
    loadGuess(next);
  }

  if (!ready) {
    return (
      <div className={`${s.wrap} ${s.wide}`}>
        <Progress step={3} />
      </div>
    );
  }

  if (!diagnosis) {
    return (
      <div className={s.wrap}>
        <div className={s.empty}>
          <h1 className="display">아직 진단 결과 없음</h1>
          <p className="muted">질문 두 개에 답하고 프롬프트를 한 번 쓰면 결과 표시</p>
          <Link href="/diagnosis" className="btn">
            진단하러 가기
          </Link>
        </div>
      </div>
    );
  }

  const { level, found, missing, comment, segments, prompt, job, experience, at, files, source } = diagnosis;
  const target = JOB[job];
  const fileCoach = fileCoaching({ prompt, files });
  const expired = guessError?.at === at && guessError.expired;
  const missingNames = ITEMS.filter((i) => missing.includes(i.id)).map((i) => i.name);
  const canCompare = Boolean(diagnosis.before) || missing.length > 0;
  const metaLine = ["진단 결과", formatDate(at), target?.name, EXPERIENCE[experience]?.title].filter(Boolean).join(" · ");

  return (
    <div className={`${s.wrap} ${s.wide}`}>
      <Tour id="result" />
      <div className={s.noPrint}>
        <Progress step={3} />
      </div>

      <section className={`${s.surveyCard} ${s.summary}`} aria-labelledby="result-title">
        <div className={s.summaryTop}>
          <div>
            <p className={s.note}>{metaLine}</p>
            <h1 id="result-title" className={`display ${s.level}`}>
              {level}
            </h1>
          </div>
          <div className={s.summaryBar}>
            <ScaleBar found={found} />
          </div>
        </div>
        <p className={s.summaryLine}>
          다섯 요소 중 <b>{found.length}개</b> 포함.{" "}
          {missingNames.length > 0 ? (
            <>
              <b>{missingNames.join(" · ")}</b>
              {josa(missingNames.at(-1), ["을", "를"]).slice(missingNames.at(-1).length)} 채우면 결과가 더 정확해짐.
            </>
          ) : (
            "더 복잡한 업무로 연습하기."
          )}
        </p>
        {source === "ai" && comment && <p className={s.note}>{comment}</p>}
        <div className={`${s.summaryActions} ${s.noPrint}`}>
          {canCompare && (
            <Link href="/diagnosis/compare" className={`btn ${s.bigBtn}`} data-tour="result-compare">
              {diagnosis.before ? "고치기 전과 결과 비교하기" : "다듬은 프롬프트와 결과 비교하기"}
              <ArrowIcon />
            </Link>
          )}
          <Link href="/diagnosis/prompt?edit=1" className={`btn ${canCompare ? "ghost" : ""} ${s.bigBtn}`}>
            고쳐서 다시 진단하기
          </Link>
        </div>
      </section>

      <section className={`${s.surveyCard} ${s.mineCard}`} aria-labelledby="result-prompt">
        <div data-tour="result-prompt">
          <h2 id="result-prompt" className={s.h3}>
            내가 쓴 프롬프트
          </h2>
          <AnatomyText text={prompt} segments={segments} className={s.promptText} />
          <AttachedLine files={files} />
        </div>
        {fileCoach && (
          <div className={s.fileCoach}>
            <ClipIcon size={20} />
            <div>
              <h3>{fileCoach.question}</h3>
              <p className={s.note}>{fileCoach.detail}</p>
            </div>
          </div>
        )}
        <MissingSection
          guess={diagnosis.guess}
          missing={missing}
          error={guessError?.at === at ? guessError.message : ""}
          onRetry={retryGuess}
          notice={expired && <ExpiredNotice onDone={reuploaded} then="다시 올리면 AI 결과 이어서 보기 가능." />}
        />
        <p className={`small muted ${s.printOnly}`}>카멜레온 프롬프트 진단 결과</p>
      </section>

      <NextSteps diagnosis={diagnosis} survey={survey} />

      <div className={`${s.bottomRow} ${s.noPrint}`}>
        <Link href="/diagnosis/report?print=1" target="_blank" className="btn ghost small">
          PDF로 저장하기
        </Link>
        <span className={s.note}>새 탭 저장 창에서 &lsquo;PDF로 저장&rsquo; 선택</span>
        <Link href="/diagnosis" className={`link ${s.right}`}>
          처음부터 다시 진단하기
        </Link>
      </div>
    </div>
  );
}

// 다음에 할 일: 진단에서 보인 신호로 팀 규칙(lib/courseSignals.js)이 고른 과정 카드와 두 서비스.
// 비교 화면의 "다음에 배울 과정 보기"가 #next-course로 여기를 연다.
function NextSteps({ diagnosis, survey }) {
  const picks = courseSignals({ diagnosis, survey });
  const ref = useRef(null);
  const shown = picks.length > 0;
  // 저장된 진단을 읽은 뒤에 그려져서, 주소의 #next-course로 브라우저가 스스로 내려오지 못한다. 그린 뒤에 내려 준다.
  useEffect(() => {
    if (shown && window.location.hash === "#next-course") ref.current?.scrollIntoView({ block: "start" });
  }, [shown]);
  return (
    <section ref={ref} className={`${s.nextSteps} ${s.noPrint}`} aria-labelledby="next-course" data-tour="result-next">
      <h2 id="next-course" className={s.h2}>
        다음에 할 일
      </h2>
      {shown && (
        <>
          <p className={s.note}>이번 진단 결과로 고름</p>
          <div className={s.courses}>
            {picks.map(({ course, reason }) => (
              <Link key={course} href={`/learn?course=${course}`} className={s.nx}>
                <span className={s.note}>과정 {COURSE[course].no}</span>
                <strong>{COURSE[course].title}</strong>
                <span className={s.nxWhy}>{reason}</span>
                <span className={s.nxGo}>과정 보기 →</span>
              </Link>
            ))}
          </div>
        </>
      )}
      <div className={s.services}>
        <Link href="/prompt" className={`${s.nx} ${s.nxRow}`}>
          <span className={s.note}>서비스 1</span>
          <strong>프롬프트 작성 도우미</strong>
          <span className={`${s.note} ${s.right}`}>목적 입력 → 생성 → 수정 → 완성</span>
        </Link>
        <Link href="/learn" className={`${s.nx} ${s.nxRow}`}>
          <span className={s.note}>서비스 2</span>
          <strong>AI 활용 교육</strong>
          <span className={`${s.note} ${s.right}`}>배우기 → 해 보기 → 피드백</span>
        </Link>
      </div>
    </section>
  );
}
