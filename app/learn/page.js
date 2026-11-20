"use client";

// AI 활용 교육. 첫 화면은 나를 위한 커리큘럼과 여섯 과정 카드(보드 3-1), 과정을 누르면 /learn?course=… (보드 3-2).
// 과정 1(프롬프트 작성)은 지금까지의 초급·중급·고급 탭 화면 그대로다. 디자인 보드 2-A(중급), 2-B(고급), 2-C(레벨업 배너).
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ElementChip, LessonRunner, itemVars } from "@/components/LessonRunner";
import { GUEST, useAppState } from "@/components/AppState";
import { LESSONS, XP_PER_LESSON } from "@/data/curriculum";
import { COURSE, COURSES, findAnyLesson } from "@/data/courses";
import { courseSignals } from "@/lib/courseSignals";
import { josa } from "@/lib/josa";
import { ITEMS } from "@/lib/items";
import { ForYou } from "./ForYou";
import s from "./learn.module.css";

const LEVELS = ["초급", "중급", "고급"];
const LEVEL_DESC = {
  초급: "다섯 요소 익히기",
  중급: "자료·예시·순서로 더 정확하게",
  고급: "반복·검토·보안까지 실무처럼",
};
// 레벨업 배너 둘째 줄: 올라간 단계에서 무엇을 하는지
const LEVEL_NEXT_LINE = {
  중급: "중급에서는 자료·예시·순서로 결과를 더 정확하게 맞춰요.",
  고급: "고급에서는 반복 업무, 검토, 개인정보까지 실무처럼 다뤄요.",
};
// 숙련도 계산은 아직 정하지 않았다(임시): 제출한 프롬프트에 들어 있던 요소마다 20씩 오른다.
const MASTERY_STEP = 20;
const STATUS = { done: "완료", next: "다음", todo: "아직" };

const lessonsAt = (level) => LESSONS.filter((l) => l.level === level);
// 강의가 속한 줄: 과정 1은 같은 수준의 다섯 강의, 다른 과정은 그 과정의 강의들
const trackOf = (lesson) =>
  !lesson.course || lesson.course === "prompt" ? lessonsAt(lesson.level) : COURSE[lesson.course].lessons.map(findAnyLesson);
const nextLevel = (level) => LEVELS[LEVELS.indexOf(level) + 1] ?? null;
const allDone = (level, completed) => lessonsAt(level).every((l) => completed.includes(l.id));

// 지금 수준의 강의를 모두 통과했으면 다음 수준으로 올린다. 이미 끝낸 위 단계가 있으면 그만큼 더 오른다.
function levelAfter(level, completed) {
  let lv = level;
  while (nextLevel(lv) && allDone(lv, completed)) lv = nextLevel(lv);
  return lv;
}

