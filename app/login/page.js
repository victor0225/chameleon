"use client";

import { useLayoutEffect, useState } from "react";
import Link from "next/link";
import { checkLogin } from "@/lib/credentials";
import { AuthShell, Field, sendAuth, useNext } from "./AuthParts";
import s from "./auth.module.css";

export default function LoginPage() {
  const next = useNext();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // 다른 화면으로 가면 이 화면은 숨겨질 뿐이라, 숨길 때 비밀번호와 오류를 비운다.
  useLayoutEffect(
    () => () => {
      setPassword("");
      setError(null);
      setBusy(false);
    },
    [],
  );

  async function submit(e) {
    e.preventDefault();
    const invalid = checkLogin({ loginId, password });
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    const failed = await sendAuth("/api/auth/login", { loginId: loginId.trim(), password });
    if (failed) {
      setError({ field: failed.field ?? "password", message: failed.message });
      setBusy(false);
    }
  }

  return (
    <AuthShell title="로그인" lede="로그인하면 다른 기기에서도 진단·학습 기록 이어 보기 가능">
      <form className={s.form} onSubmit={submit} noValidate>
        <Field
          id="loginId"
          label="아이디"
          type="text"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value.toLowerCase())}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          error={error?.field === "loginId" ? error.message : ""}
        />
        <Field
          id="password"
          label="비밀번호"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          error={error?.field !== "loginId" ? error?.message : ""}
        />
        <button type="submit" className={`btn ${s.submit}`} disabled={busy}>
          {busy ? "로그인하는 중…" : "로그인"}
        </button>
      </form>
      <p className={s.switch}>
        아직 계정이 없다면
        <Link href={`/signup?next=${encodeURIComponent(next)}`}>회원가입</Link>
      </p>
    </AuthShell>
  );
}
