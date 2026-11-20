"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { segVar } from "@/components/Anatomy";
import { useAppState } from "@/components/AppState";
import { AuthLinks } from "@/components/AuthLinks";
import { ScoreLine } from "@/components/ScoreLine";
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

// 로그인 전에는 이름을 게스트로 둔다.
const GUEST_NAME = "게스트";

// 기본 프로필: 로고의 카멜레온 머리, 눈동자가 움직이는 GIF(public/avatar-default.gif). 그림은 mypage.module.css에서 넣는다.
function Avatar() {
  return (
    <span className={styles.avatar} aria-hidden="true">
      <span className={styles.avatarFace} />
    </span>
  );
}

function Profile({ profile, diagnosis, name }) {
  const lastDate = formatDate(diagnosis?.at);
  return (
    <>
      <div className={styles.who}>
        <Avatar />
        <div className={styles.whoText}>
          <h2 id="me-title" className={`display ${styles.name}`}>
            {name || GUEST_NAME}
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
        <ScoreLine />
        <p className="small muted">
          완료한 미션 <span className="mono">{done}</span> / <span className="mono">{LESSONS.length}</span>
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

// 계정: 로그인하면 진단·학습 기록이 DB에 저장돼 다른 기기에서도 이어서 할 수 있다. 서버에 DB가 없으면 숨긴다.
function Account() {
  const { authChecked, user, login, stats, logout } = useAppState();
  if (!authChecked || (!user && !login.ready)) return null;

  return (
    <section className={`card ${styles.section}`} aria-labelledby="account-title">
      <div className={styles.dataRow}>
        <div className={styles.dataText}>
          <h2 id="account-title" className={`display ${styles.title}`}>
            계정
          </h2>
          {user ? (
            <>
              <p>
                <strong>{user.name}</strong> <span className="muted">{user.loginId}</span>
              </p>
              <p className="small muted">
                {stats
                  ? `진단 ${stats.diagnoses}번, 실습 ${stats.attempts}번의 기록이 계정에 저장돼 있어요.`
                  : "진단과 학습 기록이 계정에 저장돼요."}
              </p>
            </>
          ) : (
            <p className="small muted">
              로그인하면 진단과 학습 기록이 계정에 저장돼, 다른 기기에서도 이어서 할 수 있어요. 이 브라우저에 있던
              기록도 함께 옮겨요.
            </p>
          )}
        </div>
        {user ? (
          <button type="button" className="btn ghost small" onClick={logout}>
            로그아웃
          </button>
        ) : (
          <AuthLinks next="/mypage" />
        )}
      </div>
    </section>
  );
}

export default function Mypage() {
  const { ready, profile, diagnosis, record, reset, user } = useAppState();
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
    const where = user ? " 계정에 저장된 기록도 함께 지워져요. 랭킹 점수(미션마다 처음 받은 점수)는 남아요." : "";
    if (!window.confirm(`진단 결과, 학습 기록, 페이지 설정을 모두 지울까요?${where} 지우면 되돌릴 수 없어요.`)) return;
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

        <Account />

        <section className={`card ${styles.profile}`} aria-labelledby="me-title" aria-busy={!ready}>
          {ready ? <Profile profile={profile} diagnosis={diagnosis} name={user?.name} /> : <Skeleton />}
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
                desc="정한 시간에 오늘 할 미션을 알려 드려요."
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
              <p className="small muted">
                {user
                  ? "진단 결과와 학습 기록은 계정에도 저장돼요. 페이지 설정은 이 브라우저에만 저장돼요."
                  : "진단 결과, 학습 기록, 페이지 설정은 이 브라우저에만 저장돼요."}
              </p>
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
