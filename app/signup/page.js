"use client";

import { useLayoutEffect, useState } from "react";
import Link from "next/link";
import { checkSignup, RULE } from "@/lib/credentials";
import { AuthShell, Field, sendAuth, useNext } from "../login/AuthParts";
import s from "../login/auth.module.css";

const EMPTY = { loginId: "", password: "", passwordConfirm: "", name: "" };

export default function SignupPage() {
  const next = useNext();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // 다른 화면으로 가면 이 화면은 숨겨질 뿐이라, 숨길 때 비밀번호와 오류를 비운다.
  useLayoutEffect(
    () => () => {
      setForm((f) => ({ ...f, password: "", passwordConfirm: "" }));
      setError(null);
      setBusy(false);
    },
    [],
  );

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const errorFor = (field) => (error?.field === field ? error.message : "");

  async function submit(e) {
    e.preventDefault();
    const invalid = checkSignup(form);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    const failed = await sendAuth("/api/auth/signup", { ...form, name: form.name.trim() });
    if (failed) {
      setError({ field: failed.field ?? "name", message: failed.message });
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="회원가입"
      lede="가입하면 진단·학습 기록이 계정에 저장됨. 이 브라우저 기록도 함께 옮김"
    >
      <form className={s.form} onSubmit={submit} noValidate>
        {/* 되찾을 방법이 없다는 안내는 놓치지 않게 입력 칸 위에 둔다(디자인 캔버스 E2). */}
        <p className="notice" style={{ marginBottom: 0 }}>
          비밀번호 찾기 기능 없음 · 비밀번호는 따로 적어 두기
        </p>
        <Field
          id="loginId"
          label="아이디"
          type="text"
          value={form.loginId}
          onChange={(e) => set("loginId", e.target.value.toLowerCase().replace(/\s/g, ""))}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={20}
          hint={RULE.loginId}
          error={errorFor("loginId")}
        />
        <Field
          id="password"
          label="비밀번호"
          type="password"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          autoComplete="new-password"
          hint={RULE.password}
          error={errorFor("password")}
        />
        <Field
          id="passwordConfirm"
          label="비밀번호 확인"
          type="password"
          value={form.passwordConfirm}
          onChange={(e) => set("passwordConfirm", e.target.value)}
          autoComplete="new-password"
          error={errorFor("passwordConfirm")}
        />
        <Field
          id="name"
          label="이름"
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          autoComplete="name"
          maxLength={20}
          error={errorFor("name")}
        />
        <button type="submit" className={`btn ${s.submit}`} disabled={busy}>
          {busy ? "가입하는 중…" : "가입하기"}
        </button>
      </form>
      <p className={s.switch}>
        이미 계정이 있다면
        <Link href={`/login?next=${encodeURIComponent(next)}`}>로그인</Link>
      </p>
    </AuthShell>
  );
}
