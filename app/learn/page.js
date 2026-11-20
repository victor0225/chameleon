"use client";

// AI 활용 교육. 보드 K6-2(첫 화면, 손님), K6-1(로그인: 나를 위한 추천 미션), C2-1(과정 1), C2-2(과정 2~6 공통 틀), K7(미션).
// 첫 화면: 맨 위 추천 첫 미션(로그인하면 나를 위한 추천 미션 세 장) → 여섯 과정 넘기는 카드 줄, 오른쪽에 떠 있는 학습 기록.
// 미션은 경험치(XP)만 올린다. 관심 직무를 골랐으면 그 직무 상황으로 바꾼 미션을 연다(lib/jobContent.js).
// 과정 화면: 과정 1~6이 같은 미션 줄(번호·요소 칩·상태·XP·시작)과 오른쪽 진행 칸을 쓴다. 과정 1만 초급·중급·고급 탭이 있다.
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ElementChip, LessonRunner, itemVars } from "@/components/LessonRunner";
import { useAppState } from "@/components/AppState";
import { ArrowIcon, BackIcon, ChevronIcon } from "@/components/Common";
import { Tour } from "@/components/Tour";
import { LESSONS, XP_PER_LESSON } from "@/data/curriculum";
import { COURSE, COURSES, findAnyLesson } from "@/data/courses";
import { JOB } from "@/data/jobs";
import { lessonFor } from "@/lib/jobContent";
import { LEVELS, levelOf } from "@/lib/level";
import { courseSignals } from "@/lib/courseSignals";
import { josa } from "@/lib/josa";
import { ITEMS } from "@/lib/items";
import { ForYou } from "./ForYou";
import { authHref } from "@/components/AuthLinks";
import s from "./learn.module.css";

const LEVEL_DESC = {
  초급: "다섯 요소 익히기",
  중급: "자료·예시·순서로 더 정확하게",
  고급: "반복·검토·보안까지 실무처럼",
};
// 레벨업 배너 둘째 줄: 올라간 단계에서 무엇을 하는지
const LEVEL_NEXT_LINE = {
  중급: "중급: 자료·예시·순서로 결과를 더 정확하게.",
  고급: "고급: 반복 업무, 검토, 개인정보까지 실무처럼.",
};
// 숙련도 계산은 아직 정하지 않았다(임시): 제출한 프롬프트에 들어 있던 요소마다 20씩 오른다.
const MASTERY_STEP = 20;
// 요소 칩 자리: 요소가 정해진 미션은 요소 칩, 아니면 해 보기 종류
const KIND_NAME = { prompt: "프롬프트", sort: "카드 분류", choose: "고르기", spot: "오류 찾기", file: "파일" };
const PAGE_SIZE = 3;

const lessonsAt = (level) => LESSONS.filter((l) => l.level === level);
// 강의가 속한 줄: 과정 1은 같은 수준의 다섯 강의, 다른 과정은 그 과정의 강의들
const trackOf = (lesson) =>
  !lesson.course || lesson.course === "prompt" ? lessonsAt(lesson.level) : COURSE[lesson.course].lessons.map(findAnyLesson);
const nextLevel = (level) => LEVELS[LEVELS.indexOf(level) + 1] ?? null;
const allDone = (level, completed) => lessonsAt(level).every((l) => completed.includes(l.id));
const courseLessons = (course) => course.lessons.map(findAnyLesson);

