"use client";

// 시험 보는 중(보드 L4 프롬프트, L5 상황마다 고르기)과 시간이 끝났을 때 알림 창(L8).
// 맨 위 띠: 시험 이름 · n / 6 · 진행 점 · 남은 시간(1분 안 남으면 숫자만 오류 색). 아래는 문제 카드와 이전·다음.
// 채점 기준은 보여 주지 않는다. 문제 사이를 오가도 답은 그대로 둔다. 6번에서 주 버튼이 '제출하고 채점 받기'가 된다.
// questions는 서버가 정답을 빼고 보낸 것(lib/server/exams/index.js publicExam).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowIcon, BackIcon, CheckIcon } from "@/components/Common";
import { MiniBar } from "@/components/lessonBits";
import { analyze } from "@/lib/anatomy";
import { lastAnswered, MAX_TEXT } from "@/lib/examScore";
import { clock, EXAM_AREAS } from "@/data/exams";
import { TimerIcon } from "../parts";
import s from "../exam.module.css";

const isAnswered = (q, answer) => lastAnswered({ questions: [q] }, [answer]) === 1;

// 1·6번: 큰 입력 칸 + 다섯 요소 막대(미션과 같은 분석기)
function WriteAnswer({ q, value, onChange }) {
  const text = value?.text ?? "";
  const found = useMemo(() => analyze(text).found, [text]);
  return (
    <>
      <textarea
        className={s.textarea}
        value={text}
        maxLength={MAX_TEXT}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder={q.placeholder ?? "AI에게 말하듯 그대로 쓰기"}
        aria-label={`${q.index + 1}번 답 프롬프트`}
        spellCheck={false}
      />
      <div className={s.editorFoot}>
        <MiniBar found={found} />
        <span className={s.cap}>채점 기준은 다 낸 뒤 공개</span>
      </div>
    </>
  );
}

// 칸 고르기 알약. 고른 것은 옅은 면 + 굵은 진한 테두리 + 체크. 다시 누르면 뺀다.
function BinPills({ card, bins, value, onPick }) {
  return (
    <div className={s.options} role="group" aria-label={card.text}>
      {bins.map((bin) => {
        const on = value === bin.id;
        return (
          <button key={bin.id} type="button" className={s.option} aria-pressed={on} onClick={() => onPick(on ? null : bin.id)}>
            {on && <CheckIcon />}
            {bin.title}
          </button>
        );
      })}
    </div>
  );
}

// 2번(정보 카드 나누기)은 한 줄에 카드 하나, 5번(상황마다 고르기)은 상황 카드 2열.
function CardsAnswer({ q, value, onChange }) {
  const placed = value?.placed ?? {};
  const grid = q.kind === "choose";
  const count = q.cards.filter((c) => placed[c.id]).length;
  function pick(cardId, binId) {
    const next = { ...placed };
    if (binId) next[cardId] = binId;
    else delete next[cardId];
    onChange({ placed: next });
  }
  return (
    <>
      <ul className={grid ? s.sitGrid : s.sortList}>
        {q.cards.map((card) => (
          <li key={card.id} className={grid ? s.sit : s.sortRow}>
            <p className={s.cardText}>{card.text}</p>
            <BinPills card={card} bins={q.bins} value={placed[card.id]} onPick={(binId) => pick(card.id, binId)} />
          </li>
        ))}
      </ul>
      <p className={s.counter}>
        {grid ? "고른 카드" : "나눈 카드"}{" "}
        <b>
          {count} / {q.cards.length}
        </b>
      </p>
    </>
  );
}

