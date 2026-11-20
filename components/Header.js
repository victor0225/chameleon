"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Anatomy";
import { useAppState } from "@/components/AppState";
import { JOB } from "@/data/jobs";
import styles from "./Header.module.css";

const NAV = [
  { href: "/", name: "진단", match: (path) => path === "/" || path.startsWith("/diagnosis") },
  { href: "/prompt", name: "프롬프트 도우미", match: (path) => path === "/prompt" },
  { href: "/learn", name: "AI 활용 교육", match: (path) => path === "/learn" },
];

// 마이페이지의 "페이지 설정"을 이 브라우저에 저장하는 키.
export const SETTINGS_KEY = "chameleon-settings-v1";

// 화면 글자가 모두 px로 정해져 있어서 루트 font-size를 바꿔도 커지지 않는다. 그래서 zoom으로 키운다.
export function applyLargeText(on) {
  document.documentElement.style.zoom = on ? "1.125" : "";
}

export function Header() {
  const pathname = usePathname();
  const { ready, profile } = useAppState();
  const onMypage = pathname === "/mypage";
  const chipText = profile ? `${profile.level} · ${JOB[profile.job]?.name ?? "직무 미정"}` : "진단 전";

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
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/mypage"
          className={`level-chip ${styles.chip}${onMypage ? ` ${styles.active}` : ""}`}
          aria-label={ready ? `마이페이지, ${chipText}` : "마이페이지"}
          aria-current={onMypage ? "page" : undefined}
        >
          {/* 저장소를 읽기 전에는 "진단 전"이 잠깐 보였다 바뀌지 않도록 빈 칩 자리만 둔다. */}
          {ready ? chipText : <span className={styles.placeholder} aria-hidden="true" />}
        </Link>
      </div>
    </header>
  );
}
