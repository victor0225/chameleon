"use client";

// "내 점수 320 / 500 · 랭킹 보기" 한 줄. 마이페이지 XP 옆, 교육 화면 학습 기록 칸 아래에 둔다.
// 로그인했으면 /api/ranking에서 내 점수를 받아 보여 주고, 로그인 전이면 랭킹 링크만 둔다. 로그인 기능이 꺼져 있으면 숨긴다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppState } from "./AppState";

export function ScoreLine({ className = "" }) {
  const { authChecked, user, login, record } = useAppState();
  const [me, setMe] = useState(null);

  // 실습을 채점받으면 record가 바뀌니, 그때 다시 받아 점수를 맞춘다.
  useEffect(() => {
    if (!user) return;
    let live = true;
    fetch("/api/ranking", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setMe(d?.me ?? null))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [user, record]);

  if (!authChecked || !login.ready) return null;
  return (
    <p className={`small ${className}`}>
      {user && me && (
        <>
          내 점수 <strong className="mono">{me.total}</strong> / {me.max} ·{" "}
        </>
      )}
      <Link href="/ranking" className="link">
        랭킹 보기
      </Link>
    </p>
  );
}
