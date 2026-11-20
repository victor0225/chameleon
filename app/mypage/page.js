"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { segVar } from "@/components/Anatomy";
import { useAppState } from "@/components/AppState";
import { SETTINGS_KEY, applyLargeText } from "@/components/Header";
import { LESSONS } from "@/data/curriculum";
import { EXPERIENCE, JOB } from "@/data/jobs";
import { ITEMS } from "@/lib/items";
import styles from "./mypage.module.css";

// 글자 크게 보기만 실제로 화면에 반영하고, 나머지는 이 브라우저에 저장만 한다.
const DEFAULT_SETTINGS = {
  showWhy: true,
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

function Skeleton() {
  return (
    <div className="skeleton" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

// 로그인이 없어 이름은 게스트로 둔다. 계정이 생기면 이름과 사진만 바꿔 끼우면 된다.
const GUEST_NAME = "게스트";

function Avatar() {
  return (
    <span className={styles.avatar} aria-hidden="true">
      <span className={styles.avatarFace}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="8.5" r="3.8" />
          <path d="M4.8 20c1.3-3.5 4-5.4 7.2-5.4s5.9 1.9 7.2 5.4" />
        </svg>
      </span>
    </span>
  );
}

function Profile({ profile, diagnosis }) {
  const lastDate = formatDate(diagnosis?.at);
  return (
    <>
      <div className={styles.who}>
        <Avatar />
        <div className={styles.whoText}>
          <h2 id="me-title" className={`display ${styles.name}`}>
            {GUEST_NAME}
          </h2>
          {profile ? (
            <p className={styles.levelLine}>
              <span className={styles.levelBadge}>{profile.level}</span>
              프롬프트 수준
            </p>
          ) : (
            <p className="small muted">아직 진단 전이에요</p>
          )}
        </div>
      </div>
      {profile ? (
        <>
          <dl className={styles.facts}>
            <div>
              <dt>관심 직무</dt>
              <dd>{JOB[profile.job]?.name ?? "정보 없음"}</dd>
            </div>
            <div>
              <dt>AI 사용 경험</dt>
              <dd>{EXPERIENCE[profile.experience]?.title ?? "정보 없음"}</dd>
            </div>
            <div>
              <dt>마지막 진단</dt>
              <dd>{lastDate ?? "기록 없음"}</dd>
            </div>
          </dl>
          <div className={styles.actions}>
            {diagnosis && (
              <Link href="/diagnosis/result" className="btn small">
                진단 결과 보기
              </Link>
            )}
            <Link href="/diagnosis" className={diagnosis ? "btn ghost small" : "btn small"}>
              다시 진단하기
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="small muted">직무와 AI 사용 경험을 고르고 프롬프트 하나를 써 보면 지금 수준을 알려 드려요.</p>
          <div className={styles.actions}>
            <Link href="/diagnosis" className="btn small">
              내 수준 진단하기
            </Link>
          </div>
        </>
      )}
    </>
  );
}

function Progress({ record }) {
  const done = LESSONS.filter((l) => record.completed.includes(l.id)).length;
  return (
    <>
      <div className={styles.stats}>
        <p className="xp">
          <span className="mono">{record.xp}</span>XP
        </p>
        <p className="small muted">
          완료한 레슨 <span className="mono">{done}</span> / <span className="mono">{LESSONS.length}</span>
        </p>
      </div>
      <span className="bar" aria-hidden="true">
        <span style={{ width: `${Math.round((done / LESSONS.length) * 100)}%` }} />
      </span>
      <h3 className={styles.sub}>요소별 숙련도</h3>
      <ul className="mastery">
        {ITEMS.map((item) => (
          <li key={item.id} style={segVar(item.color)}>
            <span>{item.name}</span>
            <span className="bar">
              <span style={{ width: `${record.mastery[item.id] ?? 0}%` }} />
            </span>
            <span className="mono">{record.mastery[item.id] ?? 0}</span>
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <Link href="/learn" className="btn ghost small">
          AI 활용 교육으로 가기
        </Link>
      </div>
    </>
  );
}

export default function Mypage() {
  const { ready, profile, diagnosis, record, reset } = useAppState();
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
    if (!window.confirm("진단 결과, 학습 기록, 페이지 설정을 모두 지울까요? 지우면 되돌릴 수 없어요.")) return;
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
      {/* 한 줄로 쌓아 아래로 스크롤하며 본다. 맨 위는 이름과 사진 자리에 내 정보를 담는다. */}
      <div className={styles.column}>
        <h1 className={`display ${styles.pageTitle}`}>마이페이지</h1>

        <section className={`card ${styles.profile}`} aria-labelledby="me-title" aria-busy={!ready}>
          {ready ? <Profile profile={profile} diagnosis={diagnosis} /> : <Skeleton />}
        </section>

        <section className={`card ${styles.section}`} aria-labelledby="progress-title" aria-busy={!ready}>
          <h2 id="progress-title" className={`display ${styles.title}`}>
            학습 현황
          </h2>
          {ready ? <Progress record={record} /> : <Skeleton />}
        </section>

        <section className={`card ${styles.section}`} aria-labelledby="settings-title">
          <h2 id="settings-title" className={`display ${styles.title}`}>
            페이지 설정
          </h2>
          <p className="small muted">이 브라우저에만 저장돼요. 지금은 글자 크기만 바로 바뀌어요.</p>
          <ul className={styles.list}>
            <li>
              <Switch
                id="setting-why"
                label="프롬프트 설명 기본으로 보기"
                desc="프롬프트 도우미에서 줄마다 넣은 이유를 펼쳐 둬요."
                checked={settings.showWhy}
                onChange={(v) => update({ showWhy: v })}
              />
            </li>
            <li>
              <Switch
                id="setting-motion"
                label="움직임 줄이기"
                desc="밑줄이 그려지는 효과 같은 화면 움직임을 줄여요."
                checked={settings.reduceMotion}
                onChange={(v) => update({ reduceMotion: v })}
              />
            </li>
            <li>
              <Switch
                id="setting-large"
                label="글자 크게 보기"
                desc="모든 화면의 글자와 버튼을 조금 크게 보여 줘요."
                checked={settings.largeText}
                onChange={(v) => update({ largeText: v })}
              />
            </li>
          </ul>
        </section>

        <section className={`card ${styles.section}`} aria-labelledby="notify-title">
          <h2 id="notify-title" className={`display ${styles.title}`}>
            알림
          </h2>
          <p className="small muted">아직 실제 알림은 가지 않아요.</p>
          <ul className={styles.list}>
            <li>
              <Switch
                id="notify-study"
                label="학습 알림 받기"
                desc="정한 시간에 오늘 할 레슨을 알려 드려요."
                checked={settings.studyReminder}
                onChange={(v) => update({ studyReminder: v })}
              />
            </li>
            <li className={styles.timeRow}>
              <span id="notify-time-label" className={styles.settingLabel}>
                알림 시간
              </span>
              <div className={`seg-toggle ${styles.times}`} role="group" aria-labelledby="notify-time-label">
                {REMINDER_TIMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
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
                desc="한 주 동안 익힌 요소와 다음에 연습할 요소를 보내 드려요."
                checked={settings.weeklyReport}
                onChange={(v) => update({ weeklyReport: v })}
              />
            </li>
          </ul>
        </section>

        <section className={`card ${styles.section}`} aria-labelledby="data-title">
          <div className={styles.dataRow}>
            <div className={styles.dataText}>
              <h2 id="data-title" className={`display ${styles.title}`}>
                데이터
              </h2>
              <p className="small muted">진단 결과, 학습 기록, 페이지 설정은 이 브라우저에만 저장돼요.</p>
              <p className="small" role="status">
                {cleared ? "기록을 모두 지웠어요." : ""}
              </p>
            </div>
            <button type="button" className="btn ghost small" onClick={clearAll}>
              기록 모두 지우기
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
