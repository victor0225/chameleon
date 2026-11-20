"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { itemVars } from "@/components/LessonRunner";
import { useAppState } from "@/components/AppState";
import { AuthLinks } from "@/components/AuthLinks";
import { useMyScore } from "@/components/ScoreLine";
import { Tour } from "@/components/Tour";
import { SETTINGS_KEY, applyLargeText } from "@/components/Header";
import { LESSONS, XP_PER_LESSON } from "@/data/curriculum";
import { COURSES } from "@/data/courses";
import { EXPERIENCE, JOB } from "@/data/jobs";
import { ITEMS } from "@/lib/items";
import styles from "./mypage.module.css";

// 마이페이지(디자인 캔버스 E7): 계정·프로필 한 카드 → 학습 현황(경험치·랭킹 점수·완료 미션 세 칸) → 페이지 설정 → 알림 → 데이터.
const ALL_MISSIONS = COURSES.flatMap((c) => c.lessons);
const LEVELS = ["초급", "중급", "고급"];

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

// 진단 변화(작업 I-3): 로그인했고 첫 진단보다 요소를 더 채웠을 때만 한 줄을 보인다. 계산은 lib/diagnosisTrend.js
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

// 계정과 프로필을 한 카드로(이름은 한 번만). 서버에 DB가 없으면 계정 줄(로그인·로그아웃)은 숨긴다.
function Profile({ profile, diagnosis }) {
  const { authChecked, user, login, stats, logout } = useAppState();
  const lastDate = formatDate(diagnosis?.at);
  const accountOn = authChecked && (user || login.ready);
  return (
    <>
      <div className={styles.who}>
        <Avatar />
        <div className={styles.whoText}>
          <h2 id="me-title" className={styles.name}>
            {user?.name || GUEST_NAME}
          </h2>
          <p className={styles.levelLine}>
            <span className={styles.levelBadge}>{profile ? profile.level : "진단 전"}</span>
            <span className="muted">
              프롬프트 수준{user ? ` · ${user.loginId}` : ""}
            </span>
          </p>
        </div>
        {accountOn &&
          (user ? (
            <button type="button" className={`btn ghost small ${styles.right}`} onClick={logout}>
              로그아웃
            </button>
          ) : (
            <div className={styles.right}>
              <AuthLinks next="/mypage" />
            </div>
          ))}
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
          <DiagnosisGrowth at={diagnosis?.at} />
        </>
      ) : (
        <p className={styles.note}>직무와 AI 사용 경험을 고르고 프롬프트 하나를 쓰면 지금 수준 표시</p>
      )}
      {accountOn && (
        <p className={styles.note}>
          {user
            ? stats
              ? `진단 ${stats.diagnoses}번, 실습 ${stats.attempts}번 기록이 계정에 저장됨`
              : "진단과 학습 기록이 계정에 저장됨"
            : "로그인하면 진단·학습 기록이 계정에 저장됨. 다른 기기에서 이어서 하기 가능, 이 브라우저 기록도 함께 옮김"}
        </p>
      )}
      <div className={styles.actions}>
        {diagnosis && (
          <Link href="/diagnosis/result" className="btn small">
            진단 결과 보기
          </Link>
        )}
        <Link href="/diagnosis" className={diagnosis ? "btn ghost small" : "btn small"}>
          {profile ? "다시 진단하기" : "내 수준 진단하기"}
        </Link>
      </div>
    </>
  );
}

