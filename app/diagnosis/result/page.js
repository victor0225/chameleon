"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as api from "@/lib/api";
import { AnatomyText, ScaleBar, segVar } from "@/components/Anatomy";
import { useAppState } from "@/components/AppState";
import { AttachedLine, ClipIcon, ExpiredNotice } from "@/components/FileAttach";
import { fileCoaching } from "@/lib/fileSignals";
import { EXPERIENCE, JOB } from "@/data/jobs";
import { ITEM } from "@/lib/items";
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

function GuessSection({ guess, error, onRetry, notice }) {
  let body;
  if (notice) {
    body = notice;
  } else if (error) {
    body = (
      <div className={s.guessError}>
        <p className="error" role="alert">
          {error}
        </p>
        <button type="button" className="btn ghost" onClick={onRetry}>
          다시 시도
        </button>
      </div>
    );
  } else if (!guess) {
    body = (
      <div className="skeleton" role="status" aria-label="AI가 프롬프트를 실행하는 중">
        <span />
        <span />
        <span style={{ width: "62%" }} />
      </div>
    );
  } else if (guess.output) {
    body = (
      <>
        <p className="small muted">
          이 프롬프트를 AI에게 그대로 보냈더니 이런 결과가 나왔어요. 색칠한 부분은 정보가 없어서 AI가 마음대로 정한
          거예요.
        </p>
        <p className={`anatomy ${s.guessOutput}`}>
          {markQuotes(guess.output, guess.guesses).map((part, i) =>
            part.guess ? (
              <mark
                key={i}
                className={`seg ${s.guessMark}`}
                style={segVar(ITEM[part.guess.item].color)}
                title={part.guess.reason}
              >
                {part.text}
                <sup className={s.guessNum}>{part.n}</sup>
              </mark>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
        </p>
        {guess.guesses.length > 0 ? (
          <ol className={s.guessList}>
            {guess.guesses.map((g, i) => (
              <li key={i} style={segVar(ITEM[g.item].color)}>
                <span className={s.guessNum}>{i + 1}</span>
                <div>
                  <strong>{ITEM[g.item].name}</strong> &ldquo;{g.quote}&rdquo;
                  <p>{g.reason}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p>AI가 마음대로 정한 부분이 없어요. 필요한 정보가 프롬프트에 다 들어 있어요.</p>
        )}
      </>
    );
  } else {
    body = (
      <>
        <p className={`small ${s.guessNote}`}>
          <span className={s.exampleTag}>예시 설명</span>
          AI가 실제로 실행한 결과가 아니에요. 빠진 요소 때문에 AI가 마음대로 정하게 되는 것을 보여 줘요.
        </p>
        {guess.guesses.length > 0 ? (
          <ul className={s.guessList}>
            {guess.guesses.map((g, i) => (
              <li key={i} style={segVar(ITEM[g.item].color)}>
                <div>
                  <strong>{ITEM[g.item].name}</strong>
                  <p>{g.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>빠진 요소가 없어서 AI가 마음대로 정할 부분이 거의 없어요.</p>
        )}
      </>
    );
  }

  return (
    <section className={s.section} aria-labelledby="result-guess">
      <h2 id="result-guess">AI는 이렇게 추측했어요</h2>
      {body}
      <div className={`${s.guessActions} ${s.noPrint}`}>
        <Link href="/diagnosis/prompt?edit=1" className="btn">
          고쳐서 다시 진단하기
        </Link>
        <p className="small muted">빠진 요소를 채워 다시 진단하면 AI가 추측하는 부분이 줄어들어요.</p>
      </div>
    </section>
  );
}

export default function DiagnosisResult() {
  const { ready, diagnosis, setDiagnosis } = useAppState();
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
            message: err?.message || "AI가 추측한 부분을 불러오지 못했어요.",
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
      <div className={s.wrap}>
        <Progress step={3} />
      </div>
    );
  }

  if (!diagnosis) {
    return (
      <div className={s.wrap}>
        <div className={s.empty}>
          <h1 className="display">아직 진단 결과가 없어요</h1>
          <p className="muted">질문 두 개에 답하고 프롬프트를 한 번 써 보면 결과가 여기에 나와요.</p>
          <Link href="/diagnosis" className="btn">
            진단하러 가기
          </Link>
        </div>
      </div>
    );
  }

  const { level, found, missing, comment, segments, prompt, job, experience, at, files } = diagnosis;
  const target = JOB[job];
  const fileCoach = fileCoaching({ prompt, files });
  const expired = guessError?.at === at && guessError.expired;

  return (
    <div className={s.wrap}>
      <div className={s.noPrint}>
        <Progress step={3} />
      </div>

      <article className={s.report} aria-labelledby="result-title">
        <header className={s.reportHead}>
          <h1 id="result-title" className="display">
            진단 결과
          </h1>
          <dl className={s.meta}>
            <div>
              <dt>진단 날짜</dt>
              <dd>{formatDate(at)}</dd>
            </div>
            {target && (
              <div>
                <dt>관심 직무</dt>
                <dd>{target.name}</dd>
              </div>
            )}
            {EXPERIENCE[experience] && (
              <div>
                <dt>AI 경험</dt>
                <dd>{EXPERIENCE[experience].title}</dd>
              </div>
            )}
          </dl>
        </header>

        <section className={s.levelRow} aria-label="지금 수준">
          <p className={`display ${s.level}`}>{level}</p>
          <p>
            다섯 요소 중 <strong>{found.length}개</strong>가 들어 있어요.{" "}
            {comment ||
              (missing.length > 0
                ? "아래 요소를 채우는 연습부터 시작해요."
                : "이미 탄탄해요. 더 어려운 업무로 연습해 보세요.")}
          </p>
        </section>

        <section className={s.section} aria-labelledby="result-prompt">
          <h2 id="result-prompt">내가 쓴 프롬프트</h2>
          <AnatomyText text={prompt} segments={segments} className={s.promptBox} />
          <AttachedLine files={files} />
          <ScaleBar found={found} />
        </section>

        {fileCoach && (
          <section className={s.fileCoach} aria-labelledby="file-coach">
            <ClipIcon size={20} />
            <div>
              <h2 id="file-coach">{fileCoach.question}</h2>
              <p className="small muted">{fileCoach.detail}</p>
            </div>
          </section>
        )}

        <GuessSection
          guess={diagnosis.guess}
          error={guessError?.at === at ? guessError.message : ""}
          onRetry={retryGuess}
          notice={expired && <ExpiredNotice onDone={reuploaded} then="다시 올리면 AI 결과를 이어서 볼 수 있어요." />}
        />

        {missing.length > 0 && (
          <section className={s.section} aria-labelledby="result-missing">
            <h2 id="result-missing">채우면 좋은 요소</h2>
            <ul className="missing">
              {missing.map((id) => (
                <li key={id} style={segVar(ITEM[id].color)}>
                  <strong>{ITEM[id].name}</strong>
                  {ITEM[id].hint}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className={`small muted ${s.printOnly}`}>카멜레온에서 받은 프롬프트 진단 결과예요.</p>
      </article>

      {diagnosis.before ? (
        <section className={`${s.compareCta} ${s.noPrint}`} aria-labelledby="compare-cta">
          <div>
            <h2 id="compare-cta">고친 프롬프트로 결과가 어떻게 달라졌을까요?</h2>
            <p className="small muted">고치기 전 프롬프트와 내가 고친 프롬프트로 같은 일을 시켜, 두 결과를 나란히 보여 줘요.</p>
          </div>
          <Link href="/diagnosis/compare" className="btn">
            고치기 전과 결과 비교하기
          </Link>
        </section>
      ) : (
        missing.length > 0 && (
          <section className={`${s.compareCta} ${s.noPrint}`} aria-labelledby="compare-cta">
            <div>
              <h2 id="compare-cta">빠진 요소를 채우면 결과가 어떻게 달라질까요?</h2>
              <p className="small muted">AI가 다듬은 프롬프트로 같은 일을 시켜, 두 결과를 나란히 보여 줘요.</p>
            </div>
            <Link href="/diagnosis/compare" className="btn">
              다듬은 프롬프트와 결과 비교하기
            </Link>
          </section>
        )
      )}

      <div className={`${s.resultActions} ${s.noPrint}`}>
        <div className={s.pdf}>
          <Link href="/diagnosis/report?print=1" target="_blank" className={`btn ${s.cta}`}>
            PDF로 저장하기
          </Link>
          <p className="small muted">새 탭의 저장 창에서 &lsquo;PDF로 저장&rsquo;을 고르세요.</p>
        </div>
        <Link href="/diagnosis" className="btn ghost">
          다시 진단하기
        </Link>
      </div>

      <section className={`${s.next} ${s.noPrint}`} aria-labelledby="next-title">
        <h2 id="next-title" className="display">
          이제 둘 중 하나를 골라 시작하세요
        </h2>
        <div className={s.services}>
          <Link href="/prompt" className={`service-card ${s.service}`}>
            <span className="service-no">서비스 1</span>
            <strong>프롬프트 작성 도우미</strong>
            <span className="flow">목적 입력 → 프롬프트 생성 → 수정 → 완성</span>
          </Link>
          <Link href="/learn" className={`service-card ${s.service}`}>
            <span className="service-no">서비스 2</span>
            <strong>AI 활용 교육</strong>
            <span className="flow">짧은 강의 → 문제 풀이 → 평가·피드백 → 레벨 상승</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
