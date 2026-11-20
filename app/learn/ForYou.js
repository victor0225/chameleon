"use client";

// 나를 위한 커리큘럼(E4): DB에 쌓인 진단·실습 기록으로 개인화 엔진(lib/personalize.js)이 고른 미션 세 개와 고른 이유.
// 3줄 목록이고 1번에만 진한 '시작'. 로그인한 사람에게만 보인다(로그인 전에는 교육 첫 화면의 추천 첫 미션 카드가 대신한다).
import { useEffect, useState } from "react";
import { useAppState } from "@/components/AppState";
import { ElementChip } from "@/components/LessonRunner";
import { COURSE } from "@/data/courses";
import { ITEM } from "@/lib/items";
import s from "./learn.module.css";

// "과정 3", 과정 1이면 "과정 1 · 중급"
const courseLabel = (item) => {
  const course = COURSE[item.course ?? "prompt"];
  return [course && `과정 ${course.no}`, item.level].filter(Boolean).join(" · ");
};

export function ForYou({ onOpen }) {
  const { user, flush, record, diagnosis } = useAppState();
  const [plan, setPlan] = useState(null);
  // 미션을 마치거나 새로 진단하면 다시 고른다.
  const key = [user?.id, diagnosis?.at, record.completed.join(","), JSON.stringify(record.history[0] ?? null)].join("|");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // 서버가 방금 바뀐 기록까지 읽도록 먼저 저장한다.
    flush()
      .then(() => fetch("/api/me/curriculum", { cache: "no-store" }))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("FAILED"))))
      .then((data) => !cancelled && setPlan(data))
      .catch(() => !cancelled && setPlan({ error: true }));
    return () => {
      cancelled = true;
    };
  }, [user, key, flush]);

  if (!user) return null;

  const focus = plan?.focus ? ITEM[plan.focus] : null;
  return (
    <section aria-labelledby="for-you-title" aria-busy={!plan} data-tour="learn-foryou">
      <div className={s.forYouHead}>
        <h2 id="for-you-title" className={s.h2}>
          나를 위한 커리큘럼
        </h2>
        {focus && (
          <span className={s.forYouFocus}>
            먼저 채울 요소 <ElementChip id={focus.id} />
          </span>
        )}
      </div>
      {!plan && (
        <div className={s.forYouList} aria-hidden="true">
          {[0, 1, 2].map((k) => (
            <span key={k} className={s.forYouSkeleton} />
          ))}
        </div>
      )}
      {plan?.error && <p className={s.cap}>커리큘럼을 불러오지 못함. 잠시 뒤 다시 열기.</p>}
      {plan?.items?.length === 0 && <p className={s.cap}>모든 미션 마침. 프롬프트 도우미에서 실제 업무에 써 보기.</p>}
      {plan?.items?.length > 0 && (
        <ol className={s.forYouList}>
          {plan.items.map((item, i) => (
            <li key={item.lessonId}>
              <button type="button" className={`${s.forYouRow} ${i === 0 ? s.forYouFirst : ""}`} onClick={() => onOpen(item.lessonId)}>
                <span className={`${s.mono} ${s.cap}`}>{i + 1}</span>
                <span>
                  <span className={s.forYouTitle}>
                    {item.focus && <ElementChip id={item.focus} />}
                    {item.title}
                  </span>
                  <span className={s.cap}>
                    {courseLabel(item)} · {item.reasons.join(" · ")}
                  </span>
                </span>
                {i === 0 ? (
                  <span className={s.goBtn}>시작</span>
                ) : (
                  <span className={s.goLink}>
                    시작<span aria-hidden="true"> →</span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
