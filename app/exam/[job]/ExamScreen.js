"use client";

// 시험 하나(작업 L). 주소 /exam/<직무>는 그대로 두고 한 화면 안에서 바뀐다.
//   info   응시 전 L3 / 응시 후 L7: 왼쪽 시험 항목(규칙 세 줄, 6문제 표, 시작 버튼), 오른쪽 이 시험 랭킹
//   taking 보는 중 L4·L5, 시간이 끝나면 L8 알림 창(Taking.js)
//   result 다 낸 직후 L6(Result.js). '랭킹 보기'로 info에 돌아와 랭킹 카드로 내려간다.
// 문제는 시작할 때 서버에서 받는다(정답·채점 기준 없이). 기준과 정답은 다 낸 뒤 결과로 받는다.
// 다른 화면에 갔다 와도(이전 화면을 숨겨 두고 상태를 둔다) 보던 시험을 이어서 본다. 남은 시간은 시작 시각으로 세서 그동안 줄어 있다.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAppState } from "@/components/AppState";
import { authHref } from "@/components/AuthLinks";
import { BackIcon, InfoIcon } from "@/components/Common";
import { clock, EXAM_AREAS, EXAM_MAX, examTitle } from "@/data/exams";
import { JOB } from "@/data/jobs";
import { loadBoard, Pills, startExam, submitExam, TimerIcon } from "../parts";
import { RankingCard } from "./RankingCard";
import { Result } from "./Result";
import { Taking } from "./Taking";
import s from "../exam.module.css";

const RULES = [
  "5분 안에 6문제. 시간이 끝나면 푼 데까지 채점",
  "처음 본 점수만 랭킹에 반영. 다시 풀기는 연습",
  "채점 기준은 다 낸 뒤 공개",
];

// 시험 항목 카드 아래쪽: 시작 버튼(응시 전 주 버튼, 응시 후 테두리), 손님은 로그인 안내.
function StartAction({ job, ready, taken, user, login, authChecked, boardLoaded, starting, error, onStart }) {
  if (!ready) return <p className={s.notice}>문제 준비 중</p>;
  if (!authChecked) return null;
  if (!user) {
    if (!login.ready) return <p className={s.notice}>로그인 기능이 켜져 있을 때만 응시 가능</p>;
    return (
      <div className={`${s.infoBox} ${s.infoInCard}`}>
        <InfoIcon size={18} />
        <p>시험은 로그인 후 응시</p>
        <div className={s.infoActions}>
          <Link href={authHref("login", `/exam/${job}`)} className={s.outline}>
            로그인
          </Link>
          <Link href={authHref("signup", `/exam/${job}`)} className={s.outline}>
            가입
          </Link>
        </div>
      </div>
    );
  }
  // 이미 봤는지 모르는 동안에는 버튼 모양이 바뀌지 않게 기다린다.
  if (!boardLoaded) return null;
  return (
    <>
      {taken ? (
        <button type="button" className={`${s.secondary} ${s.wide}`} onClick={onStart} disabled={starting}>
          {starting ? "시작하는 중…" : "다시 풀기 · 연습(점수 안 바뀜)"}
        </button>
      ) : (
        <button type="button" className={`${s.primary} ${s.wide}`} onClick={onStart} disabled={starting}>
          <TimerIcon />
          {starting ? "시작하는 중…" : "시험 시작 · 5분"}
        </button>
      )}
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
    </>
  );
}

