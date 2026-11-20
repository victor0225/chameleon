"use client";

// 이 시험의 랭킹 카드(보드 L3·L7·L7-2). 상위 10명 표(순위·닉네임·점수·시간), 내가 10위 밖이면 '…' 뒤에 내 줄.
// 예시 사용자는 '예시' 표시, 내 줄은 옅은 면 + '나' 칩. 랭킹에 참가하지 않은 사람은 '닉네임 없음'.
// 로그인했고 아직 참가 전이면 맨 아래에 닉네임 칸과 '참가'(테두리 버튼). 참가하면 숨긴다.
import { useState } from "react";
import { clock } from "@/data/exams";
import { nicknameError } from "@/lib/scoreboard";
import { joinRanking } from "../parts";
import s from "../exam.module.css";

function Row({ row }) {
  return (
    <tr className={row.me ? s.meRow : undefined}>
      <td className={s.m}>{row.rank}</td>
      <td>
        <span className={s.nameCell}>
          {row.nickname ?? <span className={s.noName}>닉네임 없음</span>}
          {row.demo && <span className={s.tag}>예시</span>}
          {row.me && <span className={s.mine}>나</span>}
        </span>
      </td>
      <td className={`${s.r} ${s.m}`}>{row.total}</td>
      <td className={`${s.r} ${s.m}`}>{clock(row.seconds)}</td>
    </tr>
  );
}

function Table({ board }) {
  const outside = board.me && !board.top.some((r) => r.me);
  return (
    <table className={s.table}>
      <thead>
        <tr>
          <th scope="col">순위</th>
          <th scope="col">닉네임</th>
          <th scope="col" className={s.r}>
            점수
          </th>
          <th scope="col" className={s.r}>
            시간
          </th>
        </tr>
      </thead>
      <tbody>
        {board.top.length ? (
          board.top.map((row, i) => <Row key={i} row={row} />)
        ) : (
          <tr>
            <td colSpan={4} className={s.emptyCell}>
              아직 응시자 없음
            </td>
          </tr>
        )}
        {outside && (
          <>
            <tr className={s.gapRow}>
              <td colSpan={4}>
                <span aria-hidden="true">…</span>
                <span className={s.srOnly}>중간 순위 생략</span>
              </td>
            </tr>
            <Row row={{ ...board.me, demo: false, me: true }} />
          </>
        )}
      </tbody>
    </table>
  );
}

function JoinForm({ onJoined }) {
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    const problem = nicknameError(nickname);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await joinRanking(nickname.trim());
      onJoined();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className={s.join} onSubmit={onSubmit} noValidate>
      <label htmlFor="exam-nickname" className={s.lbl}>
        닉네임을 정하면 랭킹에 이름 표시
      </label>
      <div className={s.joinRow}>
        <input
          id="exam-nickname"
          type="text"
          value={nickname}
          maxLength={12}
          autoComplete="off"
          placeholder="닉네임 2~12자"
          onChange={(e) => setNickname(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "exam-nickname-error" : undefined}
        />
        <button type="submit" className={s.outline} disabled={busy}>
          참가
        </button>
      </div>
      {error && (
        <p id="exam-nickname-error" className={s.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

// board: GET /api/exam/[job] 결과(불러오기 전 null). canJoin: 로그인함.
export function RankingCard({ ref, board, error, canJoin, onReload }) {
  return (
    <aside ref={ref} className={`${s.card} ${s.rankCard}`} aria-labelledby="exam-ranking">
      <div className={s.rankHead}>
        <h2 id="exam-ranking" className={s.h3}>
          랭킹
        </h2>
        {board && !board.off && (
          <p className={s.cap}>
            응시 {board.takers}명 · 평균 <b className={s.monoInk}>{board.avg}</b>점
          </p>
        )}
      </div>
      <p className={s.cap}>상위 10명 · 동점이면 먼저 끝낸 사람이 위</p>

      {error && (
        <p className={s.notice} role="alert">
          {error}
          <button type="button" className={s.outline} onClick={onReload}>
            다시 불러오기
          </button>
        </p>
      )}
      {board?.off ? (
        <p className={s.notice}>로그인 기능이 켜져 있을 때만 랭킹 표시</p>
      ) : board ? (
        <Table board={board} />
      ) : (
        !error && <p className={s.notice}>랭킹 불러오는 중</p>
      )}
      {board?.notReady && <p className={s.notice}>기록 저장 준비 중 · 랭킹 미반영</p>}

      {canJoin && board?.joined === false && <JoinForm onJoined={onReload} />}
    </aside>
  );
}
