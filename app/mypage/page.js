"use client";

// 내 정보(보드 K5-1 로그인, K5-2 손님). 위에서부터 관심 직무 → (로그인) 경험치·내 시험 두 칸 → 로그인 정보
// → (손님) 로그인 안내 한 줄 → 진단 기록(E7 고친 안) → 페이지 설정 → 알림 → 데이터(기록 모두 지우기).
// 로그아웃은 헤더에만 둔다. 진한 채움 버튼은 진단 기록의 버튼 하나뿐이고, 나머지는 테두리 버튼이다.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useAppState } from "@/components/AppState";
import { authHref } from "@/components/AuthLinks";
import { ArrowIcon, InfoIcon } from "@/components/Common";
import { SETTINGS_KEY, applyLargeText } from "@/components/Header";
import { JobPicker } from "@/components/JobPicker";
import { Tour } from "@/components/Tour";
import { examTitle } from "@/data/exams";
import { JOB } from "@/data/jobs";
import { checkName, checkPasswordChange } from "@/lib/credentials";
import { ITEMS } from "@/lib/items";
import { josa } from "@/lib/josa";
import { levelOf, xpToNext } from "@/lib/level";
import { Field } from "../login/AuthParts";
import styles from "./mypage.module.css";

// 글자 크게 보기만 실제로 화면에 반영하고, 나머지는 이 브라우저에 저장만 한다.
const DEFAULT_SETTINGS = {
  reduceMotion: false,
  largeText: false,
  studyReminder: false,
  reminderTime: "morning",
  weeklyReport: false,
};

const REMINDER_TIMES = [
  { id: "morning", name: "오전 9시" },
  { id: "noon", name: "낮 12시" },
  { id: "evening", name: "저녁 8시" },
];

const ITEM_IDS = ITEMS.map((item) => item.id);

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function formatDate(at) {
  if (!at) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

// 이름·비밀번호 바꾸기 API. 성공하면 { data }, 실패하면 { field, error }.
async function sendJson(url, method, body) {
  try {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => null);
    if (!response.ok) return { field: data?.field ?? null, error: data?.error ?? "잠시 뒤 다시 시도." };
    return { data };
  } catch {
    return { field: null, error: "서버에 연결하지 못함. 인터넷 연결 확인." };
  }
}

function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

function Skeleton() {
  return (
    <div className="skeleton" aria-hidden="true">
      <span />
      <span />
    </div>
  );
}

function Switch({ id, label, desc, checked, onChange }) {
  return (
    <div className={styles.setting}>
      <span className={styles.settingText}>
        <label htmlFor={id} className={styles.settingLabel}>
          {label}
        </label>
        {desc && (
          <span id={`${id}-desc`} className={styles.settingDesc}>
            {desc}
          </span>
        )}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={desc ? `${id}-desc` : undefined}
        className={styles.switch}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.knob} aria-hidden="true" />
      </button>
    </div>
  );
}

// 관심 직무 카드: 고른 직무 칩 + '바꾸기'(누르면 직무 다섯 줄을 펼침). 아직 안 골랐으면 펼친 채로 둔다.
// 고르면 바로 저장(setJob)하고 접는다. 로그인했으면 AppState가 계정에도 저장한다.
function JobCard() {
  const { ready, profile, setJob } = useAppState();
  const job = JOB[profile?.job] ? profile.job : null;
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(null);
  const toggle = useRef(null);
  const expanded = open || !job;

  // 다른 화면으로 가면 숨겨질 뿐이라, 숨길 때 펼친 목록과 저장 안내를 접는다.
  useLayoutEffect(
    () => () => {
      setOpen(false);
      setSaved(null);
    },
    [],
  );

  function choose(id) {
    // 접히면서 누른 줄이 사라지니, 바뀐 화면을 바로 그린 뒤 '바꾸기'로 초점을 돌린다.
    flushSync(() => {
      if (id !== job) {
        setJob(id);
        setSaved(id);
      }
      setOpen(false);
    });
    toggle.current?.focus();
  }

  return (
    <section className={styles.card} aria-labelledby="job-title" aria-busy={!ready} data-tour="mypage-job">
      <div className={styles.headRow}>
        <h2 id="job-title" className={styles.h3}>
          관심 직무
        </h2>
        {ready && job && (
          <>
            <span className={styles.jobChip}>
              <PersonIcon />
              {JOB[job].name}
            </span>
            <button
              ref={toggle}
              type="button"
              className={`btn ghost small ${styles.pill} ${styles.right}`}
              aria-label={open ? "관심 직무 닫기" : "관심 직무 바꾸기"}
              aria-expanded={open}
              aria-controls="job-picker"
              onClick={() => {
                setSaved(null);
                setOpen(!open);
              }}
            >
              {open ? "닫기" : "바꾸기"}
            </button>
          </>
        )}
      </div>
      {!ready ? (
        <Skeleton />
      ) : (
        expanded && (
          <div id="job-picker" className={styles.picker}>
            {!job && <p className={styles.lead}>직무를 고르면 미션과 예시가 내 일에 맞춰짐</p>}
            <JobPicker id="me-job" value={job} onChange={choose} hideLabel />
          </div>
        )
      )}
      <p className={styles.status} role="status">
        {saved && JOB[saved] ? `관심 직무를 ${josa(JOB[saved].name, ["으로", "로"])} 바꿈 · 미션과 예시에 반영` : ""}
      </p>
    </section>
  );
}

