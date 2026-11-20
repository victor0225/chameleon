"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { mergeStates } from "@/lib/syncState";

const STORAGE_KEY = "chameleon-state-v1";

const EMPTY_RECORD = {
  xp: 0,
  completed: [],
  tries: {},
  mastery: { goal: 0, context: 0, constraint: 0, format: 0, criteria: 0 },
  // history: [{ lessonId, title, passed, tries, xp }] 또는 레벨업 { kind: "levelup", title } 최근 6개
  history: [],
  // 닫은 레벨업 배너의 단계("초급" 등). 한 번 닫으면 다시 띄우지 않는다.
  levelUpSeen: [],
};

export const GUEST = { job: "office", experience: "sometimes", level: "초급" };

const AppStateContext = createContext(null);

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// profile:   { job, experience, level } 진단을 마친 사용자
// survey:    { job, experience } 설문 중 답 (진단 1단계 → 2단계로 넘길 때 씀)
// diagnosis: { level, found, missing, comment, segments, source, prompt, task, job, experience, at } 마지막 진단 결과
// ready:     브라우저 저장소를 읽고 난 뒤 true. 그 전에는 "진단 전" 화면을 섣불리 보이지 않는다.
// user:      로그인한 사용자 { id, loginId, name }. 로그인 전이면 null.
// login:     { ready: 서버에 DB와 세션 키가 있어 가입·로그인을 쓸 수 있음 } 로그인 버튼을 보여 줄지 정한다.
// 로그인하면 이 브라우저의 기록과 계정(DB)의 기록을 합치고, 그 뒤로는 바뀔 때마다 계정에 저장한다.
export function AppStateProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [survey, setSurvey] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [record, setRecord] = useState(EMPTY_RECORD);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [login, setLogin] = useState({ ready: false });
  const [authChecked, setAuthChecked] = useState(false);
  const [stats, setStats] = useState(null);
  // 계정 기록과 합치기 전에는 저장하지 않는다. 합치기 전에 저장하면 계정의 기록을 빈 기록으로 덮는다.
  const synced = useRef(false);
  const latest = useRef(null);
  const pending = useRef(null);

  // 새로고침하거나 배포 주소로 다시 들어와도 진단 결과와 학습 기록이 남도록 브라우저에 저장한다.
  // 서버 렌더 결과와 맞추려고 첫 렌더는 빈 상태로 두고, 마운트 뒤에 저장소를 읽는다.
  useEffect(() => {
    const saved = loadSaved();
    queueMicrotask(() => {
      if (saved) {
        setProfile(saved.profile ?? null);
        setSurvey(saved.survey ?? null);
        setDiagnosis(saved.diagnosis ?? null);
        setRecord({ ...EMPTY_RECORD, ...saved.record });
      }
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, survey, diagnosis, record }));
    } catch {
      // 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)에서는 이번 방문 동안만 기억한다.
    }
  }, [ready, profile, survey, diagnosis, record]);

  // 다른 컴포넌트의 effect보다 먼저 최신 상태를 담아 둔다(flush가 이 값을 보낸다).
  useLayoutEffect(() => {
    latest.current = { profile, survey, diagnosis, record };
  });

  // 저장소를 읽은 뒤 한 번, 로그인했는지 묻고 계정 기록과 합친다.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.login) setLogin(data.login);
        if (!data.user) return;
        const merged = mergeStates(latest.current, data.state);
        setProfile(merged.profile ?? null);
        setSurvey(merged.survey ?? null);
        setDiagnosis(merged.diagnosis ?? null);
        setRecord({ ...EMPTY_RECORD, ...merged.record });
        setStats(data.stats ?? null);
        synced.current = true;
        setUser(data.user);
      })
      .catch(() => {
        // 서버에 못 닿으면 로그인 없이 이 브라우저 기록만 쓴다.
      })
      .finally(() => !cancelled && setAuthChecked(true));
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const send = useCallback((keepalive = false) => {
    pending.current = null;
    return fetch("/api/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(latest.current),
      keepalive,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data?.stats && setStats(data.stats))
      .catch(() => {
        // 저장에 실패해도 브라우저에는 남아 있다. 다음 변경 때 다시 보낸다.
      });
  }, []);

  // 로그인한 동안은 바뀔 때마다 잠깐 모았다가 계정에 저장한다.
  useEffect(() => {
    if (!user || !synced.current) return;
    pending.current = setTimeout(() => send(), 600);
    return () => clearTimeout(pending.current);
  }, [user, profile, survey, diagnosis, record, send]);

  // 탭을 닫기 직전에 남은 저장을 보낸다.
  useEffect(() => {
    const onHide = () => pending.current && user && send(true);
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [user, send]);

  // 지금 상태를 바로 저장한다. 개인화 커리큘럼처럼 서버가 최신 기록을 읽어야 할 때 먼저 부른다.
  const flush = useCallback(() => {
    if (!user || !synced.current) return Promise.resolve();
    clearTimeout(pending.current);
    return send();
  }, [user, send]);

  function clearLocal() {
    setProfile(null);
    setSurvey(null);
    setDiagnosis(null);
    setRecord(EMPTY_RECORD);
  }

  // 기록 모두 지우기: 로그인했으면 계정의 진단·학습 기록도 지운다.
  function reset() {
    clearLocal();
    if (user) {
      setStats({ diagnoses: 0, attempts: 0 });
      fetch("/api/me", { method: "DELETE" }).catch(() => {});
    }
  }

  // 로그아웃하면 다음 사람이 기록을 보지 않도록 이 브라우저의 기록도 지운다. 계정에는 남아 있다.
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    synced.current = false;
    setUser(null);
    setStats(null);
    clearLocal();
  }


  return (
    <AppStateContext.Provider
      value={{
        ready,
        profile,
        setProfile,
        survey,
        setSurvey,
        diagnosis,
        setDiagnosis,
        record,
        updateRecord: setRecord,
        reset,
        user,
        login,
        authChecked,
        stats,
        flush,
        logout,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const state = useContext(AppStateContext);
  if (!state) throw new Error("useAppState는 AppStateProvider 안에서만 쓸 수 있어요");
  return state;
}
