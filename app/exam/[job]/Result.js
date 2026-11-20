"use client";

// 시험 결과(보드 L6, 다 낸 직후). 위 요약: 480 / 600 크게, 옆에 30명 중 3위 · 걸린 시간, 아래 처음 점수인지 연습인지 칩.
// 부문별 점수 6줄(막대는 진한 글자색. 요소 색 아님). 만점이 아닌 줄은 펼쳐서 놓친 것과 코칭 질문을 본다. 가장 낮은 줄은 펼쳐 둔다.
// 채점 기준과 정답은 이때 처음 보인다(result.details, lib/examScore.js gradeExam).
import { useState } from "react";
import Link from "next/link";
import { ArrowIcon, ChevronIcon, InfoIcon } from "@/components/Common";
import { ElementChip, MetIcon, MissIcon } from "@/components/lessonBits";
import { COURSE } from "@/data/courses";
import { clock, EXAM_AREAS, EXAM_MAX } from "@/data/exams";
import { weakestArea } from "@/lib/examScore";
import s from "../exam.module.css";

// 놓친 것 한 줄씩: 프롬프트는 못 채운 기준, 카드는 틀린 카드와 정답 칸, 문장 고르기는 놓친 문장 설명과 잘못 고른 문장.
function missLines(detail) {
  if (detail.criteria) return detail.criteria.filter((c) => !c.met).map((c) => ({ label: "놓친 것", text: c.label }));
  if (detail.cards) {
    return detail.cards.filter((c) => !c.right).map((c) => ({ label: "놓친 것", text: `'${c.text}' → ${c.answerTitle}` }));
  }
  const sentences = detail.sentences ?? [];
  return [
    ...sentences.filter((x) => x.status === "missed").map((x) => ({ label: "놓친 것", text: x.miss })),
    ...sentences.filter((x) => x.status === "false").map((x) => ({ label: "잘못 고름", text: `'${x.text}'` })),
  ];
}

function AreaDetail({ id, detail }) {
  const misses = missLines(detail);
  return (
    <div id={id} className={s.detail}>
      {misses.length > 0 && (
        <div className={s.missBox}>
          <span className={s.missIcon} aria-hidden="true">
            <MissIcon size={10} />
          </span>
          <ul>
            {misses.map((m, i) => (
              <li key={i}>
                <b>{m.label}</b> · {m.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {detail.criteria && (
        <div className={s.critBox}>
          <p className={s.lbl}>채점 기준</p>
          <ul className={s.critList}>
            {detail.criteria.map((c) => (
              <li key={c.label}>
                <span className={c.met ? s.icOk : s.icNo}>{c.met ? <MetIcon size={12} /> : <MissIcon size={10} />}</span>
                <span className={s.grow}>{c.label}</span>
                <ElementChip id={c.item} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {detail.question && (
        <div className={s.coach}>
          <p className={s.lbl}>코칭 질문</p>
          <p className={s.coachQ}>{detail.question}</p>
        </div>
      )}
    </div>
  );
}

// result: POST /api/exam/[job]/submit 결과. onRanking: 응시 후 화면의 랭킹 카드로.
export function Result({ title, result, onRanking }) {
  const weak = weakestArea(result.scores);
  const [open, setOpen] = useState(() => new Set(weak ? [EXAM_AREAS.indexOf(weak)] : []));

  function toggle(i) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const first = result.first;
  return (
    <>
      <section className={`${s.card} ${s.summary}`} aria-labelledby="exam-result">
        <h1 id="exam-result" className={s.lbl}>
          {title} · 결과
        </h1>
        <div className={s.scoreLine}>
          <p className={s.big}>
            {result.total}
            <small> / {EXAM_MAX}</small>
          </p>
          <div className={s.rankCol}>
            {result.saved && first && (
              <p className={s.rankText}>
                {result.takers}명 중 {first.rank}위
              </p>
            )}
            <p className={s.cap}>
              걸린 시간 <b className={s.monoInk}>{clock(result.seconds)}</b>
            </p>
          </div>
        </div>
        {result.saved ? (
          <p className={s.ruleChip}>
            <InfoIcon size={18} />
            {result.late && "시간이 지난 뒤 낸 답이라 0점 · "}
            {result.counted || !first
              ? "처음 본 점수라 랭킹에 반영됨"
              : `연습이라 랭킹 점수는 그대로 · 처음 본 점수 ${first.total}`}
          </p>
        ) : (
          <p className={s.notice}>기록 저장 준비 중 · 랭킹 미반영</p>
        )}
      </section>

      <section className={`${s.card} ${s.areasCard}`} aria-labelledby="exam-area-scores">
        <h2 id="exam-area-scores" className={s.h3}>
          부문별 점수
        </h2>
        <ul className={s.scoreRows}>
          {EXAM_AREAS.map((area, i) => {
            const score = result.scores[i] ?? 0;
            const canOpen = score < 100;
            const isOpen = canOpen && open.has(i);
            const head = (
              <>
                <span className={s.areaName}>
                  <b>{area.name}</b>
                  <span className={s.cap}>{area.way}</span>
                </span>
                <span className={s.bar} aria-hidden="true">
                  <i style={{ width: `${score}%` }} />
                </span>
                <span className={s.barScore}>
                  {score}
                  <span className={s.srOnly}>점</span>
                  {canOpen && <ChevronIcon open={isOpen} />}
                </span>
              </>
            );
            return (
              <li key={area.id}>
                {canOpen ? (
                  <button
                    type="button"
                    className={s.scoreRow}
                    aria-expanded={isOpen}
                    aria-controls={`exam-area-${i}`}
                    onClick={() => toggle(i)}
                  >
                    {head}
                  </button>
                ) : (
                  <div className={s.scoreRow}>{head}</div>
                )}
                {isOpen && <AreaDetail id={`exam-area-${i}`} detail={result.details[i]} />}
              </li>
            );
          })}
        </ul>
      </section>

      <div className={s.resultFoot}>
        {weak && (
          <Link href={`/learn?course=${weak.course}`} className={s.lnk}>
            약한 부문 미션 하러 가기 → 과정 {COURSE[weak.course].no} {COURSE[weak.course].title}
          </Link>
        )}
        <button type="button" className={`${s.primary} ${s.push}`} onClick={onRanking}>
          랭킹 보기
          <ArrowIcon />
        </button>
      </div>
    </>
  );
}