// 경험치 칸: XP, 지금 수준(과정 1에서 통과한 미션으로 계산), 다음 수준까지 남은 XP.
function XpCard({ record }) {
  const level = levelOf(record.completed);
  const left = xpToNext(record.completed);
  return (
    <section className={styles.card} aria-labelledby="xp-title">
      <h2 id="xp-title" className="label">
        경험치
      </h2>
      <p className={styles.xpLine}>
        <span className={styles.xpNum}>{record.xp}</span>
        <span className={styles.unit}>XP</span>
        <span className={styles.chip}>{level}</span>
      </p>
      <p className={styles.cap}>
        {left === null ? (
          "가장 높은 수준"
        ) : (
          <>
            다음 수준까지 <b className="mono">{left} XP</b>
          </>
        )}
      </p>
    </section>
  );
}

// 내 시험 칸: 관심 직무 시험의 내 첫 점수와 순위(GET /api/exam). 못 받아 오면 점수 줄만 안내로 바꾼다.
function ExamCard({ job }) {
  const [data, setData] = useState({ status: "loading" });

  useEffect(() => {
    let live = true;
    fetch("/api/exam", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!live) return;
        if (d?.off || d?.notReady) setData({ status: "off" });
        else setData({ status: "ok", exams: Array.isArray(d?.exams) ? d.exams : [] });
      })
      .catch(() => live && setData({ status: "error" }));
    return () => {
      live = false;
    };
  }, []);

  const exam = data.status === "ok" && job ? data.exams.find((e) => e.job === job) : null;
  const mine = exam?.mine ?? null;
  let line = null;
  if (!job) line = <span className={styles.cap}>관심 직무를 고르면 내 시험 표시</span>;
  else if (data.status === "off") line = <span className={styles.cap}>시험 기록 준비 중</span>;
  else if (data.status === "error") line = <span className={styles.cap}>시험 기록을 불러오지 못함</span>;
  else if (data.status === "ok" && !mine) line = <span className={styles.cap}>응시 전</span>;
  else if (mine)
    line = (
      <>
        <span className={styles.examNum}>{mine.total}</span>
        <span className={styles.cap}>
          점
          {mine.rank ? (
            <>
              {" · "}
              {exam.takers ? (
                <>
                  <span className="mono">{exam.takers}</span>명 중{" "}
                </>
              ) : null}
              <span className="mono">{mine.rank}</span>위
            </>
          ) : null}
        </span>
      </>
    );

  return (
    <section className={styles.card} aria-labelledby="exam-title">
      <p className="label">내 시험</p>
      <h2 id="exam-title" className={styles.h3}>
        {job ? examTitle(JOB[job].name) : "직무별 AI 활용 시험"}
      </h2>
      <p className={styles.examLine} aria-busy={data.status === "loading"}>
        {line}
      </p>
      <Link href={job ? `/exam/${job}` : "/exam"} className={`link ${styles.examLink}`}>
        시험 보러 가기
        <ArrowIcon size={14} />
      </Link>
    </section>
  );
}