function Material({ material }) {
  return (
    <section className={s.material} aria-labelledby="exam-material">
      <h3 id="exam-material" className={s.materialTitle}>
        {material.title}
      </h3>
      {material.subtitle && <p className={s.cap}>{material.subtitle}</p>}
      {material.kind === "table" ? (
        <table className={s.mtable}>
          <thead>
            <tr>
              {material.columns.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {material.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className={s.mlines}>
          {material.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

// 3·4번: 왼쪽 자료, 오른쪽 AI가 쓴 글. 문장을 누르면 고르고 다시 누르면 뺀다(줄을 긋지 않는다).
function PickAnswer({ q, value, onChange }) {
  const picks = value?.picks ?? [];
  const toggle = (i) =>
    onChange({ picks: picks.includes(i) ? picks.filter((p) => p !== i) : [...picks, i].sort((a, b) => a - b) });
  return (
    <div className={s.pickLayout}>
      <Material material={q.material} />
      <section className={s.material} aria-labelledby="exam-ai-text">
        <h3 id="exam-ai-text" className={s.materialTitle}>
          {q.answerTitle}
        </h3>
        <ol className={s.sentences}>
          {q.sentences.map((text, i) => {
            const on = picks.includes(i);
            return (
              <li key={i}>
                <button type="button" className={s.sentence} aria-pressed={on} onClick={() => toggle(i)}>
                  <span className={s.sentenceNo} aria-hidden="true">
                    {on ? <CheckIcon /> : i + 1}
                  </span>
                  <span>{text}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className={s.counter}>
          고른 문장 <b>{picks.length}</b>개
        </p>
      </section>
    </div>
  );
}

function Answer({ q, value, onChange }) {
  if (q.kind === "prompt" || q.kind === "template") return <WriteAnswer q={q} value={value} onChange={onChange} />;
  if (q.kind === "sort" || q.kind === "choose") return <CardsAnswer q={q} value={value} onChange={onChange} />;
  return <PickAnswer q={q} value={value} onChange={onChange} />;
}

// 시간 종료 알림 창(L8). 뒤는 어둡게 막고, Esc로 닫히지 않는다. 버튼은 '결과 보기' 하나.
// 내기에 실패하면(로그인이 풀렸거나 서버 오류) 창에 갇히지 않게 그때만 테두리 '나가기'를 보인다.
// 다른 화면으로 가면 이 화면은 숨겨질 뿐 남아 있어서, 숨길 때 창을 닫아야 다른 화면이 막히지 않는다(useLayoutEffect 정리).
function TimeUpDialog({ count, busy, error, onSubmit, onLeave }) {
  const ref = useRef(null);
  const buttonRef = useRef(null);
  const hidden = useRef(false);

  useLayoutEffect(() => {
    const dialog = ref.current;
    hidden.current = false;
    if (!dialog.open) dialog.showModal();
    buttonRef.current?.focus();
    return () => {
      hidden.current = true;
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={s.timeUp}
      aria-labelledby="time-up-title"
      aria-describedby="time-up-desc"
      onCancel={(e) => e.preventDefault()}
      // 브라우저가 Esc를 두 번 눌렀을 때 막지 않고 닫는 경우가 있어, 시간이 끝난 동안에는 다시 연다.
      onClose={(e) => !hidden.current && e.currentTarget.isConnected && e.currentTarget.showModal()}
    >
      <span className={s.timeIcon}>
        <TimerIcon size={26} />
      </span>
      <h2 id="time-up-title" className={s.timeTitle}>
        시간 종료
      </h2>
      <p id="time-up-desc" className={s.timeDesc}>
        {count > 0 ? `${count}번까지 푼 답으로 채점` : "푼 답 없음 · 0점으로 채점"}
      </p>
      <button ref={buttonRef} type="button" className={`${s.primary} ${s.wide}`} onClick={onSubmit} disabled={busy}>
        {busy ? "채점하는 중…" : "결과 보기"}
      </button>
      {error && (
        <>
          <p className={s.error} role="alert">
            {error}
          </p>
          <button type="button" className={`${s.secondary} ${s.wide} ${s.leave}`} onClick={onLeave} disabled={busy}>
            나가기
          </button>
        </>
      )}
    </dialog>
  );
}

// onGrade(answers): 답을 내고 채점 결과를 돌려준다(한 시간이 지난 시작 정보면 null). onShow(result): 결과 화면으로.
export function Taking({ title, questions, startedAt, deadline, practice, onGrade, onShow, onLeave }) {
  const [answers, setAnswers] = useState(() => questions.map(() => null));
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(startedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const leftMs = deadline - now;
  const timeUp = leftMs <= 0;
  const left = Math.max(0, Math.ceil(leftMs / 1000));

  // 남은 시간은 시작 시각으로 센다. 화면을 숨겼다 다시 보여도(타이머가 멈췄다 다시 돌아도) 맞는 시간이 나온다.
  useEffect(() => {
    if (timeUp) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timeUp]);

  const q = questions[index];
  const area = EXAM_AREAS.find((a) => a.id === q.area) ?? EXAM_AREAS[index];
  const last = index === questions.length - 1;

  function setAnswer(value) {
    setAnswers((list) => list.map((a, i) => (i === index ? value : a)));
  }

  function go(next) {
    setIndex(next);
    window.scrollTo({ top: 0 });
  }

  // 시간이 끝나면 그때까지의 답을 바로 낸다. 서버는 5분이 조금 지나기 전에 낸 답만 처음 점수로 친다.
  // 결과는 알림 창의 '결과 보기'를 누를 때 보인다. 내기에 실패했으면 누를 때 다시 낸다.
  const early = useRef(null);
  useEffect(() => {
    if (!timeUp || early.current) return;
    early.current = onGrade(answers);
    early.current.catch(() => {});
  }, [timeUp, answers, onGrade]);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const data = await (early.current ?? onGrade(answers));
      if (data) onShow(data);
    } catch (e) {
      early.current = null;
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className={s.band}>
        <h1 className={s.bandTitle}>{title}</h1>
        {practice && <span className={s.tag}>연습</span>}
        <span className={s.count}>
          {index + 1} / {questions.length}
        </span>
        <ol className={s.dots} aria-label="문제 진행">
          {questions.map((item, i) => {
            const done = isAnswered(item, answers[i]);
            return (
              <li key={i} className={i === index ? s.dotNow : done ? s.dotDone : undefined}>
                <span className={s.srOnly}>
                  {i + 1}번 {i === index ? "지금 문제" : done ? "푼 문제" : "안 푼 문제"}
                </span>
              </li>
            );
          })}
        </ol>
        <p className={`${s.timer} ${left < 60 ? s.low : ""}`} role="timer" aria-label={`남은 시간 ${clock(left)}`}>
          <TimerIcon size={26} />
          {clock(left)}
        </p>
      </div>

      <section className={`${s.card} ${s.qCard}`} aria-labelledby="exam-question">
        <h2 id="exam-question" className={s.lbl}>
          {index + 1}번 · {area.name} · {q.way}
        </h2>
        <div className={s.todo}>
          <span className={s.lbl}>할 일</span>
          <p>{q.task}</p>
        </div>
        <Answer key={index} q={q} value={answers[index]} onChange={setAnswer} />
      </section>

      <div className={s.nav}>
        <button type="button" className={s.secondary} onClick={() => go(index - 1)} disabled={index === 0}>
          <BackIcon />
          이전
        </button>
        {last ? (
          <button type="button" className={`${s.primary} ${s.push}`} onClick={submit} disabled={busy}>
            {busy ? "채점하는 중…" : "제출하고 채점 받기"}
            {!busy && <ArrowIcon />}
          </button>
        ) : (
          <button type="button" className={`${s.primary} ${s.push}`} onClick={() => go(index + 1)}>
            다음 문제
            <ArrowIcon />
          </button>
        )}
      </div>
      {error && !timeUp && (
        <p className={`${s.error} ${s.navError}`} role="alert">
          {error}
        </p>
      )}

      {timeUp && (
        <TimeUpDialog
          count={lastAnswered({ questions }, answers)}
          busy={busy}
          error={error}
          onSubmit={submit}
          onLeave={onLeave}
        />
      )}
    </>
  );
}
