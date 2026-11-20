"use client";

// 회원가입(보드 K4-1, 직무 안 고르고 누름 K4-2). 가운데 제목 아래 카드 하나: 아이디 → 비밀번호 → 확인 → 이름 → 관심 직무.
// 관심 직무는 필수다. 처음에는 손님 때 고른 직무를 골라 둔다. 직무 없이 누르면 직무 칸을 오류로 두고 그 칸으로 초점을 옮긴다.
import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAppState } from "@/components/AppState";
import { JobPicker } from "@/components/JobPicker";
import { JOB } from "@/data/jobs";
import { checkSignup } from "@/lib/credentials";
import { Field, sendAuth, useNext } from "../login/AuthParts";
import s from "./signup.module.css";

const EMPTY = { loginId: "", password: "", passwordConfirm: "", name: "" };

export default function SignupPage() {
  const next = useNext();
  const { authChecked, user, login, profile } = useAppState();
  const [form, setForm] = useState(EMPTY);
  // 직접 고르기 전에는 손님 때 고른 직무(이 브라우저 기록)를 쓴다. 저장소를 읽기 전에는 비어 있다.
  const [picked, setPicked] = useState(null);
  const job = picked ?? (JOB[profile?.job] ? profile.job : null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const pickerRef = useRef(null);

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

  function pickJob(id) {
    setPicked(id);
    if (error?.field === "job") setError(null);
  }

  // 직무 칸 오류: 다른 칸에 쓴 값은 그대로 두고 첫 직무 줄로 초점을 옮긴다.
  function showError(problem) {
    setError(problem);
    if (problem.field === "job") pickerRef.current?.querySelector('[role="radio"]')?.focus();
  }

  async function submit(e) {
    e.preventDefault();
    const invalid = checkSignup({ ...form, job });
    if (invalid) return showError(invalid);
    setBusy(true);
    setError(null);
    const failed = await sendAuth("/api/auth/signup", { ...form, name: form.name.trim(), job });
    if (failed) {
      showError({ field: failed.field ?? "name", message: failed.message });
      setBusy(false);
    }
  }

  let body = (
    <form onSubmit={submit} noValidate>
      <div className={s.fields}>
        <Field
          id="loginId"
          label="아이디"
          type="text"
          placeholder="영문·숫자 4~20자"
          value={form.loginId}
          onChange={(e) => set("loginId", e.target.value.toLowerCase().replace(/\s/g, ""))}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={20}
          error={errorFor("loginId")}
        />
        <Field
          id="password"
          label="비밀번호"
          type="password"
          placeholder="8자 이상"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          autoComplete="new-password"
          error={errorFor("password")}
        />
        <Field
          id="passwordConfirm"
          label="비밀번호 확인"
          type="password"
          placeholder="한 번 더 입력"
          value={form.passwordConfirm}
          onChange={(e) => set("passwordConfirm", e.target.value)}
          autoComplete="new-password"
          error={errorFor("passwordConfirm")}
        />
        <Field
          id="name"
          label="이름"
          type="text"
          placeholder="이름"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          autoComplete="name"
          maxLength={20}
          error={errorFor("name")}
        />
      </div>
      <div className={s.job}>
        <JobPicker ref={pickerRef} value={job} onChange={pickJob} error={errorFor("job")} />
        <p className={s.cap}>고른 직무로 미션과 예시가 바뀜 · 내 정보에서 언제든 변경</p>
      </div>
      <button type="submit" className={`btn ${s.submit}`} disabled={busy}>
        {busy ? "가입하는 중…" : "가입하기"}
      </button>
      <p className={s.switch}>
        이미 계정이 있으면
        <Link href={`/login?next=${encodeURIComponent(next)}`}>로그인</Link>
      </p>
    </form>
  );
  // 서버 상태를 확인하기 전, 이미 로그인했을 때, 서버에 DB가 없을 때는 입력 칸 대신 안내를 보여 준다.
  if (!authChecked) body = null;
  else if (user)
    body = (
      <p>
        {user.name}님으로 로그인됨. <Link href="/mypage">내 정보로 가기</Link>
      </p>
    );
  else if (!login.ready) body = <p className="muted">아직 가입 불가. 서버에 DB 설정 필요.</p>;

  return (
    <div className={s.wrap}>
      <h1 id="signup-title" className={`display ${s.title}`}>
        회원가입
      </h1>
      <section className={s.card} aria-labelledby="signup-title" aria-busy={!authChecked}>
        {body}
      </section>
    </div>
  );
}
