"use client";

// 나를 위한 커리큘럼: DB에 쌓인 진단·실습 기록으로 개인화 엔진(lib/personalize.js)이 고른 강의 세 개와 고른 이유.
// 로그인 전에는 로그인하면 무엇을 받는지 한 줄로 알린다. 서버에 DB가 없으면 아무것도 그리지 않는다.
import { useEffect, useState } from "react";
import { useAppState } from "@/components/AppState";
import { ElementChip } from "@/components/LessonRunner";
import { AuthLinks } from "@/components/AuthLinks";
import { josa } from "@/lib/josa";
import { ITEM } from "@/lib/items";
import s from "./learn.module.css";

export function ForYou({ onOpen }) {
  const { authChecked, user, login, flush, record, diagnosis } = useAppState();
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

  if (!authChecked || (!user && !login.ready)) return null;

  if (!user) {
    return (
      <section className={s.forYouCta} aria-labelledby="for-you-title">
        <div>
          <h2 id="for-you-title">나를 위한 커리큘럼</h2>
          <p className={s.muted}>로그인하면 진단과 실습 기록을 보고, 지금 나에게 필요한 미션을 골라 드려요.</p>
        </div>
        <AuthLinks next="/learn" />
      </section>
    );
  }

  const focus = plan?.focus ? ITEM[plan.focus] : null;
  return (
    <section className={s.forYou} aria-labelledby="for-you-title" aria-busy={!plan}>
      <div className={s.forYouHead}>
        <h2 id="for-you-title">나를 위한 커리큘럼</h2>
        {focus && (
          <p className={s.muted}>
            진단과 실습 기록으로 골랐어요. 지금 가장 먼저 채울 요소는
            <span className={s.chipWord}>
              <ElementChip id={focus.id} />
              {josa(focus.name, ["이에요", "예요"]).slice(focus.name.length)}
            </span>
          </p>
        )}
      </div>
      {!plan && (
        <div className={s.forYouList} aria-hidden="true">
          {[0, 1, 2].map((k) => (
            <span key={k} className={s.forYouSkeleton} />
          ))}
        </div>
      )}
      {plan?.error && <p className={s.muted}>커리큘럼을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>}
      {plan?.items?.length === 0 && <p className={s.muted}>모든 미션을 마쳤어요. 프롬프트 도우미에서 실제 업무에 써 보세요.</p>}
      {plan?.items?.length > 0 && (
        <ol className={s.forYouList}>
          {plan.items.map((item, i) => (
            <li key={item.lessonId}>
              <button type="button" className={s.forYouItem} onClick={() => onOpen(item.lessonId)}>
                <span className={s.forYouTop}>
                  <span className={s.no}>{i + 1}</span>
                  <ElementChip id={item.focus} />
                  <span className={s.forYouLevel}>{item.level}</span>
                </span>
                <span className={s.rowTitle}>{item.title}</span>
                <ul className={s.forYouReasons}>
                  {item.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
