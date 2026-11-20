"use client";

import { useState } from "react";
import Link from "next/link";
import { segVar } from "@/components/Anatomy";
import { LessonRunner } from "@/components/LessonRunner";
import { LESSONS, UPCOMING, XP_PER_LESSON } from "@/data/curriculum";
import { ITEM, ITEMS } from "@/lib/items";
import { GUEST, useAppState } from "@/components/AppState";
const LEVELS = ["초급", "중급", "고급"];
const XP_TO_NEXT_LEVEL = LESSONS.length * XP_PER_LESSON;
const MASTERY_STEP = 20;
function RecordPanel({ record, level }) {
  const progress = Math.min(100, Math.round((record.xp / XP_TO_NEXT_LEVEL) * 100));
  const weakest = ITEMS.reduce((min, item) => (record.mastery[item.id] < record.mastery[min.id] ? item : min));
  return (
    <aside className="card record" aria-label="학습 기록">
      <p className="kicker">학습 기록</p>
      <p className="xp">
        <span className="mono">{record.xp}</span>XP
      </p>
      <span className="bar" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </span>
      <p className="small muted">
        {level === "초급" ? `중급까지 ${Math.max(0, XP_TO_NEXT_LEVEL - record.xp)} XP` : `지금 수준: ${level}`}
      </p>

      <h3>요소별 숙련도</h3>
      <ul className="mastery">
        {ITEMS.map((item) => (
          <li key={item.id} style={segVar(item.color)}>
            <span>{item.name}</span>
            <span className="bar">
              <span style={{ width: `${record.mastery[item.id]}%` }} />
            </span>
            <span className="mono">{record.mastery[item.id]}</span>
          </li>
        ))}
      </ul>
      {record.history.length > 0 && (
        <p className="weak" style={segVar(weakest.color)}>
          다음에 연습할 요소 <strong>{weakest.name}</strong> · {weakest.hint}
        </p>
      )}

      <h3>최근 기록</h3>
      {record.history.length === 0 ? (
        <p className="small muted">아직 기록이 없어요. 첫 레슨부터 시작해 보세요.</p>
      ) : (
        <ul className="history">
          {record.history.map((h, i) => (
            <li key={`${h.lessonId}-${i}`}>
              <span>{h.title}</span>
              <span className="history-state">{h.passed ? "통과" : "다시 도전"}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
export default function Learn() {
  const { profile, setProfile, record, updateRecord } = useAppState();
  const me = profile ?? GUEST;
  // 지금은 초급 레슨만 있어서, 진단 수준과 상관없이 초급 탭에서 시작한다.
  const [tab, setTab] = useState("초급");
  const [openId, setOpenId] = useState(null);
  const [leveledUp, setLeveledUp] = useState(false);
  const openIndex = LESSONS.findIndex((l) => l.id === openId);
  const lesson = openIndex >= 0 ? LESSONS[openIndex] : null;
  function recordAttempt(l, grade) {
    const firstPass = grade.passed && !record.completed.includes(l.id);
    updateRecord((r) => {
      const tries = (r.tries[l.id] ?? 0) + 1;
      const mastery = { ...r.mastery };
      for (const id of grade.found) mastery[id] = Math.min(100, mastery[id] + MASTERY_STEP);
      return {
        xp: r.xp + (firstPass ? grade.xp : 0),
        completed: firstPass ? [...r.completed, l.id] : r.completed,
        tries: { ...r.tries, [l.id]: tries },
        mastery,
        history: [{ lessonId: l.id, title: l.title, passed: grade.passed, tries }, ...r.history].slice(0, 6),
      };
    });
    const finishesTrack = firstPass && LESSONS.every((x) => x.id === l.id || record.completed.includes(x.id));
    if (finishesTrack && me.level === "초급") {
      setProfile({ ...me, level: "중급" });
      setLeveledUp(true);
    }
  }
  function openNext() {
    window.scrollTo({ top: 0 });
    setOpenId(openIndex < LESSONS.length - 1 ? LESSONS[openIndex + 1].id : null);
  }
  return (
    <div className="page">
      <header className="page-head">
        <h1 className="display">짧게 배우고, 바로 써 보기</h1>
        <p className="lede">
          강의 하나, 실습 문제 하나, 평가와 피드백까지 5분이면 끝나요. 다섯 요소를 하나씩 익히면 다음 단계가 열려요.
        </p>
      </header>

      {!profile && (
        <p className="notice">
          진단 전이라 초급부터 보여 드려요. <Link href="/">내 수준 진단하기</Link>
        </p>
      )}
      {leveledUp && (
        <p className="levelup" role="status">
          초급 다섯 레슨을 모두 마쳤어요. 이제 중급이에요.
        </p>
      )}

      <div className="learn">
        <div>
          {lesson ? (
            <LessonRunner
              key={lesson.id}
              lesson={lesson}
              alreadyDone={record.completed.includes(lesson.id)}
              isLast={openIndex === LESSONS.length - 1}
              onExit={() => setOpenId(null)}
              onAttempt={(grade) => recordAttempt(lesson, grade)}
              onNext={openNext}
            />
          ) : (
            <>
              <div className="chips level-tabs" role="tablist" aria-label="단계">
                {LEVELS.map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    role="tab"
                    className="chip"
                    aria-selected={tab === lv}
                    onClick={() => setTab(lv)}
                  >
                    {lv}
                    {lv === me.level && <span className="mine">내 수준</span>}
                  </button>
                ))}
              </div>

              {tab === "초급" && me.level !== "초급" && (
                <p className="notice">
                  진단 결과는 {me.level}이에요. 지금은 초급 레슨으로 교육 흐름을 체험해 보세요.
                </p>
              )}
              {tab === "초급" ? (
                <ol className="path">
                  {LESSONS.map((l, i) => {
                    const done = record.completed.includes(l.id);
                    const open = i === 0 || record.completed.includes(LESSONS[i - 1].id);
                    const state = done ? "done" : open ? "current" : "locked";
                    return (
                      <li key={l.id}>
                        <button
                          type="button"
                          className={`node ${state}`}
                          style={segVar(ITEM[l.focus].color)}
                          disabled={state === "locked"}
                          onClick={() => setOpenId(l.id)}
                        >
                          <span className="node-dot">{done ? "✓" : ITEM[l.focus].name}</span>
                          <span className="node-body">
                            <strong>{l.title}</strong>
                            <span>{l.summary}</span>
                            <span className="node-meta">
                              {done
                                ? `완료 · +${XP_PER_LESSON} XP`
                                : state === "locked"
                                  ? "앞 레슨을 마치면 열려요"
                                  : "시작하기 →"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <>
                  <p className="notice">
                    지금은 초급 레슨만 체험할 수 있어요.{" "}
                    <button type="button" className="link" onClick={() => setTab("초급")}>
                      초급 보기
                    </button>
                  </p>
                  <ol className="path">
                    {UPCOMING[tab].map((u) => (
                      <li key={u.id}>
                        <div className="node locked" style={segVar(ITEM[u.focus].color)}>
                          <span className="node-dot">{ITEM[u.focus].name}</span>
                          <span className="node-body">
                            <strong>{u.title}</strong>
                            <span className="node-meta">준비 중</span>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </>
          )}
        </div>
        <RecordPanel record={record} level={me.level} />
      </div>
    </div>
  );
}