// 학습 기록(K6 오른쪽 떠 있는 칸, C2-1 오른쪽 칸). 경험치(XP)만 보인다. 랭킹은 시험 화면에 있다.
function RecordPanel({ record, myLevel, onOpen, compact = false }) {
  const [openRecent, setOpenRecent] = useState(false);
  const next = nextLevel(myLevel);
  const track = lessonsAt(myLevel);
  const done = track.filter((l) => record.completed.includes(l.id)).length;
  // XP 막대: 지금 수준 다섯 미션 중 마친 만큼 찬다. 손님·처음이면 비어 있다.
  const remaining = (track.length - done) * XP_PER_LESSON;
  const progress = done / track.length;

  // 다음에 연습할 요소(임시): 숙련도가 가장 낮은 요소. 같으면 내 단계에 아직 안 끝낸 강의가 있는 요소부터.
  const openAt = (id, level) => LESSONS.find((l) => l.focus === id && l.level === level && !record.completed.includes(l.id));
  const weakest = [...ITEMS].sort(
    (a, b) => record.mastery[a.id] - record.mastery[b.id] || Number(!openAt(a.id, myLevel)) - Number(!openAt(b.id, myLevel)),
  )[0];
  const practice =
    openAt(weakest.id, myLevel) ?? LESSONS.find((l) => l.focus === weakest.id && !record.completed.includes(l.id)) ?? null;
  const empty = record.history.length === 0 && record.xp === 0;

  return (
    <aside className={`${s.recordCard} ${compact ? "" : s.floating}`} aria-labelledby="record-title" data-tour="learn-record">
      <h2 id="record-title" className={s.h3}>
        학습 기록
      </h2>
      {empty && <p className={s.cap}>아직 기록 없음. 첫 미션부터 시작.</p>}

      <p className={s.xpRow}>
        <span className={s.cap}>XP</span>
        <span className={s.bigNum}>{record.xp}</span>
      </p>
      <span className={s.bar} aria-hidden="true">
        <span style={{ width: `${Math.round(progress * 100)}%` }} />
      </span>
      <p className={s.cap}>
        {next ? (
          <>
            다음 수준까지 <b className={s.mono}>{remaining} XP</b>
          </>
        ) : (
          <>
            {myLevel} 미션 <b className={s.mono}>{done}/{track.length}</b>
          </>
        )}
      </p>

      <h3 className={s.lbl} style={{ marginTop: 18 }}>
        요소별 숙련도
      </h3>
      <ul className={s.skills}>
        {ITEMS.map((item) => (
          <li key={item.id} style={itemVars(item.id)}>
            <span className={s.skillName}>{item.name}</span>
            <span className={s.skillTrack} aria-hidden="true">
              <span style={{ width: `${record.mastery[item.id]}%` }} />
            </span>
            <span className={s.srOnly}>{record.mastery[item.id]}점</span>
          </li>
        ))}
      </ul>

      {!compact && (
        <div className={s.soft}>
          <p className={s.lbl}>다음에 연습할 요소</p>
          <p className={s.nextLine}>
            <ElementChip id={weakest.id} />
            {practice ? (
              <button type="button" className={s.link} onClick={() => onOpen(practice)}>
                {practice.title}
              </button>
            ) : (
              <span className={s.cap}>{weakest.hint}</span>
            )}
          </p>
        </div>
      )}

      {record.history.length > 0 && (
        <>
          <button type="button" className={s.fold} aria-expanded={openRecent} onClick={() => setOpenRecent(!openRecent)}>
            {openRecent ? "접기" : `최근 기록 ${record.history.length}개`}
            <span className={s.foldIcon}>
              <ChevronIcon open={openRecent} />
            </span>
          </button>
          {openRecent && (
            <ul className={s.recent}>
              {record.history.map((h, i) => (
                <li key={`${h.lessonId ?? h.kind}-${i}`}>
                  <span>{h.kind === "levelup" ? h.title : `${h.title} · ${h.passed ? "통과" : "다시 도전"}`}</span>
                  {h.xp > 0 && <span className={s.recentXp}>+{h.xp} XP</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </aside>
  );
}

function LevelUpBanner({ from, job, onStart, onClose }) {
  const to = nextLevel(from);
  return (
    <section className={s.levelup} aria-live="polite" aria-label="레벨업" data-tour-wait="">
      <span className={s.bars} aria-hidden="true">
        {ITEMS.map((item) => (
          <span key={item.id} style={{ background: item.color }} />
        ))}
      </span>
      <div className={s.levelupText}>
        <p className={s.levelupTitle}>
          {to ? `${from} 미션 모두 마침. 이제 ${to}.` : `${from} 미션까지 모두 마침. 이제 시험으로.`}
        </p>
        <p className={s.levelupSub}>{to ? LEVEL_NEXT_LINE[to] : "직무별 AI 활용 시험으로 실력 확인하기."}</p>
      </div>
      {to ? (
        <button type="button" className={s.levelupCta} onClick={onStart}>
          {to} 첫 미션 시작
        </button>
      ) : (
        <Link href={job ? `/exam/${job}` : "/exam"} className={s.levelupCta} onClick={onClose}>
          시험 보러 가기
        </Link>
      )}
      <button type="button" className={s.close} aria-label="안내 닫기" onClick={onClose}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <path d="M4 4l10 10M14 4 4 14" />
        </svg>
      </button>
    </section>
  );
}

// 여섯 과정: 넘기는 카드 줄(C1·E4). 한 번에 세 장씩, 오른쪽 위 ← → 버튼으로 넘긴다.
function CourseCarousel({ completed, recommended }) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(COURSES.length / PAGE_SIZE);
  const from = page * PAGE_SIZE;
  return (
    <section aria-labelledby="courses-title" data-tour="learn-courses">
      <div className={s.sectionHead}>
        <h2 id="courses-title" className={s.h2}>
          여섯 과정
        </h2>
        <div className={s.pager}>
          <span className={`${s.mono} ${s.cap}`}>
            {from + 1}–{Math.min(from + PAGE_SIZE, COURSES.length)} / {COURSES.length}
          </span>
          <button type="button" className={s.pageBtn} aria-label="이전 과정" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <BackIcon />
          </button>
          <button type="button" className={s.pageBtn} aria-label="다음 과정" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
            <ArrowIcon />
          </button>
        </div>
      </div>
      <div className={s.carousel}>
        <ul className={s.carouselTrack} style={{ transform: `translateX(calc(${-page} * (100% + 14px)))` }}>
          {COURSES.map((c, i) => {
            const ids = c.lessons;
            const done = ids.filter((id) => completed.includes(id)).length;
            const shown = i >= from && i < from + PAGE_SIZE;
            return (
              <li key={c.id} inert={!shown}>
                <Link href={`/learn?course=${c.id}`} className={s.courseCard}>
                  <span className={s.cover}>
                    <span className={s.coverNo}>과정 {c.no}</span>
                    {recommended.has(c.id) && <span className={s.recTag}>진단 추천</span>}
                    <b>{c.title}</b>
                  </span>
                  <span className={s.cardBody}>
                    <span className={s.cardSum}>
                      {c.summary}
                      {c.id === "prompt" && <span className={s.cardLevels}>{LEVELS.map((lv) => `${lv} ${lessonsAt(lv).length}`).join(" · ")}</span>}
                    </span>
                    <span className={s.cardMeta}>
                      <span>미션 {ids.length}개</span>
                      <span className={s.bar} aria-hidden="true">
                        <span style={{ width: `${Math.round((done / ids.length) * 100)}%` }} />
                      </span>
                      <span>
                        {done}/{ids.length}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// 미션 줄(과정 1~6 공통): 번호 · 요소 칩(없으면 해 보기 종류) · 제목 · 상태 · XP · 시작. 다음 차례 한 줄에만 진한 '시작'.
function MissionRows({ lessons, record, nextId, onOpen, showSummary = (l) => l.summary }) {
  return (
    <ol className={s.missionRows}>
      {lessons.map((l, i) => {
        const done = record.completed.includes(l.id);
        const tried = !done && (record.tries[l.id] ?? 0) > 0;
        const next = l.id === nextId;
        return (
          <li key={l.id} data-mission-row="">
            <button type="button" className={`${s.missionRow} ${next ? s.nextRow : ""}`} onClick={() => onOpen(l)}>
              <span className={s.rowNo}>{String(i + 1).padStart(2, "0")}</span>
              <span className={s.rowTag}>{l.focus ? <ElementChip id={l.focus} /> : <span className={s.kindTag}>{KIND_NAME[l.kind ?? "prompt"]}</span>}</span>
              <span className={s.rowBody}>
                <b>{l.title}</b>
                <span className={s.cap}>{showSummary(l)}</span>
              </span>
              <span className={s.rowState}>
                {done ? (
                  <span className={s.stateTag}>통과</span>
                ) : tried ? (
                  <span className={s.stateTag}>다시 도전</span>
                ) : next ? (
                  <span className={s.stateTag}>다음 차례</span>
                ) : null}
              </span>
              <span className={s.rowXp}>{l.xp ?? XP_PER_LESSON} XP</span>
              <span className={s.rowGo}>
                {next ? (
                  <span className={s.goBtn}>시작</span>
                ) : (
                  <span className={s.goLink}>
                    {done ? "다시 보기" : "시작"}
                    <span aria-hidden="true"> →</span>
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// 과정 화면 머리(보드 C2-1·C2-2): "과정 N", "{과정} 미션 고르기". 제목 아래 소개 줄은 두지 않는다.
// 과정 2의 메모리 안내(note)는 바깥 AI 서비스 기능이라는 오해를 막는 정보라 제목 아래 띠로 남긴다(메모 C2-2).
function CourseHead({ course }) {
  return (
    <div className={s.courseHead}>
      <p className={s.meta}>과정 {course.no}</p>
      <h1 className={s.title}>{course.title} 미션 고르기</h1>
      {course.note && <p className={s.courseIntro}>{course.note}</p>}
    </div>
  );
}

function BackToCourses() {
  return (
    <Link href="/learn" className={s.backLink}>
      <BackIcon />
      여섯 과정
    </Link>
  );
}

function CourseProgress({ done, total }) {
  return (
    <section className={s.card} aria-labelledby="course-progress">
      <h2 id="course-progress" className={s.h3}>
        이 과정 진행
      </h2>
      <p className={s.xpRow}>
        <span className={s.bigNum}>{done}</span>
        <span className={s.cap}>/ {total} 미션 통과</span>
      </p>
      <span className={s.bar} aria-hidden="true">
        <span style={{ width: `${Math.round((done / total) * 100)}%` }} />
      </span>
    </section>
  );
}

// 과정 2~6 화면(C2-2 공통 틀): 미션 줄과 오른쪽 진행 칸, 같이 해 보면 좋은 미션은 오른쪽 작은 목록.
function CourseDetail({ course, record, onOpen }) {
  const lessons = courseLessons(course);
  const related = course.related.map(findAnyLesson);
  const done = lessons.filter((l) => record.completed.includes(l.id)).length;
  const nextId = lessons.find((l) => !record.completed.includes(l.id))?.id;
  return (
    <>
      <BackToCourses />
      <div className={s.courseLayout}>
        <div>
          <CourseHead course={course} />
          <h2 className={s.listTitle}>
            미션{" "}
            <span className={`${s.mono} ${s.cap}`}>
              {done} / {lessons.length} 통과
            </span>
          </h2>
          <MissionRows lessons={lessons} record={record} nextId={nextId} onOpen={onOpen} showSummary={(l) => `해 보기: ${l.summary}`} />
        </div>
        <aside className={s.aside}>
          <CourseProgress done={done} total={lessons.length} />
          {related.length > 0 && (
            <section className={s.card} aria-labelledby="course-related">
              <h2 id="course-related" className={s.h3}>
                같이 해 보면 좋은 미션
              </h2>
              <p className={s.cap}>다른 과정의 미션</p>
              <ul className={s.related}>
                {related.map((l) => (
                  <li key={l.id}>
                    <button type="button" className={s.relatedRow} onClick={() => onOpen(l)}>
                      <span className={s.cap}>
                        과정 {COURSE[l.course].no}
                        {l.level ? ` · ${l.level}` : ""}
                      </span>
                      <b>
                        {l.title}
                        <span aria-hidden="true"> →</span>
                      </b>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

// 손님·로그인 전 첫 화면 맨 위(C1): 추천 첫 미션 카드 하나와 진한 '시작하기' 하나. 로그인 안내는 그 아래 보조 한 줄.
function FirstMission({ lesson, fromDiagnosis, loginReady, onOpen }) {
  const pos = lessonsAt(lesson.level).findIndex((l) => l.id === lesson.id) + 1;
  const count = lessonsAt(lesson.level).length;
  return (
    <section className={`${s.card} ${s.firstCard}`} aria-labelledby="first-title" data-tour="learn-foryou">
      <div>
        <p className={s.firstMeta}>
          <span className={s.recTag}>{fromDiagnosis ? "진단 추천" : "첫 미션"}</span>
          <span className={s.cap}>
            과정 1 프롬프트 작성 · {lesson.level} · 미션 {String(pos).padStart(2, "0")}/{String(count).padStart(2, "0")}
          </span>
          {lesson.focus && <ElementChip id={lesson.focus} />}
        </p>
        <h2 id="first-title" className={s.h2} style={{ marginTop: 8 }}>
          {lesson.title}
        </h2>
        <p className={s.cap} style={{ fontSize: 15 }}>
          {lesson.summary}
        </p>
      </div>
      <div className={s.firstActions}>
        <button type="button" className={`btn ${s.bigBtn}`} onClick={() => onOpen(lesson)}>
          첫 미션 시작하기
          <ArrowIcon />
        </button>
        {loginReady && (
          <p className={s.cap} style={{ textAlign: "center" }}>
            <Link href={authHref("login", "/learn")} className={s.link}>
              로그인
            </Link>
            하면 기록 저장 · 맞춤 미션 추천
          </p>
        )}
      </div>
    </section>
  );
}

// 주소의 ?course=를 읽는 useSearchParams는 Suspense 안에 있어야 미리 렌더링할 수 있다.
export default function LearnPage() {
  return (
    <Suspense
      fallback={
        <div className={s.page}>
          <h1 className={s.title}>AI 활용 교육</h1>
        </div>
      }
    >
      <Learn />
    </Suspense>
  );
}

function Learn() {
  const router = useRouter();
  const courseParam = useSearchParams().get("course");
  const course = COURSE[courseParam] ?? null;
  const { ready, profile, record, updateRecord, diagnosis, user, login } = useAppState();
  // 수준은 푼 미션으로 계산한다(lib/level.js, 내 정보와 같은 규칙). 한 수준의 미션을 다 통과하면 다음 수준.
  const myLevel = levelOf(record.completed);
  const job = JOB[profile?.job] ? profile.job : null;
  // 탭을 직접 고르기 전에는 내 수준 탭을 연다. 저장된 수준은 마운트 뒤에 읽히니 null로 둔다.
  const [tab, setTab] = useState(null);
  const shown = tab ?? myLevel;
  const [openId, setOpenId] = useState(null);
  const lesson = lessonFor(findAnyLesson(openId), job);
  const track = lesson ? trackOf(lesson) : [];
  const openIndex = track.findIndex((l) => l.id === openId);

  // 레벨업 배너(2-C): 한 단계 다섯 강의를 다 마치고 다음 단계로 올라왔을 때 보여 준다. 닫으면 다시 띄우지 않는다.
  const bannerFrom = ready
    ? ([...LEVELS]
        .reverse()
        .find(
          (lv) =>
            allDone(lv, record.completed) &&
            !record.levelUpSeen.includes(lv) &&
            (nextLevel(lv) === myLevel || (lv === myLevel && !nextLevel(lv))),
        ) ?? null)
    : null;

  function open(l) {
    window.scrollTo({ top: 0 });
    setOpenId(l.id);
  }

  // 다른 과정 화면으로(파일 실습 평가의 "과정 4에서" 링크, 과정 강의에서 나가기)
  function openCourse(id) {
    setOpenId(null);
    window.scrollTo({ top: 0 });
    router.push(id ? `/learn?course=${id}` : "/learn");
  }

  function closeBanner() {
    updateRecord((r) => ({
      ...r,
      levelUpSeen: [...new Set([...r.levelUpSeen, ...LEVELS.filter((lv) => allDone(lv, r.completed))])],
    }));
  }

  function startNextLevel() {
    const to = nextLevel(bannerFrom);
    closeBanner();
    setTab(to);
    const first = lessonsAt(to).find((l) => !record.completed.includes(l.id)) ?? lessonsAt(to)[0];
    open(first);
  }

  function recordAttempt(l, grade) {
    const firstPass = grade.passed && !record.completed.includes(l.id);
    const completed = firstPass ? [...record.completed, l.id] : record.completed;
    const level = firstPass ? levelOf(completed) : myLevel;
    const rose = level !== myLevel;
    updateRecord((r) => {
      const tries = (r.tries[l.id] ?? 0) + 1;
      const mastery = { ...r.mastery };
      for (const id of grade.found) mastery[id] = Math.min(100, mastery[id] + MASTERY_STEP);
      const entries = [{ lessonId: l.id, title: l.title, passed: grade.passed, tries, xp: firstPass ? grade.xp : 0 }];
      if (rose) entries.unshift({ kind: "levelup", title: `${josa(level, ["으로", "로"])} 오름` });
      return {
        ...r,
        xp: r.xp + (firstPass ? grade.xp : 0),
        completed: firstPass ? [...r.completed, l.id] : r.completed,
        tries: { ...r.tries, [l.id]: tries },
        mastery,
        history: [...entries, ...r.history].slice(0, 6),
      };
    });
    if (rose) setTab(null);
  }

  function openNext() {
    window.scrollTo({ top: 0 });
    setOpenId(openIndex < track.length - 1 ? track[openIndex + 1].id : null);
  }

  if (lesson) {
    const own = lesson.course !== "prompt" ? COURSE[lesson.course] : null;
    const isLast = openIndex === track.length - 1;
    return (
      <LessonRunner
        key={lesson.id}
        lesson={lesson}
        position={openIndex + 1}
        total={track.length}
        alreadyDone={record.completed.includes(lesson.id)}
        isLast={isLast}
        backLabel={own ? `과정 ${own.no} · ${own.title}` : undefined}
        metaLabel={own ? `과정 ${own.no}` : `과정 1 · ${lesson.level}`}
        nextLabel={own && isLast ? "과정으로 돌아가기" : undefined}
        onExit={() => (own && course?.id !== own.id ? openCourse(own.id) : setOpenId(null))}
        onAttempt={(grade) => recordAttempt(lesson, grade)}
        onNext={openNext}
        onOpenCourse={openCourse}
      />
    );
  }

  const banner = bannerFrom && <LevelUpBanner from={bannerFrom} job={job} onStart={startNextLevel} onClose={closeBanner} />;

  if (course && course.id !== "prompt") {
    return (
      <div className={s.page}>
        {banner}
        <CourseDetail course={course} record={record} onOpen={open} />
      </div>
    );
  }

  if (!course) {
    const recommended = new Set(ready && diagnosis ? courseSignals({ diagnosis, survey: null }).map((r) => r.course) : []);
    const first =
      lessonsAt(myLevel).find((l) => !record.completed.includes(l.id)) ?? LESSONS.find((l) => !record.completed.includes(l.id)) ?? LESSONS[0];
    return (
      <div className={s.page}>
        {banner}
        <Tour id="learn" />

        <div className={s.landingHead}>
          <h1 className={s.title}>미션으로 AI 활용 연습하기</h1>
          {ready && diagnosis?.prompt && (
            <Link href="/?edit=1" className={s.link}>
              진단 때 쓴 프롬프트 다시 고쳐 보기 →
            </Link>
          )}
        </div>

        <div className={s.landing}>
          <div className={s.landingMain}>
            {user ? (
              <ForYou onOpen={(id) => open(findAnyLesson(id))} />
            ) : (
              ready && <FirstMission lesson={first} fromDiagnosis={Boolean(diagnosis)} loginReady={login.ready} onOpen={open} />
            )}
            <CourseCarousel completed={record.completed} recommended={recommended} />
          </div>
          <RecordPanel record={record} myLevel={myLevel} onOpen={open} />
        </div>
      </div>
    );
  }

  const lessons = lessonsAt(shown);
  const doneCount = LESSONS.filter((l) => record.completed.includes(l.id)).length;
  const harder = LEVELS.indexOf(shown) > LEVELS.indexOf(myLevel);
  // "다음 차례"는 내 수준 이하 탭에서 아직 안 끝낸 첫 미션. 내 수준보다 어려운 탭에는 두지 않는다.
  const nextId = harder ? null : lessons.find((l) => !record.completed.includes(l.id))?.id;

  // 과정 1(C2-1): 수준 탭 + 미션 줄 + 오른쪽 진행·학습 기록
  return (
    <div className={s.page}>
      {banner}
      <BackToCourses />
      <div className={s.courseLayout}>
        <div>
          <CourseHead course={course} />
          <div className={s.tabsRow}>
            <div className={s.tabs} role="tablist" aria-label="수준">
              {LEVELS.map((lv) => (
                <button key={lv} type="button" role="tab" className="chip" aria-selected={shown === lv} onClick={() => setTab(lv)}>
                  {lv}
                  {lv === myLevel && <span className={s.mineTag}>내 수준</span>}
                </button>
              ))}
            </div>
            <span className={s.cap}>
              {shown} · {LEVEL_DESC[shown]}
            </span>
          </div>

          {harder && <p className={s.harder}>내 수준보다 어려운 단계. {josa(myLevel, ["을", "를"])} 먼저 마치면 더 수월함.</p>}

          <h2 className={s.listTitle}>
            미션{" "}
            <span className={`${s.mono} ${s.cap}`}>
              {lessons.filter((l) => record.completed.includes(l.id)).length} / {lessons.length} 통과
            </span>
          </h2>
          <MissionRows lessons={lessons} record={record} nextId={nextId} onOpen={open} />
        </div>
        <aside className={s.aside}>
          <CourseProgress done={doneCount} total={LESSONS.length} />
          <RecordPanel record={record} myLevel={myLevel} onOpen={open} compact />
        </aside>
      </div>
    </div>
  );
}