export function ExamScreen({ job, ready }) {
  const { user, login, authChecked } = useAppState();
  const title = examTitle(JOB[job].name);
  const [board, setBoard] = useState(null);
  const [boardError, setBoardError] = useState("");
  const [version, setVersion] = useState(0);
  const [phase, setPhase] = useState("info");
  // run: 보고 있는 시험 { token, questions, practice, startedAt, deadline }. 시각은 이 브라우저 시계(ms).
  const [run, setRun] = useState(null);
  const [result, setResult] = useState(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const rankingRef = useRef(null);
  const toRanking = useRef(false);

  // 로그인 상태를 안 뒤, 로그인·로그아웃할 때, 시험을 낸 뒤에 다시 불러온다.
  useEffect(() => {
    if (!authChecked) return;
    let live = true;
    loadBoard(job)
      .then((data) => {
        if (!live) return;
        setBoard(data);
        setBoardError("");
      })
      .catch((e) => live && setBoardError(e.message));
    return () => {
      live = false;
    };
  }, [authChecked, user?.id, job, version]);

  // 결과에서 '랭킹 보기'를 누르면 응시 후 화면의 랭킹 카드로 내려간다.
  useEffect(() => {
    if (phase !== "info" || !toRanking.current) return;
    toRanking.current = false;
    rankingRef.current?.scrollIntoView({ block: "start" });
  }, [phase]);

  async function start() {
    setStarting(true);
    setStartError("");
    try {
      const data = await startExam(job);
      const startedAt = Date.now();
      setRun({
        token: data.token,
        questions: data.questions,
        practice: data.practice,
        startedAt,
        deadline: startedAt + data.seconds * 1000,
      });
      setResult(null);
      setPhase("taking");
      window.scrollTo({ top: 0 });
    } catch (e) {
      setStartError(e.message);
    } finally {
      setStarting(false);
    }
  }

  // 보던 시험을 버리고 응시 전(후) 화면으로. message는 시작 버튼 아래에 보인다.
  function leave(message = "") {
    setRun(null);
    setPhase("info");
    setStartError(message);
  }

  // Taking이 부른다. 답을 내고 채점 결과를 돌려준다. 실패하면 던져서 Taking이 알림 창·버튼 옆에 문장을 보인다.
  // 시작한 지 한 시간이 지났거나 다른 시험의 시작 정보면 다시 내도 안 되니 응시 전 화면으로 돌아가고 null을 돌려준다.
  async function grade(answers) {
    try {
      return await submitExam(job, run.token, answers);
    } catch (e) {
      if (!e.expired && e.status !== 403) throw e;
      leave(e.message);
      return null;
    }
  }

  // 채점 결과 화면으로. 시간이 끝나 미리 낸 결과는 '결과 보기'를 누를 때 보인다.
  function show(data) {
    setResult(data);
    setRun(null);
    setPhase("result");
    setVersion((v) => v + 1);
    window.scrollTo({ top: 0 });
  }

  function showRanking() {
    toRanking.current = true;
    setPhase("info");
  }

  if (phase === "taking" && run) {
    return (
      <div className={s.page}>
        <Taking
          key={run.token}
          title={title}
          questions={run.questions}
          startedAt={run.startedAt}
          deadline={run.deadline}
          practice={run.practice}
          onGrade={grade}
          onShow={show}
          onLeave={() => leave()}
        />
      </div>
    );
  }

  if (phase === "result" && result) {
    return (
      <div className={`${s.page} ${s.pageNarrow}`}>
        <Result title={title} result={result} onRanking={showRanking} />
      </div>
    );
  }

  const me = board?.me ?? null;
  return (
    <div className={s.page}>
      <Link href="/exam" className={s.back}>
        <BackIcon />
        시험 목록
      </Link>
      <h1 className={`display ${s.title} ${s.titleTight}`}>{title}</h1>
      <Pills center />

      <div className={s.layout}>
        <section className={s.card} aria-labelledby="exam-items">
          <h2 id="exam-items" className={s.h3}>
            시험 항목
          </h2>
          <ul className={s.rules}>
            {RULES.map((rule) => (
              <li key={rule}>
                <InfoIcon />
                {rule}
              </li>
            ))}
          </ul>
          <ol className={s.areas}>
            {EXAM_AREAS.map((area, i) => (
              <li key={area.id} className={s.area}>
                <span className={s.areaNo}>{i + 1}</span>
                <b>{area.name}</b>
                <span>{area.way}</span>
                <span className={s.areaScore}>
                  {me ? (
                    <>
                      {me.scores[i] ?? 0}
                      <small> / 100</small>
                    </>
                  ) : (
                    "100점"
                  )}
                </span>
              </li>
            ))}
          </ol>
          {me && (
            <p className={s.totalRow}>
              <b>내 점수</b>
              <span className={s.totalNum}>
                {me.total}
                <small>
                  {" "}
                  / {EXAM_MAX} · {me.rank}위 · {clock(me.seconds)}
                </small>
              </span>
            </p>
          )}
          <div className={s.action}>
            <StartAction
              job={job}
              ready={ready}
              taken={Boolean(me)}
              user={user}
              login={login}
              authChecked={authChecked}
              boardLoaded={Boolean(board || boardError)}
              starting={starting}
              error={startError}
              onStart={start}
            />
          </div>
        </section>

        <RankingCard
          ref={rankingRef}
          board={board}
          error={boardError}
          canJoin={Boolean(user)}
          onReload={() => setVersion((v) => v + 1)}
        />
      </div>
    </div>
  );
}
