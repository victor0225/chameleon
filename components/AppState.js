"use client";

import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "chameleon-state-v1";

const EMPTY_RECORD = {
  xp: 0,
  completed: [],
  tries: {},
  mastery: { goal: 0, context: 0, constraint: 0, format: 0, criteria: 0 },
  history: [],
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
export function AppStateProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [survey, setSurvey] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [record, setRecord] = useState(EMPTY_RECORD);
  const [ready, setReady] = useState(false);

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

  function reset() {
    setProfile(null);
    setSurvey(null);
    setDiagnosis(null);
    setRecord(EMPTY_RECORD);
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
