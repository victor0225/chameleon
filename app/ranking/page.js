"use client";

// 랭킹(디자인 캔버스 '화면 전체 점검' E5 참여 전, E6 참여 뒤, E3 손님). 여섯 부문(= 여섯 과정) 시험 점수의 합으로 순위를 매긴다.
// 점수 규칙은 lib/scoreboard.js, 데이터는 /api/ranking.
// 위에 내 점수 카드(합계, 전체 순위, 부문 게이지, 가장 낮은 부문)와 별명 카드, 아래에 전체·내 직무 탭과 상위 10명 표.
// 랭킹 참여(별명 정하기)와 빠지기는 이 화면에서만 한다. 빠지기는 실수로 누르지 않게 맨 아래 작은 링크.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAppState } from "@/components/AppState";
import { authHref } from "@/components/AuthLinks";
import { InfoIcon, RuleChip } from "@/components/Common";
import { Tour } from "@/components/Tour";
import { COURSE } from "@/data/courses";
import { JOB } from "@/data/jobs";
import s from "./ranking.module.css";

async function fetchRanking(job) {
  const response = await fetch(job ? `/api/ranking?job=${encodeURIComponent(job)}` : "/api/ranking", { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "랭킹을 불러오지 못함. 잠시 후 다시 열기");
  return data;
}

async function saveRanking(body) {
  const response = await fetch("/api/ranking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "저장하지 못함. 잠시 후 다시 시도");
}

// 열린 부문 중 점수가 가장 낮은 곳. 같으면 과정 순서대로. 모두 100점이면 없다.
function weakestArea(areas) {
  const open = areas.filter((a) => a.score !== null && a.score < 100);
  return open.sort((a, b) => a.score - b.score)[0] ?? null;
}

// 게이지 안쪽 원(반지름 45)을 아래에서부터 점수만큼 채우는 활꼴. 0점이면 없고 100점이면 원 전체.
const C = 60;
const R = 45;
function levelPath(score) {
  if (score <= 0) return null;
  if (score >= 100) return `M${C - R} ${C}a${R} ${R} 0 1 0 ${R * 2} 0a${R} ${R} 0 1 0 ${-R * 2} 0Z`;
  const y = C + R - (R * 2 * score) / 100;
  const w = Math.sqrt(R * R - (y - C) ** 2);
  return `M${(C - w).toFixed(2)} ${y.toFixed(2)}A${R} ${R} 0 ${score > 50 ? 1 : 0} 0 ${(C + w).toFixed(2)} ${y.toFixed(2)}Z`;
}

function Gauge({ score, tried }) {
  const level = score === null ? null : levelPath(score);
  return (
    <svg className={s.gauge} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx={C} cy={C} r="54" className={tried ? s.ring : `${s.ring} ${s.ringIdle}`} />
      <circle cx={C} cy={C} r={R} className={s.well} />
      {level && <path d={level} className={s.level} />}
      <circle cx={C} cy={C} r="27" className={s.hole} />
      <text x={C} y="67" textAnchor="middle" className={s.gaugeNum}>
        {score ?? "-"}
      </text>
    </svg>
  );
}

function MyScore({ me, count }) {
  const weak = weakestArea(me.areas);
  const jobName = JOB[me.job]?.name;
  const hasAvg = Boolean(jobName && me.averages && Object.keys(me.averages).length);
  return (
    <section className="card" aria-labelledby="my-score" data-tour="ranking-me">
      <div className={s.mineHead}>
        <h2 id="my-score" className={s.lbl}>
          내 점수
        </h2>
        {me.ranked && (
          <p className={s.cap}>
            랭킹 참여 중 · 별명 <strong className={s.nick}>{me.nickname}</strong>
          </p>
        )}
      </div>
      <div className={s.totals}>
        <p className={s.total}>
          <span className="mono">{me.total}</span>
          <small> / {me.max}</small>
        </p>
        {me.rank && (
          <div className={s.rank}>
            <p className={s.lbl}>전체 순위</p>
            <p className={s.rankNum}>
              <span className="mono">{me.rank}</span>
              <small>
                위 / <span className="mono">{count ?? "-"}</span>명
              </small>
            </p>
          </div>
        )}
      </div>
      <ul className={s.gauges} aria-label="부문 점수" data-tour="ranking-areas">
        {me.areas.map((a) => {
          const avg = me.averages?.[a.course]?.avg;
          return (
            <li key={a.course}>
              <Gauge score={a.score} tried={a.done > 0} />
              <p className={s.gaugeName}>
                {COURSE[a.course].title}
                <span className={s.srOnly}>{a.score === null ? " 준비 중" : ` ${a.score}점`}</span>
              </p>
              {a.score === null ? (
                <p className={s.cap}>준비 중</p>
              ) : (
                avg !== undefined && (
                  <p className={s.cap}>
                    직무 평균 <span className="mono">{avg}</span>
                  </p>
                )
              )}
            </li>
          );
        })}
      </ul>
      <div className={s.ruleRow}>
        <RuleChip />
        {hasAvg && <p className={s.cap}>직무 평균: 같은 {jobName} 직무 · 예시 사용자 포함</p>}
      </div>
      {weak && (
        <p className={s.weak}>
          <span className="muted">
            가장 낮은 부문: {COURSE[weak.course].title} <span className="mono">{weak.score}</span>점
          </span>
          <Link href={`/learn?course=${weak.course}`} className="link">
            과정 {COURSE[weak.course].no}에서 올려 보기
          </Link>
        </p>
      )}
    </section>
  );
}

function JoinForm({ onJoin, busy, error }) {
  const [nickname, setNickname] = useState("");
  const short = nickname.trim().length < 2;
  return (
    <form
      data-tour="ranking-join"
      className={`card ${s.join}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!short) onJoin(nickname);
      }}
    >
      <label htmlFor="nickname" className={s.h3}>
        랭킹에 보일 별명
      </label>
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
        <button type="submit" className="btn" disabled={busy || short} aria-describedby={short ? "nickname-need" : undefined}>
          랭킹에 참여하기
        </button>
      </div>
      <p id="nickname-hint" className={s.cap}>
        2~12자, 한글·영문·숫자. 가입한 이름과 아이디는 공개되지 않음.
      </p>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      {short && (
        <p id="nickname-need" className={s.need}>
          <InfoIcon />
          별명을 2자 이상 쓰면 참여 가능
        </p>
      )}
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
        {row.me && <span className={s.meChip}>나</span>}
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
              아직 랭킹 참여자 없음
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
  // overall: 전체 랭킹(내 점수 카드의 전체 순위), data: 지금 탭의 랭킹(표). 전체 탭이면 둘이 같다.
  const [overall, setOverall] = useState(null);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [version, setVersion] = useState(0);

  const myJob = overall?.me?.job ?? profile?.job ?? survey?.job ?? null;
  const job = tab === "job" && JOB[myJob] ? myJob : null;

  // 탭을 바꾸거나, 로그인하거나, 참여 설정을 바꾸면 다시 불러온다.
  useEffect(() => {
    if (!authChecked) return;
    let live = true;
    Promise.all([fetchRanking(null), job ? fetchRanking(job) : null])
      .then(([all, shown]) => {
        if (!live) return;
        setOverall(all);
        setData(shown ?? all);
        setLoadError("");
      })
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

  const title = <h1 className={`display ${s.title}`}>내 점수와 순위 보기</h1>;

  if (data?.off) {
    return (
      <div className={s.page}>
        {title}
        <p className={`notice ${s.notice}`}>로그인 기능이 켜져 있을 때만 랭킹 표시</p>
      </div>
    );
  }

  const me = overall?.me ?? null;

  return (
    <div className={s.page}>
      <Tour id="ranking" when={Boolean(data)} />
      {title}

      {loadError && (
        <p className={`notice ${s.notice}`} role="alert">
          {loadError}
          <button type="button" className="btn ghost small" onClick={() => setVersion((v) => v + 1)}>
            다시 불러오기
          </button>
        </p>
      )}

      {(me || (data && !user)) && (
        <div className={s.cards}>
          {me && <MyScore me={me} count={overall.count} />}
          {me && !me.ranked && <JoinForm busy={busy} error={joinError} onJoin={(nickname) => change({ ranked: true, nickname })} />}
          {data && !user && (
            <section className={`card ${s.guest}`}>
              <p>
                <Link href={authHref("login", "/ranking")} className="link">
                  로그인
                </Link>
                하면 내 점수 표시 · 랭킹 참여 가능
              </p>
              <p className={s.cap}>
                계정이 없으면{" "}
                <Link href={authHref("signup", "/ranking")} className="link">
                  회원가입
                </Link>
              </p>
            </section>
          )}
        </div>
      )}

      {data && (
        <section className={s.board} aria-label="랭킹 표">
          <div className={s.boardHead}>
            <div className={s.tabs} role="group" aria-label="랭킹 범위" data-tour="ranking-tabs">
              <button type="button" aria-pressed={tab === "all"} onClick={() => setTab("all")}>
                전체 TOP 10
              </button>
              <button type="button" aria-pressed={tab === "job"} disabled={!JOB[myJob]} onClick={() => setTab("job")}>
                내 직무{JOB[myJob] ? `(${JOB[myJob].name})` : ""} TOP 10
              </button>
            </div>
            <p className={s.cap}>
              탭마다 10위까지 표시{data.top.some((r) => r.demo) ? " · 시연용 예시 사용자 포함" : ""}
            </p>
          </div>
          <div className={`card ${s.tableCard}`}>
            <Board top={data.top} me={data.me} />
          </div>
        </section>
      )}

      {me?.ranked && (
        <div className={s.leave}>
          {joinError && (
            <p className={s.error} role="alert">
              {joinError}
            </p>
          )}
          <button type="button" className={s.leaveLink} onClick={() => change({ ranked: false })} disabled={busy}>
            랭킹에서 빠지기
          </button>
        </div>
      )}

      {!data && !loadError && <p className={s.cap}>랭킹 불러오는 중</p>}
    </div>
  );
}