function NameForm({ name, labelId, onSaved, onCancel }) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const invalid = checkName(value);
    if (invalid) return setError(invalid.message);
    if (value.trim() === name) return onCancel();
    setBusy(true);
    const result = await sendJson("/api/me/account", "PATCH", { name: value.trim() });
    setBusy(false);
    if (result.error) return setError(result.error);
    onSaved(result.data.user);
  }

  return (
    <form className={styles.edit} onSubmit={submit} noValidate>
      <div className={styles.editRow}>
        <input
          id="me-name"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-labelledby={labelId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "me-name-error" : undefined}
          autoComplete="name"
          maxLength={20}
          // 사용자가 '바꾸기'를 눌러 연 칸이라 바로 쓸 수 있게 초점을 둔다.
          autoFocus
        />
        <EditButtons busy={busy} onCancel={onCancel} />
      </div>
      {error && (
        <p id="me-name-error" className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

const EMPTY_PASSWORDS = { current: "", next: "", confirm: "" };

function PasswordForm({ onSaved, onCancel }) {
  const [form, setForm] = useState(EMPTY_PASSWORDS);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const errorFor = (field) => (error?.field === field ? error.message : "");

  async function submit(e) {
    e.preventDefault();
    const invalid = checkPasswordChange(form);
    if (invalid) return setError(invalid);
    setBusy(true);
    const result = await sendJson("/api/me/password", "POST", form);
    setBusy(false);
    if (result.error) {
      // 지금 비밀번호가 틀렸으면 그 칸만 비워 다시 쓰게 한다.
      if (result.field === "current") set("current", "");
      return setError({ field: result.field ?? "current", message: result.error });
    }
    onSaved();
  }

  return (
    <form className={styles.edit} onSubmit={submit} noValidate>
      <Field
        id="me-pw-current"
        label="지금 비밀번호"
        type="password"
        value={form.current}
        onChange={(e) => set("current", e.target.value)}
        autoComplete="current-password"
        error={errorFor("current")}
        autoFocus
      />
      <Field
        id="me-pw-next"
        label="새 비밀번호"
        type="password"
        placeholder="8자 이상"
        value={form.next}
        onChange={(e) => set("next", e.target.value)}
        autoComplete="new-password"
        error={errorFor("next")}
      />
      <Field
        id="me-pw-confirm"
        label="새 비밀번호 확인"
        type="password"
        placeholder="한 번 더 입력"
        value={form.confirm}
        onChange={(e) => set("confirm", e.target.value)}
        autoComplete="new-password"
        error={errorFor("confirm")}
      />
      <div className={styles.editRow}>
        <EditButtons busy={busy} onCancel={onCancel} />
      </div>
    </form>
  );
}

function EditButtons({ busy, onCancel }) {
  return (
    <span className={styles.editButtons}>
      <button type="submit" className={`btn ghost small ${styles.pill} ${styles.save}`} disabled={busy}>
        {busy ? "저장하는 중…" : "저장"}
      </button>
      <button type="button" className={styles.cancel} onClick={onCancel}>
        취소
      </button>
    </span>
  );
}

// 로그인 정보: 아이디는 바꿀 수 없고, 이름·비밀번호는 '바꾸기'를 누르면 그 줄 아래에 입력 칸이 열린다.
function LoginInfo() {
  const { user, updateUser } = useAppState();
  const [editing, setEditing] = useState(null);
  const [done, setDone] = useState("");
  const nameButton = useRef(null);
  const passwordButton = useRef(null);

  // 숨길 때 열린 입력 칸(비밀번호 포함)을 닫는다.
  useLayoutEffect(
    () => () => {
      setEditing(null);
      setDone("");
    },
    [],
  );

  function open(which) {
    setDone("");
    setEditing(editing === which ? null : which);
  }

  // 입력 칸이 닫히면 그 줄의 '바꾸기'로 초점을 돌린다.
  function close(message = "") {
    const button = editing === "name" ? nameButton : passwordButton;
    flushSync(() => {
      setEditing(null);
      setDone(message);
    });
    button.current?.focus();
  }

  return (
    <section className={styles.card} aria-labelledby="login-title" data-tour="mypage-login">
      <h2 id="login-title" className={styles.h3}>
        로그인 정보
      </h2>
      <div className={styles.info}>
        <div className={styles.infoRow}>
          <span className="label">아이디</span>
          <span className="mono">{user.loginId}</span>
          <span className={styles.cap}>바꿀 수 없음</span>
        </div>
        <div className={styles.infoRow}>
          <span id="me-name-label" className="label">
            이름
          </span>
          <span className={styles.value}>{user.name}</span>
          <button
            ref={nameButton}
            type="button"
            className={`btn ghost small ${styles.pill}`}
            aria-label="이름 바꾸기"
            aria-expanded={editing === "name"}
            onClick={() => open("name")}
          >
            바꾸기
          </button>
          {editing === "name" && (
            <NameForm
              name={user.name}
              labelId="me-name-label"
              onCancel={() => close()}
              onSaved={(saved) => {
                updateUser({ name: saved.name });
                close("이름 바꿈");
              }}
            />
          )}
        </div>
        <div className={styles.infoRow}>
          <span className="label">비밀번호</span>
          <span className="mono" aria-hidden="true">
            ••••••••
          </span>
          <button
            ref={passwordButton}
            type="button"
            className={`btn ghost small ${styles.pill}`}
            aria-label="비밀번호 바꾸기"
            aria-expanded={editing === "password"}
            onClick={() => open("password")}
          >
            바꾸기
          </button>
          {editing === "password" && (
            <PasswordForm onCancel={() => close()} onSaved={() => close("비밀번호 바꿈 · 다른 기기의 로그인 끊음")} />
          )}
        </div>
      </div>
      <p className={styles.status} role="status">
        {done}
      </p>
    </section>
  );
}

// 진단 기록 변화(작업 I-3): 로그인했고 첫 진단보다 요소를 더 채웠을 때만 한 줄을 보인다. 계산은 lib/diagnosisTrend.js
function DiagnosisGrowth({ at }) {
  const { user } = useAppState();
  const [trend, setTrend] = useState(null);
  useEffect(() => {
    if (!user) return;
    let live = true;
    fetch("/api/me/trend", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setTrend(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [user, at]);
  if (!user || !(trend?.growth > 0)) return null;
  return (
    <p className={styles.growth} data-tour="mypage-growth">
      처음 진단보다 요소 <strong className="mono">{trend.growth}</strong>개 더 채움{" "}
      <span className="muted">
        (<span className="mono">{trend.from}</span>개 → <span className="mono">{trend.to}</span>개)
      </span>
    </p>
  );
}

// 진단 기록(E7 고친 안): 마지막 진단, 채운 요소 수, 진단 변화, 저장 위치, 결과 보기·다시 진단.
// 진단은 첫 화면 입력 칸에서 시작한다.
function DiagnosisCard() {
  const { user, stats, diagnosis } = useAppState();
  const lastDate = formatDate(diagnosis?.at);
  const filled = (diagnosis?.found ?? []).filter((id) => ITEM_IDS.includes(id)).length;
  return (
    <section className={styles.card} aria-labelledby="diag-title">
      <h2 id="diag-title" className={styles.h3}>
        진단 기록
      </h2>
      {diagnosis ? (
        <>
          <dl className={styles.facts}>
            <div>
              <dt>마지막 진단</dt>
              <dd>{lastDate ?? "기록 없음"}</dd>
            </div>
            <div>
              <dt>채운 요소</dt>
              <dd>
                다섯 요소 중 <span className="mono">{filled}</span>개
              </dd>
            </div>
          </dl>
          <DiagnosisGrowth at={diagnosis.at} />
        </>
      ) : (
        <p className={styles.cap}>아직 진단 기록 없음 · 첫 화면 입력 칸에서 진단</p>
      )}
      <p className={styles.cap}>
        {user
          ? stats
            ? `진단 ${stats.diagnoses}번, 실습 ${stats.attempts}번 기록이 계정에 저장됨`
            : "진단과 학습 기록이 계정에 저장됨"
          : "이 기기에 남은 기록만 표시"}
      </p>
      <div className={styles.actions}>
        {diagnosis ? (
          <>
            <Link href="/diagnosis/result" className={`btn small ${styles.pill}`}>
              진단 결과 보기
            </Link>
            <Link href="/" className={`btn ghost small ${styles.pill}`}>
              다시 진단하기
            </Link>
          </>
        ) : (
          <Link href="/" className={`btn small ${styles.pill}`}>
            진단하기
          </Link>
        )}
      </div>
    </section>
  );
}

export default function Mypage() {
  const { ready, authChecked, user, login, profile, record, reset } = useAppState();
  const job = JOB[profile?.job] ? profile.job : null;
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [cleared, setCleared] = useState(false);

  // 서버 렌더 결과와 맞추려고 첫 렌더는 기본값으로 두고, 마운트 뒤에 저장된 설정을 읽는다.
  useEffect(() => {
    const saved = loadSettings();
    queueMicrotask(() => setSettings(saved));
  }, []);

  function update(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setCleared(false);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // 저장소를 못 쓰면 이번 방문 동안만 기억한다.
    }
    if ("largeText" in patch) applyLargeText(next.largeText);
  }

  function clearAll() {
    const where = user ? " 계정에 저장된 기록도 함께 지워짐. 관심 직무와 시험 점수는 남음." : " 관심 직무는 남음.";
    if (!window.confirm(`진단 결과, 학습 기록, 페이지 설정을 모두 지울까?${where} 지우면 되돌릴 수 없음.`)) return;
    reset();
    try {
      localStorage.removeItem(SETTINGS_KEY);
    } catch {
      // 저장소를 못 쓰면 화면의 설정만 기본값으로 돌린다.
    }
    setSettings(DEFAULT_SETTINGS);
    applyLargeText(false);
    setCleared(true);
  }

  return (
    <div className="page">
      <Tour id="mypage" when={ready && authChecked} />
      <div className={styles.column}>
        <h1 className={`display ${styles.pageTitle}`}>내 기록과 설정 관리</h1>

        <JobCard />

        {authChecked && user && (
          <>
            <div className={styles.pair} data-tour="mypage-stats">
              <XpCard record={record} />
              <ExamCard job={job} />
            </div>
            <LoginInfo />
          </>
        )}

        {authChecked && !user && login.ready && (
          <p className={styles.guest}>
            <InfoIcon size={18} />
            <span>
              로그인하면 시험 응시와 랭킹 참여 가능 ·{" "}
              <Link href={authHref("login", "/mypage")} className="link">
                로그인
              </Link>
            </span>
          </p>
        )}

        {ready ? <DiagnosisCard /> : <Skeleton />}

        <section className={styles.card} aria-labelledby="settings-title">
          <h2 id="settings-title" className={styles.h3}>
            페이지 설정
          </h2>
          <p className={styles.cap}>이 브라우저에만 저장. 지금은 글자 크기만 바로 적용.</p>
          <ul className={styles.list}>
            <li>
              <Switch
                id="setting-motion"
                label="움직임 줄이기"
                desc="밑줄 그리기 같은 화면 움직임 줄이기"
                checked={settings.reduceMotion}
                onChange={(v) => update({ reduceMotion: v })}
              />
            </li>
            <li>
              <Switch
                id="setting-large"
                label="글자 크게 보기"
                desc="모든 화면의 글자와 버튼을 조금 크게"
                checked={settings.largeText}
                onChange={(v) => update({ largeText: v })}
              />
            </li>
          </ul>
        </section>

        <section className={styles.card} aria-labelledby="notify-title">
          <h2 id="notify-title" className={styles.h3}>
            알림
          </h2>
          <p className={styles.cap}>아직 실제 알림은 발송되지 않음</p>
          <ul className={styles.list}>
            <li>
              <Switch
                id="notify-study"
                label="학습 알림 받기"
                desc="정한 시간에 오늘 할 미션 알림"
                checked={settings.studyReminder}
                onChange={(v) => update({ studyReminder: v })}
              />
            </li>
            <li className={styles.timeRow}>
              <span id="notify-time-label" className={styles.settingLabel}>
                알림 시간
              </span>
              <div className={`chips ${styles.times}`} role="group" aria-labelledby="notify-time-label">
                {REMINDER_TIMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="chip chip-sm"
                    aria-pressed={settings.reminderTime === t.id}
                    disabled={!settings.studyReminder}
                    onClick={() => update({ reminderTime: t.id })}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </li>
            <li>
              <Switch
                id="notify-weekly"
                label="주간 학습 리포트 이메일"
                desc="한 주 동안 익힌 요소와 다음 연습 요소 발송"
                checked={settings.weeklyReport}
                onChange={(v) => update({ weeklyReport: v })}
              />
            </li>
          </ul>
        </section>

        <section className={styles.card} aria-labelledby="data-title">
          <div className={styles.dataRow}>
            <div className={styles.dataText}>
              <h2 id="data-title" className={styles.h3}>
                데이터
              </h2>
              <p className={styles.cap}>
                {user ? "기록은 계정에, 페이지 설정은 이 브라우저에 저장" : "진단 결과, 학습 기록, 페이지 설정은 이 브라우저에만 저장"}
              </p>
              <p className="small" role="status">
                {cleared ? "기록 모두 지움" : ""}
              </p>
            </div>
            <button type="button" className={`btn ghost small ${styles.pill} ${styles.danger}`} onClick={clearAll}>
              기록 모두 지우기
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
