"use client";

// 내 랭킹 점수(처음 푼 점수, 600점 만점)와 순위. 교육 화면 학습 기록 칸과 마이페이지 학습 현황의 '랭킹 점수' 칸에 쓴다.
// 로그인했으면 /api/ranking에서 내 점수를 받아 오고, 로그인 전이거나 로그인 기능이 꺼져 있으면 null이다.
import { useEffect, useState } from "react";
import { useAppState } from "./AppState";

// → { me: { total, max, rank, ranked, ... } | null, count, available }
//   available: 로그인 기능이 켜져 있어 랭킹 화면으로 갈 수 있음
export function useMyScore() {
  const { authChecked, user, login, record } = useAppState();
  const [data, setData] = useState(null);

  // 미션을 채점받으면 record가 바뀌니, 그때 다시 받아 점수를 맞춘다.
  useEffect(() => {
    if (!user) return;
    let live = true;
    fetch("/api/ranking", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setData(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [user, record]);

  return { me: user ? (data?.me ?? null) : null, count: data?.count ?? null, available: authChecked && login.ready };
}
