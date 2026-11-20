"use client";

// 나를 위한 추천 미션(보드 K6-1): 개인화 엔진(lib/personalize.js)이 고른 미션 세 개와 고른 이유.
// 과정 카드와 같은 모양 카드 세 장(표지: 추천 번호·요소 칩·미션 이름 / 아래: 이유 한 줄·시작)이고 1번에만 진한 '시작'.
// 교육 탭과 결과 비교 화면 아래가 이 컴포넌트를 같이 써서 같은 세 장을 보여 준다(작업 O-2, 일부러 중복).
//   로그인: /api/me/curriculum(DB 기록). 손님: 같은 엔진을 브라우저 진단·기록으로(lib/guestPlan.js).
//   읽는 동안이나 못 읽었을 때는 진단에서 빠진 요소의 과정 1 초급 미션으로 자리를 채운다(카드 자리가 비면 안 된다).
// 손님이고 진단도 없으면 그리지 않는다(교육 탭은 그때 '첫 미션' 카드를 대신 보여 준다).
import { useEffect, useMemo, useState } from "react";
import { useAppState } from "@/components/AppState";
import { ElementChip } from "@/components/LessonRunner";
import { COURSE } from "@/data/courses";
import { fallbackItems, guestPlan } from "@/lib/guestPlan";
import s from "./learn.module.css";

// "과정 3", 과정 1이면 "과정 1 · 중급"
const courseLabel = (item) => {
  const course = COURSE[item.course ?? "prompt"];
  return [course && `과정 ${course.no}`, item.level].filter(Boolean).join(" · ");
};

// onOpen(lessonId): 그 미션 열기. tour: 화면 안내가 짚을 data-tour 값.
export function ForYou({ onOpen, tour = "learn-foryou" }) {
  const { ready, user, flush, record, diagnosis } = useAppState();
  const [server, setServer] = useState(null);
  // 미션을 마치거나 새로 진단하면 다시 고른다.
  const key = [user?.id, diagnosis?.at, record.completed.join(","), JSON.stringify(record.history[0] ?? null)].join("|");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // 서버가 방금 바뀐 기록까지 읽도록 먼저 저장한다.
    flush()
      .then(() => fetch("/api/me/curriculum", { cache: "no-store" }))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("FAILED"))))
      .then((data) => !cancelled && setServer({ key, data }))
      .catch(() => !cancelled && setServer({ key, error: true }));
    return () => {
      cancelled = true;
    };
  }, [user, key, flush]);

  const guest = useMemo(() => (!user && diagnosis ? guestPlan({ diagnosis, record }) : null), [user, diagnosis, record]);
  const fallback = useMemo(() => fallbackItems(diagnosis), [diagnosis]);

  if (!ready || (!user && !diagnosis)) return null;

  const loaded = user ? (server?.key === key ? server : null) : { data: guest };
  const plan = loaded?.data;
  const items = plan?.items?.length ? plan.items : fallback;
  const focus = plan?.focus ?? items[0]?.focus ?? null;
  const allDone = plan?.items?.length === 0;

  return (
    <section aria-labelledby={`${tour}-title`} aria-busy={!loaded} data-tour={tour}>
      <div className={s.forYouHead}>
        <h2 id={`${tour}-title`} className={s.h2}>
          나를 위한 추천 미션
        </h2>
        {focus && (
          <span className={s.forYouFocus}>
            먼저 채울 요소 <ElementChip id={focus} />
          </span>
        )}
      </div>
      {allDone && <p className={s.cap}>모든 미션 마침. 시험으로 실력 확인하기.</p>}
      {!allDone && items.length === 0 && (
        <>
          {loaded?.error ? (
            <p className={s.cap}>추천 미션을 불러오지 못함. 잠시 뒤 다시 열기.</p>
          ) : (
            <div className={s.forYouCards} aria-hidden="true">
              {[0, 1, 2].map((k) => (
                <span key={k} className={s.forYouSkeleton} />
              ))}
            </div>
          )}
        </>
      )}
      {!allDone && items.length > 0 && (
        <ol className={s.forYouCards}>
          {items.map((item, i) => (
            <li key={item.lessonId}>
              <button type="button" className={`${s.courseCard} ${s.forYouCard}`} onClick={() => onOpen(item.lessonId)}>
                <span className={`${s.cover} ${s.forYouCover}`}>
                  <span className={s.coverNo}>추천 {i + 1}</span>
                  {item.focus && (
                    <span className={s.forYouChip}>
                      <ElementChip id={item.focus} />
                    </span>
                  )}
                  <b>{item.title}</b>
                </span>
                <span className={s.cardBody}>
                  <span className={s.cardSum}>
                    {courseLabel(item)} · {item.reasons.join(" · ")}
                  </span>
                  <span className={s.forYouGo}>
                    {i === 0 ? (
                      <span className={s.goBtn}>시작</span>
                    ) : (
                      <span className={s.goLink}>
                        시작<span aria-hidden="true"> →</span>
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
