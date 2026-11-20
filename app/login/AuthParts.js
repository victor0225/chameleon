"use client";

// 로그인·회원가입 화면이 같이 쓰는 조각.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppState } from "@/components/AppState";
import { safeNext } from "@/lib/safeNext";
import s from "./auth.module.css";

// 주소의 ?next=. 로그인을 마치면 이 화면으로 돌아간다. 다른 사이트 주소는 받지 않는다.
export const nextFromUrl = () => safeNext(new URLSearchParams(window.location.search).get("next") ?? "/");

export function useNext() {
  const [next, setNext] = useState("/");
  useEffect(() => {
    const value = nextFromUrl();
    queueMicrotask(() => setNext(value));
  }, []);
  return next;
}

export function Field({ id, label, hint, error, ...input }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {hint && (
        <p id={`${id}-hint`} className={s.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// 서버 상태를 확인하기 전, 이미 로그인했을 때, 서버에 DB가 없을 때는 입력 칸 대신 안내를 보여 준다.
export function AuthShell({ title, lede, children }) {
  const { authChecked, user, login } = useAppState();
  let body = children;
  if (!authChecked) body = null;
  else if (user)
    body = (
      <p>
        {user.name}님으로 로그인돼 있어요. <Link href="/mypage">마이페이지로 가기</Link>
      </p>
    );
  else if (!login.ready) body = <p className="muted">아직 로그인을 쓸 수 없어요. 서버에 DB 설정이 필요해요.</p>;
  return (
    <div className={s.wrap}>
      <section className={s.card} aria-labelledby="auth-title">
        <div className={s.head}>
          <h1 id="auth-title" className="display">
            {title}
          </h1>
          <p>{lede}</p>
        </div>
        {body}
      </section>
    </div>
  );
}

// 가입·로그인 API를 부르고, 성공하면 next로 새로 들어가서 계정 기록과 합치게 한다.
export async function sendAuth(url, body) {
  let response;
  try {
    response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    return { field: null, message: "서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요." };
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) return { field: data?.field ?? null, message: data?.error ?? "잠시 뒤 다시 시도해 주세요." };
  window.location.assign(nextFromUrl());
  return null;
}
