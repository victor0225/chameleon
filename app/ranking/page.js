"use client";

// 랭킹: 여섯 부문(= 여섯 과정) 시험 점수의 합으로 순위를 매긴다. 점수 규칙은 lib/scoreboard.js, 데이터는 /api/ranking.
// 위에 내 점수 카드(합계, 부문 막대, 가장 낮은 부문의 과정), 아래에 전체·내 직무 탭과 상위 10명 표.
// 랭킹 참여(별명 정하기)와 빠지기는 이 화면에서만 한다.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAppState } from "@/components/AppState";
import { AuthLinks } from "@/components/AuthLinks";
import { COURSE } from "@/data/courses";
import { JOB } from "@/data/jobs";
import s from "./ranking.module.css";

async function fetchRanking(job) {
  const response = await fetch(job ? `/api/ranking?job=${encodeURIComponent(job)}` : "/api/ranking", { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "랭킹을 불러오지 못했어요. 잠시 후 다시 열어 주세요.");
  return data;
}

async function saveRanking(body) {
  const response = await fetch("/api/ranking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
}

// 열린 부문 중 점수가 가장 낮은 곳. 같으면 과정 순서대로. 모두 100점이면 없다.
function weakestArea(areas) {
  const open = areas.filter((a) => a.score !== null && a.score < 100);
  return open.sort((a, b) => a.score - b.score)[0] ?? null;
}

function MyScore({ me, onLeave, busy }) {
  const weak = weakestArea(me.areas);
  return (
    <section className={`card ${s.mine}`} aria-labelledby="my-score">
      <div className={s.mineHead}>
        <h2 id="my-score" className={s.cardTitle}>
          내 점수
        </h2>
        {me.ranked && (
          <p className="small muted">
            랭킹 참여 중 · 별명 <strong>{me.nickname}</strong>
            <button type="button" className={s.textButton} onClick={onLeave} disabled={busy}>
              랭킹에서 빠지기
            </button>
          </p>
        )}
      </div>
      <p className={s.total}>
        <span className="mono">{me.total}</span>
        <span className={s.max}>/ {me.max}</span>
      </p>
      <ul className={s.areas} aria-label="부문 점수">
        {me.areas.map((a) => {
          const course = COURSE[a.course];
          return (
            <li key={a.course}>
              <span className={s.areaName}>{course.title}</span>
              {a.score === null ? (
                <>
                  <span className="bar" aria-hidden="true" />
                  <span className={s.soon}>준비 중</span>
                </>
              ) : (
                <>
                  <span className="bar" aria-hidden="true">
                    <span style={{ width: `${a.score}%` }} />
                  </span>
                  <span className="mono">{a.score}</span>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {weak && (
        <p className={s.weak}>
          {COURSE[weak.course].title} {weak.score}점 ·{" "}
          <Link href={`/learn?course=${weak.course}`} className="link">
            과정 {COURSE[weak.course].no}에서 올려 보기
          </Link>
        </p>
      )}
      <p className="small muted">부문마다 처음 푼 점수의 평균이에요. 다시 푼 점수는 들어가지 않아요.</p>
    </section>
  );
}

function JoinForm({ onJoin, busy, error }) {
  const [nickname, setNickname] = useState("");
  return (
    <form
      className={`card ${s.join}`}
      onSubmit={(e) => {
        e.preventDefault();
        onJoin(nickname);
      }}
    >
      <div className="field">
        <label htmlFor="nickname">랭킹에 보일 별명</label>
        <div className={s.joinRow}>
          <input
            id="nickname"
            type="text"
            value={nickname}
            maxLength={12}
            autoComplete="off"
            onChange={(e) => setNickname(e.target.value)}
            aria-describedby="nickname-hint"
            aria-invalid={Boolean(error)}
          />
          <button type="submit" className="btn" disabled={busy || !nickname.trim()}>
            랭킹에 참여하기
          </button>
        </div>
        <p id="nickname-hint" className={error ? s.error : "small muted"} role={error ? "alert" : undefined}>
          {error || "2~12자, 한글·영문·숫자로 정해 주세요. 가입한 이름과 아이디는 보이지 않아요."}
        </p>
      </div>
    </form>
  );
}

function Row({ row }) {
  return (
    <tr className={row.me ? s.meRow : undefined}>
      <td className="mono">{row.rank}</td>
      <td>
        {row.nickname}
        {row.demo && <span className={s.tag}>예시</span>}
        {row.me && <span className={s.tag}>나</span>}
      </td>
      <td>{JOB[row.job]?.name ?? "-"}</td>
      <td className={`mono ${s.num}`}>{row.total}</td>
    </tr>
  );
}

function Board({ top, me }) {
  // 내가 참여했는데 상위 10명 밖이면 표 아래에 내 줄을 따로 둔다.
  const outside = me?.rank && !top.some((r) => r.me);
  return (
    <table className={s.table}>
      <thead>
        <tr>
          <th scope="col">순위</th>
          <th scope="col">별명</th>
          <th scope="col">직무</th>
          <th scope="col" className={s.num}>
            합계
          </th>
        </tr>
      </thead>
      <tbody>
        {top.length ? (
          top.map((row) => <Row key={`${row.rank}-${row.nickname}`} row={row} />)
        ) : (
          <tr>
            <td colSpan={4} className={s.empty}>
              아직 랭킹에 오른 사람이 없어요.
            </td>
          </tr>
        )}
      </tbody>
      {outside && (
        <tbody className={s.outside}>
          <Row row={{ rank: me.rank, nickname: me.nickname, job: me.job, total: me.total, me: true }} />
        </tbody>
      )}
    </table>
  );
}

export default function RankingPage() {
  const { authChecked, user, profile, survey } = useAppState();
  const [tab, setTab] = useState("all");
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [version, setVersion] = useState(0);

  const myJob = data?.me?.job ?? profile?.job ?? survey?.job ?? null;
  const job = tab === "job" && JOB[myJob] ? myJob : null;

  // 탭을 바꾸거나, 로그인하거나, 참여 설정을 바꾸면 다시 불러온다.
  useEffect(() => {
    if (!authChecked) return;
    let live = true;
    fetchRanking(job)
      .then((d) => live && (setData(d), setLoadError("")))
      .catch((e) => live && setLoadError(e.message));
    return () => {
      live = false;
    };
  }, [authChecked, user?.id, job, version]);

  const change = useCallback(async (body) => {
    setBusy(true);
    setJoinError("");
    try {
      await saveRanking(body);
      setVersion((v) => v + 1);
    } catch (e) {
      setJoinError(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  const head = (
    <header className="page-head">
      <h1 className="display">랭킹</h1>
      <p className="lede">AI 활용 여섯 부문의 시험 점수를 더해 순위를 매겨요.</p>
    </header>
  );

  if (data?.off) {
    return (
      <div className="page">
        <div className={s.column}>
          {head}
          <p className="notice">랭킹은 로그인 기능이 켜져 있을 때 볼 수 있어요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className={s.column}>
        {head}

        {loadError && (
          <p className="notice" role="alert">
            {loadError}
            <button type="button" className="btn ghost small" onClick={() => setVersion((v) => v + 1)}>
              다시 불러오기
            </button>
          </p>
        )}

        {data?.me && <MyScore me={data.me} busy={busy} onLeave={() => change({ ranked: false })} />}
        {data && !user && (
          <section className={`card ${s.guest}`}>
            <p>로그인하면 점수가 쌓이고 랭킹에 올라가요.</p>
            <AuthLinks next="/ranking" />
          </section>
        )}

        {data && (
          <section className={s.board} aria-label="랭킹 표">
            {data.me && !data.me.ranked && (
              <JoinForm busy={busy} error={joinError} onJoin={(nickname) => change({ ranked: true, nickname })} />
            )}
            <div className="seg-toggle" role="group" aria-label="랭킹 범위">
              <button type="button" aria-pressed={tab === "all"} onClick={() => setTab("all")}>
                전체
              </button>
              <button type="button" aria-pressed={tab === "job"} disabled={!JOB[myJob]} onClick={() => setTab("job")}>
                내 직무{JOB[myJob] ? `(${JOB[myJob].name})` : ""}
              </button>
            </div>
            <Board top={data.top} me={data.me} />
          </section>
        )}

        {!data && !loadError && <p className="small muted">랭킹을 불러오는 중이에요.</p>}
      </div>
    </div>
  );
}
