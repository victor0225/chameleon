"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Anatomy";
import { useAppState } from "@/components/AppState";
import { authHref } from "@/components/AuthLinks";
import { replayTour, useCurrentTour } from "@/components/Tour";
import { JOB } from "@/data/jobs";
import styles from "./Header.module.css";

// 메뉴는 교육·시험 둘(보드 K1). 진단은 첫 화면 입력 칸에서 시작한다.
const NAV = [
  { href: "/learn", name: "교육", tour: "nav-learn", match: (path) => path.startsWith("/learn") },
  { href: "/exam", name: "시험", tour: "nav-exam", match: (path) => path.startsWith("/exam") },
];

// 마이페이지의 "페이지 설정"을 이 브라우저에 저장하는 키.
export const SETTINGS_KEY = "chameleon-settings-v1";

// 화면 글자가 모두 px로 정해져 있어서 루트 font-size를 바꿔도 커지지 않는다. 그래서 zoom으로 키운다.
export function applyLargeText(on) {
  document.documentElement.style.zoom = on ? "1.125" : "";
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, profile, user, login, authChecked, logout } = useAppState();
  const onAuthPage = pathname === "/login" || pathname === "/signup";
  const onMypage = pathname === "/mypage";
  // 관심 직무를 골랐으면 "내 정보 · 마케팅", 안 골랐으면 "내 정보"
  const jobName = JOB[profile?.job]?.name;
  const chipText = jobName ? `내 정보 · ${jobName}` : "내 정보";

  async function onLogout() {
    await logout();
    router.push("/");
  }
  // 지금 화면에 안내(components/Tour.js)가 있으면 "화면 안내"로 다시 띄울 수 있다.
  const tour = useCurrentTour();

  // 헤더는 모든 화면에 있으니, 처음 열 때 저장된 "글자 크게 보기"를 여기서 적용한다.
  useEffect(() => {
    try {
      applyLargeText(Boolean(JSON.parse(localStorage.getItem(SETTINGS_KEY))?.largeText));
    } catch {
      // 저장소를 못 읽으면 기본 글자 크기로 둔다.
    }
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          <Logo />
          카멜레온
        </Link>
        <nav className="nav" aria-label="주요 메뉴">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "active" : undefined}
                aria-current={active ? "page" : undefined}
                data-tour={item.tour}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
        {/* 오른쪽 칸: 화면 안내 · 내 정보 칩 · 로그인(로그아웃) 순서를 모든 화면에서 같게 둔다(공통 칸 ①).
            안내가 없는 화면에서도 자리는 남겨 칩이 옆으로 밀리지 않게 한다. */}
        <div className={styles.right}>
        <button
          type="button"
          className={styles.tourButton}
          onClick={replayTour}
          hidden={!tour}
          style={tour ? undefined : { display: "inline-flex", visibility: "hidden" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" />
            <circle cx="12" cy="17" r=".6" fill="currentColor" />
          </svg>
          화면 안내
        </button>
        <Link
          href="/mypage"
          className={`level-chip ${styles.chip}${onMypage ? ` ${styles.active}` : ""}`}
          aria-current={onMypage ? "page" : undefined}
          data-tour="nav-me"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
          </svg>
          {/* 저장소를 읽기 전에는 직무가 잠깐 비었다 바뀌지 않도록 글자만 "내 정보"로 둔다. */}
          {ready ? chipText : "내 정보"}
        </Link>
        {/* 서버에 DB가 연결돼 있을 때만 로그인 버튼을 보인다. 연결 전에는 지금처럼 브라우저 저장만 쓴다. */}
        {authChecked && !user && login.ready && !onAuthPage && (
          <Link href={authHref("login", pathname)} className={styles.login}>
            로그인
          </Link>
        )}
        {user && (
          <button type="button" className={styles.login} onClick={onLogout}>
            로그아웃
          </button>
        )}
        </div>
      </div>
    </header>
  );
}