// 학습 현황: 경험치(수준 오르기)와 랭킹 점수(처음 푼 점수, 600점 만점)를 이름 붙여 나눈다(공통 칸 ⑨).
function Progress({ record, profile }) {
  const { me, available } = useMyScore();
  const done = ALL_MISSIONS.filter((id) => record.completed.includes(id)).length;
  const level = profile?.level ?? "초급";
  const next = LEVELS[LEVELS.indexOf(level) + 1];
  const left = LESSONS.filter((l) => l.level === level && !record.completed.includes(l.id)).length * XP_PER_LESSON;
  return (
    <>
      <div className={styles.trio} data-tour="mypage-stats">
        <div>
          <p className="label">경험치</p>
          <p className={styles.big}>
            {record.xp}
            <small> XP</small>
          </p>
          <p className={styles.note}>{next ? `${next}까지 ${left} XP` : `${level} 단계`}</p>
        </div>
        <div>
          <p className="label">랭킹 점수</p>
          {me ? (
            <>
              <p className={styles.big}>
                {me.total}
                <small> / {me.max}</small>
              </p>
              <p className={styles.note}>
                {me.rank ? `전체 ${me.rank}위 · ` : "랭킹 참여 전 · "}
                <Link href="/ranking" className="link">
                  랭킹 보기
                </Link>
              </p>
            </>
          ) : (
            <>
              <p className={styles.big}>
                <small>-</small>
              </p>
              <p className={styles.note}>
                {available ? (
                  <Link href="/ranking" className="link">
                    로그인하면 표시 · 랭킹 보기
                  </Link>
                ) : (
                  "로그인 기능이 켜지면 표시"
                )}
              </p>
            </>
          )}
        </div>
        <div>
          <p className="label">완료한 미션</p>
          <p className={styles.big}>
            {done}
            <small> / {ALL_MISSIONS.length}</small>
          </p>
          <p className={styles.note}>통과한 미션</p>
        </div>
      </div>
      <h3 className={`label ${styles.sub}`}>요소별 숙련도</h3>
      <ul className={styles.skills}>
        {ITEMS.map((item) => (
          <li key={item.id} style={itemVars(item.id)}>
            <span className={styles.skillName}>{item.name}</span>
            <span className={styles.skillTrack} aria-hidden="true">
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
    const where = user ? " 계정에 저장된 기록도 함께 지워짐. 랭킹 점수(미션마다 처음 받은 점수)는 남음." : "";
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
      <Tour id="mypage" when={ready} />
      <div className={styles.column}>
        <h1 className={`display ${styles.pageTitle}`}>내 기록과 설정 관리</h1>

        <section className={`card ${styles.section}`} aria-labelledby="me-title" aria-busy={!ready}>
          {ready ? <Profile profile={profile} diagnosis={diagnosis} /> : <Skeleton />}
        </section>

        <section className={`card ${styles.section}`} aria-labelledby="progress-title" aria-busy={!ready}>
          <h2 id="progress-title" className={styles.title}>
            학습 현황
          </h2>
          {ready ? <Progress record={record} profile={profile} /> : <Skeleton />}
        </section>

        <section className={`card ${styles.section}`} aria-labelledby="settings-title">
          <h2 id="settings-title" className={styles.title}>
            페이지 설정
          </h2>
          <p className={styles.note}>이 브라우저에만 저장. 지금은 글자 크기만 바로 적용.</p>
          <ul className={styles.list}>
            <li>
              <Switch
                id="setting-why"
                label="프롬프트 설명 기본으로 보기"
                desc="프롬프트 도우미에서 줄별 이유를 펼쳐 둠"
                checked={settings.showWhy}
                onChange={(v) => update({ showWhy: v })}
              />
            </li>
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

        <section className={`card ${styles.section}`} aria-labelledby="notify-title">
          <h2 id="notify-title" className={styles.title}>
            알림
          </h2>
          <p className={styles.note}>아직 실제 알림은 발송되지 않음</p>
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

        <section className={`card ${styles.section}`} aria-labelledby="data-title">
          <div className={styles.dataRow}>
            <div className={styles.dataText}>
              <h2 id="data-title" className={styles.title}>
                데이터
              </h2>
              <p className={styles.note}>
                {user ? "기록은 계정에, 페이지 설정은 이 브라우저에 저장" : "진단 결과, 학습 기록, 페이지 설정은 이 브라우저에만 저장"}
              </p>
              <p className="small" role="status">
                {cleared ? "기록 모두 지움" : ""}
              </p>
            </div>
            <button type="button" className={`btn ghost small ${styles.danger}`} onClick={clearAll}>
              기록 모두 지우기
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