function RecordPanel({ record, myLevel, onOpen }) {
  const next = nextLevel(myLevel);
  const track = lessonsAt(myLevel);
  const done = track.filter((l) => record.completed.includes(l.id)).length;
  // XP 막대(임시 규칙): 다음 단계 문턱(중급 150, 고급 300 XP)까지 내 단계에 남은 강의만큼 비워 둔다.
  const remaining = (track.length - done) * XP_PER_LESSON;
  const threshold = next ? LEVELS.indexOf(next) * track.length * XP_PER_LESSON : 0;
  const progress = next ? (threshold - remaining) / threshold : done / track.length;

  // 다음에 연습할 요소(임시): 숙련도가 가장 낮은 요소. 같으면 내 단계에 아직 안 끝낸 강의가 있는 요소부터.
  // 목록의 "다음"(순서 기준)과 다를 수 있다. 어느 쪽을 따를지는 아직 정하지 않았다.
  const openAt = (id, level) => LESSONS.find((l) => l.focus === id && l.level === level && !record.completed.includes(l.id));
  const weakest = [...ITEMS].sort(
    (a, b) => record.mastery[a.id] - record.mastery[b.id] || Number(!openAt(a.id, myLevel)) - Number(!openAt(b.id, myLevel)),
  )[0];
  const practice =
    openAt(weakest.id, myLevel) ?? LESSONS.find((l) => l.focus === weakest.id && !record.completed.includes(l.id)) ?? null;

  return (
    <aside className={s.record} aria-labelledby="record-title">
      <h2 id="record-title">학습 기록</h2>

      <div className={s.section}>
        <p className={s.xpRow}>
          <span className={s.xp}>{record.xp} XP</span>
          <span className={s.xpLevel}>{myLevel}</span>
        </p>
        <span className={s.track} aria-hidden="true">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
        <span className={s.xpNext}>
          {next ? (
            <>
              다음 수준({next})까지 <strong>{remaining} XP</strong>
            </>
          ) : (
            <>
              {myLevel} 강의 <strong>{done}/{track.length}</strong>
            </>
          )}
        </span>
      </div>

      <div className={s.section}>
        <h3>요소별 숙련도</h3>
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
      </div>

      <div className={s.nextBox}>
        <h3>다음에 연습할 요소</h3>
        <ElementChip id={weakest.id} />
        {practice ? (
          <button type="button" className={s.nextLink} onClick={() => onOpen(practice)}>
            {practice.title}
          </button>
        ) : (
          <span className={s.muted}>{weakest.hint}</span>
        )}
      </div>

      <div className={s.section}>
        <h3>최근 기록</h3>
        {record.history.length === 0 ? (
          <p className={s.muted}>아직 기록이 없어요. 첫 강의부터 시작해 보세요.</p>
        ) : (
          <ul className={s.recent}>
            {record.history.map((h, i) => (
              <li key={`${h.lessonId ?? h.kind}-${i}`}>
                <span>{h.kind === "levelup" ? h.title : `${h.title} · ${h.passed ? "통과" : "다시 도전"}`}</span>
                {h.xp > 0 && <span className={s.recentXp}>+{h.xp} XP</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function LevelUpBanner({ from, onStart, onClose }) {
  const to = nextLevel(from);
  return (
    <section className={s.levelup} aria-live="polite" aria-label="레벨업">
      <span className={s.bars} aria-hidden="true">
        {ITEMS.map((item) => (
          <span key={item.id} style={{ background: item.color }} />
        ))}
      </span>
      <div className={s.levelupText}>
        <p className={s.levelupTitle}>
          {to
            ? `${from} 다섯 레슨을 모두 마쳤어요. 이제 ${josa(to, ["이에요", "예요"])}.`
            : `${from} 다섯 레슨까지 모두 마쳤어요. 이제 실제 업무에 써 보세요.`}
        </p>
        <p className={s.levelupSub}>
          {to ? LEVEL_NEXT_LINE[to] : "프롬프트 도우미에서 내 업무 프롬프트를 바로 만들어 볼 수 있어요."}
        </p>
      </div>
      {to ? (
        <button type="button" className={s.levelupCta} onClick={onStart}>
          {to} 첫 강의 시작
        </button>
      ) : (
        <Link href="/prompt" className={s.levelupCta} onClick={onClose}>
          프롬프트 도우미로
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

const Arrow = () => <span aria-hidden="true">{"\u00a0→"}</span>;

// 과정 화면 머리: 여섯 과정으로 돌아가기, "과정 N", 이름, 한 줄 소개, 메모리 안내 같은 알림
function CourseHead({ course }) {
  return (
    <>
      <Link href="/learn" className={s.backLink}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 3 5 8l5 5" />
        </svg>
        여섯 과정
      </Link>
      <div className={s.courseHead}>
        <span className={s.courseNo}>과정 {course.no}</span>
        <h1 className={s.title}>{course.title}</h1>
        {course.lede && <p className={s.lede}>{course.lede}</p>}
      </div>
      {course.note && (
        <div className={s.courseNote}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <circle cx="10" cy="10" r="8" />
            <path d="M10 9v5M10 6.2v.2" />
          </svg>
          <p>{course.note}</p>
        </div>
      )}
    </>
  );
}

// 첫 화면의 과정 카드(보드 3-1). 준비 중인 과정도 과정 화면으로 가서, 지금 연습할 수 있는 강의를 보여 준다.
function CourseCard({ course, completed, recommended }) {
  if (!course.ready) {
    const now = course.related.map(findAnyLesson)[0];
    return (
      <Link href={`/learn?course=${course.id}`} className={`${s.courseCard} ${s.courseSoon}`}>
        <span className={s.courseTop}>
          <span className={s.courseNo}>과정 {course.no}</span>
          <span className={s.soonTag}>준비 중</span>
        </span>
        <strong className={s.courseName}>{course.title}</strong>
        <span className={s.courseSum}>{course.summary}</span>
        {now && (
          <span className={s.courseNow}>
            지금은 &lsquo;{now.title}&rsquo;로 연습해요
            <Arrow />
          </span>
        )}
      </Link>
    );
  }
  const done = course.lessons.filter((id) => completed.includes(id)).length;
  const total = course.lessons.length;
  return (
    <Link href={`/learn?course=${course.id}`} className={s.courseCard}>
      <span className={s.courseTop}>
        <span className={s.courseNo}>과정 {course.no}</span>
        {recommended && <span className={s.pickTag}>진단 추천</span>}
      </span>
      <strong className={s.courseName}>{course.title}</strong>
      <span className={s.courseSum}>
        {course.summary}
        {course.id === "prompt" && " · 초급·중급·고급"}
      </span>
      <span className={s.courseProgress}>
        <span className={s.courseTrack} aria-hidden="true">
          <span style={{ width: `${Math.round((done / total) * 100)}%` }} />
        </span>
        <span className={s.courseCount}>
          {done} / {total}강
        </span>
      </span>
    </Link>
  );
}

// 과정 상세(보드 3-2): 강의 목록과 같이 보면 좋은 강의. 준비 중인 과정은 같이 보면 좋은 강의만 보여 준다.
function CourseDetail({ course, completed, onOpen }) {
  const lessons = course.lessons.map(findAnyLesson);
  const related = course.related.map(findAnyLesson);
  return (
    <>
      <CourseHead course={course} />
      {!course.ready && (
        <p className={s.notice}>
          <span className={s.soonTag}>준비 중</span>
          강의를 준비하고 있어요. 지금은 아래 강의로 먼저 연습해 보세요.
        </p>
      )}
      {lessons.length > 0 && (
        <section className={s.courseSection} aria-labelledby="course-lessons">
          <h2 id="course-lessons" className={s.coursesTitle}>
            강의
          </h2>
          <ol className={s.courseLessons}>
            {lessons.map((l, i) => {
              const done = completed.includes(l.id);
              return (
                <li key={l.id}>
                  <button type="button" className={s.courseLesson} onClick={() => onOpen(l)}>
                    <span className={`${s.lessonNo} ${done ? s.lessonDone : ""}`}>
                      {done ? (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="완료">
                          <path d="M2.5 7.5 5.5 10.5 11.5 3.5" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className={s.rowBody}>
                      <span className={s.rowTitle}>{l.title}</span>
                      <span className={s.rowSum}>실습: {l.summary}</span>
                    </span>
                    <span className={s.lessonEnd}>
                      <span className={s.lessonXp}>{done ? "완료" : `${l.xp ?? XP_PER_LESSON} XP`}</span>
                      <span className={s.lessonGo}>
                        {done ? "다시 보기" : "시작"}
                        <Arrow />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}
      {related.length > 0 && (
        <section className={s.courseSection} aria-labelledby="course-related">
          <h2 id="course-related" className={s.coursesTitle}>
            같이 보면 좋은 강의
          </h2>
          <ul className={s.relatedList}>
            {related.map((l) => (
              <li key={l.id}>
                <button type="button" className={s.relatedCard} onClick={() => onOpen(l)}>
                  <span className={s.rowBody}>
                    <span className={s.relatedMeta}>
                      과정 {COURSE[l.course].no}
                      {l.level ? ` · ${l.level}` : ""}
                    </span>
                    <span className={s.rowTitle}>{l.title}</span>
                  </span>
                  <span className={s.lessonGo}>
                    보기
                    <Arrow />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
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
  const { ready, profile, setProfile, record, updateRecord, diagnosis } = useAppState();
  const me = profile ?? GUEST;
  const myLevel = LEVELS.includes(me.level) ? me.level : "초급";
  // 탭을 직접 고르기 전에는 내 수준 탭을 연다. 저장된 수준은 마운트 뒤에 읽히니 null로 둔다.
  const [tab, setTab] = useState(null);
  const shown = tab ?? myLevel;
  const [openId, setOpenId] = useState(null);
  const lesson = findAnyLesson(openId);
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
    // 레벨업은 올리기만 한다. 진단으로 정해진 수준보다 낮아지지 않는다.
    const level = firstPass ? levelAfter(myLevel, completed) : myLevel;
    const rose = level !== myLevel;
    updateRecord((r) => {
      const tries = (r.tries[l.id] ?? 0) + 1;
      const mastery = { ...r.mastery };
      for (const id of grade.found) mastery[id] = Math.min(100, mastery[id] + MASTERY_STEP);
      const entries = [{ lessonId: l.id, title: l.title, passed: grade.passed, tries, xp: firstPass ? grade.xp : 0 }];
      if (rose) entries.unshift({ kind: "levelup", title: `${josa(level, ["으로", "로"])} 올랐어요` });
      return {
        ...r,
        xp: r.xp + (firstPass ? grade.xp : 0),
        completed: firstPass ? [...r.completed, l.id] : r.completed,
        tries: { ...r.tries, [l.id]: tries },
        mastery,
        history: [...entries, ...r.history].slice(0, 6),
      };
    });
    if (rose) {
      setProfile({ ...me, level });
      setTab(null);
    }
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
        metaLabel={own ? `과정 ${own.no}` : undefined}
        nextLabel={own && isLast ? "과정으로 돌아가기" : undefined}
        onExit={() => (own && course?.id !== own.id ? openCourse(own.id) : setOpenId(null))}
        onAttempt={(grade) => recordAttempt(lesson, grade)}
        onNext={openNext}
        onOpenCourse={openCourse}
      />
    );
  }

  const banner = bannerFrom && <LevelUpBanner from={bannerFrom} onStart={startNextLevel} onClose={closeBanner} />;

  if (course && course.id !== "prompt") {
    return (
      <div className={s.page}>
        {banner}
        <CourseDetail course={course} completed={record.completed} onOpen={open} />
      </div>
    );
  }

  if (!course) {
    const recommended = new Set(ready && diagnosis ? courseSignals({ diagnosis }).map((r) => r.course) : []);
    return (
      <div className={s.page}>
        {banner}

        <h1 className={s.title}>AI 활용 교육</h1>
        <p className={s.lede}>강의 하나는 강의 → 실습 → 평가·피드백 순서로 진행해요.</p>

        {ready && !profile && (
          <p className={s.notice}>
            진단 전이라 초급부터 보여 드려요. <Link href="/">내 수준 진단하기</Link>
          </p>
        )}
        {ready && diagnosis?.prompt && (
          <p className={s.notice}>
            배운 대로 진단 때 쓴 프롬프트를 직접 고쳐 보면, 고치기 전과 결과를 비교할 수 있어요.
            <Link href="/diagnosis/prompt?edit=1">진단 프롬프트 다시 고쳐 보기</Link>
          </p>
        )}

        <ForYou onOpen={(id) => open(findAnyLesson(id))} />

        <div className={s.layout}>
          <section className={s.list} aria-labelledby="courses-title">
            <h2 id="courses-title" className={s.coursesTitle}>
              여섯 과정
            </h2>
            <ul className={s.courseGrid}>
              {COURSES.map((c) => (
                <li key={c.id}>
                  <CourseCard course={c} completed={record.completed} recommended={recommended.has(c.id)} />
                </li>
              ))}
            </ul>
          </section>
          <RecordPanel record={record} myLevel={myLevel} onOpen={open} />
        </div>
      </div>
    );
  }

  const lessons = lessonsAt(shown);
  const doneCount = lessons.filter((l) => record.completed.includes(l.id)).length;
  const harder = LEVELS.indexOf(shown) > LEVELS.indexOf(myLevel);
  // "다음"은 내 수준 이하 탭에서 아직 안 끝낸 첫 강의. 내 수준보다 어려운 탭은 모두 "아직"으로 둔다.
  const nextId = harder ? null : lessons.find((l) => !record.completed.includes(l.id))?.id;

  // 과정 1: 지금까지의 초급·중급·고급 탭 화면
  return (
    <div className={s.page}>
      {banner}
      <CourseHead course={course} />

      {ready && !profile && (
        <p className={s.notice}>
          진단 전이라 초급부터 보여 드려요. <Link href="/">내 수준 진단하기</Link>
        </p>
      )}

      <div className={s.layout}>
        <section className={s.list} aria-labelledby="level-title">
          <div className={s.tabs} role="tablist" aria-label="수준">
            {LEVELS.map((lv) => (
              <button
                key={lv}
                type="button"
                role="tab"
                className={s.tab}
                aria-selected={shown === lv}
                onClick={() => setTab(lv)}
              >
                {lv}
                {lv === myLevel && <span className={s.mine}>내 수준</span>}
              </button>
            ))}
          </div>

          <div className={s.levelHead}>
            <h2 id="level-title">
              {shown} <span>· {LEVEL_DESC[shown]}</span>
            </h2>
            <span className={s.doneCount}>
              {doneCount} / {lessons.length} 완료
            </span>
          </div>

          {harder && (
            <p className={s.harder}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <circle cx="9" cy="9" r="7.2" />
                <path d="M9 8.2v4.3M9 5.6v.2" />
              </svg>
              내 수준보다 어려운 단계예요. {josa(myLevel, ["을", "를"])} 먼저 마치면 더 수월해요.
            </p>
          )}

          <ol className={s.rows}>
            {lessons.map((l, i) => {
              const status = record.completed.includes(l.id) ? "done" : l.id === nextId ? "next" : "todo";
              return (
                <li key={l.id}>
                  <button type="button" className={`${s.row} ${status === "next" ? s.rowNext : ""}`} onClick={() => open(l)}>
                    <span className={s.no}>{String(i + 1).padStart(2, "0")}</span>
                    <ElementChip id={l.focus} />
                    <span className={s.rowBody}>
                      <span className={s.rowTitle}>{l.title}</span>
                      <span className={s.rowSum}>{l.summary}</span>
                    </span>
                    <span className={`${s.status} ${s[status]}`}>{STATUS[status]}</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--ink-2)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6 3l5 5-5 5" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <RecordPanel record={record} myLevel={myLevel} onOpen={open} />
      </div>
    </div>
  );
}
