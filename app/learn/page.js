"use client";

import { useState } from "react";
import Link from "next/link";
import { segVar } from "@/components/Anatomy";
import { LessonRunner } from "@/components/LessonRunner";
import { LESSONS, XP_PER_LESSON } from "@/data/curriculum";
import { ITEM, ITEMS } from "@/lib/items";
import { GUEST, useAppState } from "@/components/AppState";
const LEVELS = ["초급", "중급", "고급"];
const MASTERY_STEP = 20;
const lessonsAt = (level) => LESSONS.filter((l) => l.level === level);
const nextLevel = (level) => LEVELS[LEVELS.indexOf(level) + 1] ?? null;
// 지금 수준의 강의를 모두 통과했으면 다음 수준으로 올린다. 이미 끝낸 위 단계가 있으면 그만큼 더 오른다.
function levelAfter(level, completed) {
  let lv = level;
  while (nextLevel(lv) && lessonsAt(lv).every((l) => completed.includes(l.id))) lv = nextLevel(lv);
  return lv;
}
function RecordPanel({ record, level }) {
  const track = lessonsAt(level);
  const done = track.filter((l) => record.completed.includes(l.id)).length;
  const next = nextLevel(level);
  const progress = Math.round((done / track.length) * 100);
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
        {next
          ? `다음 수준(${next})까지 ${(track.length - done) * XP_PER_LESSON} XP`
          : `${level} 강의 ${done}/${track.length}`}
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
  const myLevel = LEVELS.includes(me.level) ? me.level : "초급";
  // 탭을 직접 고르기 전에는 내 수준 탭을 연다. 저장된 수준은 마운트 뒤에 읽히니 null로 둔다.
  const [tab, setTab] = useState(null);
  const shown = tab ?? myLevel;
  const [openId, setOpenId] = useState(null);
  // { from, to }: 방금 끝낸 단계와 새 단계. 고급을 모두 마치면 to는 null.
  const [leveledUp, setLeveledUp] = useState(null);
  const lesson = LESSONS.find((l) => l.id === openId) ?? null;
  const track = lesson ? lessonsAt(lesson.level) : [];
  const openIndex = track.findIndex((l) => l.id === openId);
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
    if (!firstPass) return;
    // 레벨업은 올리기만 한다. 진단으로 정해진 수준보다 낮아지지 않는다.
    const completed = [...record.completed, l.id];
    const level = levelAfter(myLevel, completed);
    if (level !== myLevel) {
      setProfile({ ...me, level });
      setLeveledUp({ from: myLevel, to: level });
      setTab(null);
    } else if (!nextLevel(myLevel) && l.level === myLevel && lessonsAt(myLevel).every((x) => completed.includes(x.id))) {
      setLeveledUp({ from: myLevel, to: null });
    }
  }
  function openNext() {
    window.scrollTo({ top: 0 });
    setOpenId(openIndex < track.length - 1 ? track[openIndex + 1].id : null);
  }
  return (
    <div className="page">
      <header className="page-head">
        <h1 className="display">짧게 배우고, 바로 써 보기</h1>
        <p className="lede">
          강의 하나, 실습 문제 하나, 평가와 피드백까지 5분이면 끝나요. 지금 수준의 강의를 모두 마치면 다음 수준으로
          올라가요.
        </p>
      </header>

      {!profile && (
        <p className="notice">
          진단 전이라 초급부터 보여 드려요. <Link href="/">내 수준 진단하기</Link>
        </p>
      )}
      {leveledUp && (
        <p className="levelup" role="status">
          {leveledUp.to
            ? `${leveledUp.from} 다섯 레슨을 모두 마쳤어요. 이제 ${leveledUp.to}이에요.`
            : `${leveledUp.from} 다섯 레슨까지 모두 마쳤어요. 이제 실제 업무에 써 보세요.`}
        </p>
      )}

      <div className="learn">
        <div>
          {lesson ? (
            <LessonRunner
              key={lesson.id}
              lesson={lesson}
              alreadyDone={record.completed.includes(lesson.id)}
              isLast={openIndex === track.length - 1}
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
                    aria-selected={shown === lv}
                    onClick={() => setTab(lv)}
                  >
                    {lv}
                    {lv === myLevel && <span className="mine">내 수준</span>}
                  </button>
                ))}
              </div>

              {LEVELS.indexOf(shown) > LEVELS.indexOf(myLevel) && (
                <p className="notice">
                  내 수준보다 어려운 단계예요. {myLevel} 강의를 먼저 마치면 더 수월해요.{" "}
                  <button type="button" className="link" onClick={() => setTab(myLevel)}>
                    {myLevel} 보기
                  </button>
                </p>
              )}
              <ol className="path">
                {lessonsAt(shown).map((l) => {
                  const done = record.completed.includes(l.id);
                  // 시연을 위해 잠그지 않는다. 아직 안 끝낸 첫 강의만 '지금 할 강의'로 강조한다.
                  const current = !done && lessonsAt(shown).find((x) => !record.completed.includes(x.id))?.id === l.id;
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        className={`node ${done ? "done" : current ? "current" : "open"}`}
                        style={segVar(ITEM[l.focus].color)}
                        onClick={() => setOpenId(l.id)}
                      >
                        <span className="node-dot">{done ? "✓" : ITEM[l.focus].name}</span>
                        <span className="node-body">
                          <strong>{l.title}</strong>
                          <span>{l.summary}</span>
                          <span className="node-meta">{done ? `완료 · +${XP_PER_LESSON} XP` : "시작하기 →"}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>
        <RecordPanel record={record} level={me.level} />
      </div>
    </div>
  );
}
