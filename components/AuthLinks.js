"use client";

// 로그인·회원가입으로 가는 버튼 두 개. 끝나면 next 주소(기본은 지금 화면)로 돌아온다.
import Link from "next/link";
import { usePathname } from "next/navigation";

export const authHref = (page, next) => `/${page}?next=${encodeURIComponent(next || "/")}`;

export function AuthLinks({ next }) {
  const pathname = usePathname();
  const back = next ?? pathname;
  return (
    <div className="login-buttons">
      <Link href={authHref("login", back)} className="btn small">
        로그인
      </Link>
      <Link href={authHref("signup", back)} className="btn ghost small">
        회원가입
      </Link>
    </div>
  );
}
