"use client";

// 시험 목록(작업 L, 보드 L1 로그인 · L2 손님). 직무 카드 다섯 장, 3열. 내 관심 직무 카드가 맨 앞에 '내 직무' 칩.
// 카드 전체가 /exam/<직무>로 가는 링크다. 손님은 내 결과 칸 없이, 제목 아래에 로그인·가입 안내.
// ready: 문제를 써 둔 직무 id 목록(서버 app/exam/page.js가 넘긴다). 없는 직무 카드는 '준비 중'.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppState } from "@/components/AppState";
import { authHref } from "@/components/AuthLinks";
import { InfoIcon } from "@/components/Common";
import { examTitle } from "@/data/exams";
import { JOB, JOBS } from "@/data/jobs";
import { loadExams, Pills } from "./parts";
import s from "./exam.module.css";

// 그림 칸: 옅은 면 위에 진한 선 그림 하나(보드 L1). 요소 색은 쓰지 않는다.
const ART = {
  marketing: (
    <>
      <path d="M8 20h6l14-8v24l-14-8H8z" />
      <path d="M14 28l3 10h5l-3-10" />
      <path d="M34 18c3 2 3 10 0 12" />
      <path d="M38 14c6 4 6 16 0 20" />
    </>
  ),
  office: (
    <>
      <rect x="12" y="6" width="24" height="36" rx="3" />
      <path d="M18 16h12M18 22h12M18 28h8" />
      <path d="M28 34l3 3 5-6" />
    </>
  ),
  cs: (
    <>
      <path d="M10 26v-4a14 14 0 0 1 28 0v4" />
      <rect x="8" y="26" width="7" height="11" rx="3" />
      <rect x="33" y="26" width="7" height="11" rx="3" />
      <path d="M36 37c0 4-4 6-10 6h-2" />
    </>
  ),
  sales: (
    <>
      <rect x="6" y="16" width="36" height="24" rx="3" />
      <path d="M18 16v-4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4" />
      <path d="M6 26h36" />
      <path d="M22 26v4h4v-4" />
    </>
  ),
  dev: (
    <>
      <rect x="6" y="9" width="36" height="28" rx="3" />
      <path d="M19 19l-5 4 5 4M29 19l5 4-5 4M26 17l-4 12" />
      <path d="M18 42h12" />
    </>
  ),
};

function JobArt({ job }) {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ART[job]}
    </svg>
  );
}

// 카드 아래 줄. stat이 없으면 아직 불러오는 중이다.
function CardFoot({ ready, stat, showMine }) {
  if (!ready) return <p className={s.cardFoot}>준비 중</p>;
  return (
    <p className={s.cardFoot}>
      <span>
        응시 <b>{stat ? stat.takers : "-"}</b>명
        {stat?.takers > 0 && (
          <>
            {" "}
            · 평균 <b>{stat.avg}</b>점
          </>
        )}
      </span>
      {showMine &&
        stat &&
        (stat.mine ? (
          <span>
            내 점수 <b>{stat.mine.total}</b> · {stat.mine.rank}위
          </span>
        ) : (
          <span>응시 전</span>
        ))}
    </p>
  );
}

export function ExamList({ ready }) {
  const { profile, user, login, authChecked } = useAppState();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  // 로그인 상태를 안 뒤에 부른다(내 점수는 로그인했을 때만 온다).
  useEffect(() => {
    if (!authChecked) return;
    let live = true;
    loadExams()
      .then((data) => {
        if (!live) return;
        setStats(Object.fromEntries(data.exams.map((e) => [e.job, e])));
        setError("");
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [authChecked, user?.id, version]);

  const myJob = JOB[profile?.job] ? profile.job : null;
  const jobs = myJob ? [JOB[myJob], ...JOBS.filter((j) => j.id !== myJob)] : JOBS;
  const guest = authChecked && !user;

  return (
    <div className={s.page}>
      <h1 className={`display ${s.title}`}>직무별 AI 활용 시험</h1>

      {guest && login.ready && (
        <div className={s.infoBox}>
          <InfoIcon size={18} />
          <p>시험은 로그인 후 응시</p>
          <div className={s.infoActions}>
            <Link href={authHref("login", "/exam")} className={s.outline}>
              로그인
            </Link>
            <Link href={authHref("signup", "/exam")} className={s.outline}>
              가입
            </Link>
          </div>
        </div>
      )}

      {error && (
        <p className={s.notice} role="alert">
          {error}
          <button type="button" className={s.outline} onClick={() => setVersion((v) => v + 1)}>
            다시 불러오기
          </button>
        </p>
      )}

      <ul className={s.grid}>
        {jobs.map((job) => (
          <li key={job.id}>
            <Link href={`/exam/${job.id}`} className={s.examCard}>
              <div className={s.art}>
                {job.id === myJob && <span className={`${s.mine} ${s.artChip}`}>내 직무</span>}
                <JobArt job={job.id} />
              </div>
              <div className={s.cardBody}>
                <h2 className={s.cardTitle}>{examTitle(job.name)}</h2>
                <p className={s.tasks}>{job.examTasks}</p>
                <Pills />
                <CardFoot ready={ready.includes(job.id)} stat={stats?.[job.id]} showMine={Boolean(user)} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
