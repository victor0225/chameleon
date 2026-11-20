// 시험 화면들(목록, 시험 하나)이 같이 쓰는 조각: API 부르기, 6문제 · 5분 · 600점 알약, 타이머 아이콘.
// 화면 쪽 파일이라 lib/server/exams/*(정답표)는 가져오지 않는다. 문제는 시작할 때 /api/exam/[job]/start로 받는다.
import { EXAM_AREAS, EXAM_MAX, EXAM_SECONDS } from "@/data/exams";
import s from "./exam.module.css";

async function call(url, failMessage, body) {
  let response;
  try {
    response = await fetch(
      url,
      body === undefined
        ? { cache: "no-store" }
        : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
  } catch {
    throw new Error("서버에 연결하지 못함. 인터넷 연결 확인.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw Object.assign(new Error(data?.error || failMessage), { status: response.status, expired: Boolean(data?.expired) });
  }
  return data;
}

// 모양은 app/api/exam/** 머리말을 본다.
export const loadExams = () => call("/api/exam", "시험 기록을 불러오지 못함. 잠시 후 다시 열기.");
export const loadBoard = (job) => call(`/api/exam/${job}`, "랭킹을 불러오지 못함. 잠시 후 다시 열기.");
export const startExam = (job) => call(`/api/exam/${job}/start`, "시험을 시작하지 못함. 잠시 후 다시 시도.", {});
export const submitExam = (job, token, answers) =>
  call(`/api/exam/${job}/submit`, "채점하지 못함. 잠시 후 다시 시도.", { token, answers });
// 랭킹 참가(닉네임 정하기)는 원래 있던 /api/ranking을 쓴다.
export const joinRanking = (nickname) => call("/api/ranking", "저장하지 못함. 잠시 후 다시 시도.", { ranked: true, nickname });

export const PILLS = [`${EXAM_AREAS.length}문제`, `${EXAM_SECONDS / 60}분`, `${EXAM_MAX}점`];

export function Pills({ center = false }) {
  return (
    <ul className={`${s.pills} ${center ? s.pillsCenter : ""}`} aria-label="시험 구성">
      {PILLS.map((p) => (
        <li key={p} className={s.pill}>
          {p}
        </li>
      ))}
    </ul>
  );
}

export function TimerIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2M9 2h6" />
    </svg>
  );
}
