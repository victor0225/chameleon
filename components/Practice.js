"use client";

// kind별 해 보기 칸과 피드백 칸. 디자인 캔버스 D5(분류), D12(분류 피드백), D13·D14(고르기), D9·D10(오류 찾기), D8·D7(파일).
// 배우기 → 해 보기 → 피드백 흐름, 채점 요청, 기록 저장은 LessonRunner가 맡고, 여기서는 runner로 받아 쓴다.
//   runner: { stage, grade, busy, error, wasDone, retryNext, submit(extra), setError, go(stage), onNext, nextLabel, onOpenCourse }
// 해 보기와 피드백을 같은 컴포넌트가 그려서, 피드백 뒤 "다시 해 보기"를 누르면 고른 것을 그대로 둔 채 해 보기로 돌아간다.
// 틀: 할 일 → 첫 점수 칩 → 내가 하는 칸(왼쪽)·자료와 기준(오른쪽). 피드백은 공통 머리 칸 → 코칭 질문 → 다시 볼 것 먼저.
import { useMemo, useState } from "react";
import * as api from "@/lib/api";
import { analyze } from "@/lib/anatomy";
import { josa } from "@/lib/josa";
import { countWord, MAX_FILES } from "@/lib/fileRules";
import { ArrowIcon, ChevronIcon, emptyLine, ExampleChip, NO_AI_TEXT, RuleChip } from "./Common";
import { attachedFiles, FileAttach, FileIcon, isUploading } from "./FileAttach";
import {
  CoachCard,
  CriteriaDots,
  CriteriaResult,
  criteriaDesc,
  FeedbackHead,
  MetIcon,
  MiniBar,
  MissIcon,
  PencilIcon,
  TodoCard,
} from "./lessonBits";
import fa from "./fileAttach.module.css";
import l from "./lesson.module.css";
import p from "./practice.module.css";

const WORD = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟"];
const counted = (n, unit) => (WORD[n] ? `${WORD[n]} ${unit}` : `${n}${unit}`);

// ---------- 공용 ----------

// 머리 칸의 주 버튼: 통과면 다음 미션, 아니면 다시 해 보기
function headAction(runner, passed, retry) {
  return passed
    ? { label: runner.nextLabel, onClick: runner.onNext, icon: <ArrowIcon />, iconAfter: true }
    : { label: "다시 해 보기", onClick: retry ?? (() => runner.go("practice")), icon: <PencilIcon /> };
}

function Head({ runner, result, desc, got, total, retry }) {
  return (
    <FeedbackHead
      passed={result.passed}
      desc={desc}
      got={got}
      total={total}
      xp={result.xp}
      wasDone={runner.wasDone}
      action={headAction(runner, result.passed, retry)}
    />
  );
}

function SubmitRow({ runner, note, label = "제출하고 평가 받기", busyLabel = "평가하는 중…", onClick, disabled = false }) {
  return (
    <>
      <div className={l.submitRow}>
        {note && <span className={l.note}>{note}</span>}
        <button type="button" className={l.primary} onClick={onClick} disabled={runner.busy || disabled}>
          {runner.busy ? busyLabel : label}
        </button>
      </div>
      {runner.error && (
        <p className={l.error} role="alert">
          {runner.error}
        </p>
      )}
    </>
  );
}

function Rule({ runner }) {
  return (
    <div>
      <RuleChip retry={runner.retryNext} />
    </div>
  );
}

function BackToLecture({ runner, children }) {
  return (
    <div className={l.after}>
      <button type="button" className={l.secondary} onClick={() => runner.go("lecture")}>
        배우기 다시 보기
      </button>
      {children}
    </div>
  );
}

// 자료 한 줄의 끝이 숫자 값이면(예: "원목 식탁 · 42개 · 3,780만 원") 값만 떼어 오른쪽에 둔다(보드 D9).
function splitValue(line) {
  const at = line.lastIndexOf(" · ");
  const value = at > 0 ? line.slice(at + 3) : "";
  return /^[\d,.]+/.test(value) ? [line.slice(0, at), value] : [line, null];
}

// 해 보기 때 함께 보는 자료: 대화 기록(kind: chat)이나 줄 목록. 오른쪽 칸에 둔다.
export function MaterialPanel({ material }) {
  return (
    <section className={`${l.card} ${p.material}`} aria-labelledby="material">
      <h2 id="material" className={l.cardTitle}>
        {material.title}
      </h2>
      <p className={p.materialSub}>{material.subtitle}</p>
      {material.kind === "chat" ? (
        <ol className={p.chat}>
          {material.lines.map(([who, text], i) => (
            <li key={i} className={who === "AI" ? p.fromAi : p.fromMe}>
              <span className={p.who}>{who}</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className={p.lines}>
          {material.lines.map((t) => {
            const [label, value] = splitValue(t);
            return (
              <li key={t} className={value ? p.valueLine : undefined}>
                <span>{label}</span>
                {value && <span className={p.value}>{value}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function HandIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1.5a1.5 1.5 0 0 1 3 0V12m0-.5a1.5 1.5 0 0 1 3 0V13m0-.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.6-2.2L4.5 16a1.6 1.6 0 0 1 2.4-2.1L8 15" />
    </svg>
  );
}

// ---------- sort: 카드를 칸으로 나누기 (D5, D12) ----------

export function PracticeSort({ lesson, runner }) {
  const { stage, grade } = runner;
  const [placed, setPlaced] = useState({});
  const [picked, setPicked] = useState(null);
  const result = stage === "result" && grade?.cards ? grade : null;
  const right = result ? Object.fromEntries(result.cards.map((c) => [c.id, c.right])) : null;
  const coach = result?.coaching;
  const pool = lesson.cards.filter((c) => !placed[c.id]);

  function place(cardId, binId) {
    if (!lesson.cards.some((c) => c.id === cardId)) return;
    setPlaced((prev) => {
      const next = { ...prev };
      if (binId) next[cardId] = binId;
      else delete next[cardId];
      return next;
    });
    setPicked(null);
  }

  const dropProps = (binId) =>
    result
      ? {}
      : {
          onDragOver: (e) => e.preventDefault(),
          onDrop: (e) => {
            e.preventDefault();
            place(e.dataTransfer.getData("text/plain"), binId);
          },
        };

  // 카드 하나. 컴포넌트로 만들면 그릴 때마다 새로 붙어 포커스가 풀리니 함수로 그린다.
  const renderCard = (card) => {
    if (result) {
      const ok = right[card.id];
      return (
        <li key={card.id} className={`${p.sortCard} ${p.graded} ${ok ? "" : p.wrong} ${coach?.card === card.id ? p.coached : ""}`}>
          <span className={`${p.mark} ${ok ? p.markOk : p.markBad}`}>{ok ? <MetIcon size={12} /> : <MissIcon size={10} />}</span>
          <span>{card.text}</span>
        </li>
      );
    }
    return (
      <li key={card.id}>
        <button
          type="button"
          className={`${p.sortCard} ${p.movable}`}
          aria-pressed={picked === card.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", card.id);
            setPicked(card.id);
          }}
          onClick={() => setPicked(picked === card.id ? null : card.id)}
        >
          {card.text}
        </button>
      </li>
    );
  };

  let head = null;
  if (result) {
    const { right: n, total } = result.score;
    const wrong = total - n;
    const desc = result.passed
      ? `${total}장 중 ${n}장 맞게 나눔.${wrong ? ` 틀린 ${counted(wrong, "장")}도 아래에서 확인.` : ""}`
      : `${total}장 중 ${n}장 맞게 나눔. ${result.criteria[1].met ? `${lesson.pass.min}장 이상 맞혀야 통과.` : lesson.mustNote}`;
    head = <Head runner={runner} result={result} desc={desc} got={n} total={total} />;
  }

  return (
    <>
      {result ? (
        head
      ) : (
        <>
          <TodoCard lesson={lesson}>
            <p className={p.how}>
              <HandIcon />
              카드 선택 후 놓을 칸의 &lsquo;여기에 놓기&rsquo; 누르기 (끌어다 놓기도 가능)
            </p>
          </TodoCard>
          <Rule runner={runner} />
        </>
      )}
      {coach && <CoachCard question={coach.question} hint={coach.detail} />}
      {result?.leftover && (
        <p className={p.leftover}>
          <b>{result.leftover.question}</b> {result.leftover.detail}
        </p>
      )}

      {!result && (
        <section className={`${p.pool} ${picked && placed[picked] ? p.poolTarget : ""}`} aria-labelledby="pool-h" {...dropProps(null)}>
          <h2 id="pool-h" className={l.smallTitle}>
            {pool.length ? (
              <>
                남은 카드 <span className={l.mono}>{pool.length}</span>장
              </>
            ) : (
              "카드를 모두 놓음"
            )}
          </h2>
          {pool.length > 0 && <ul className={p.poolCards}>{pool.map(renderCard)}</ul>}
          {picked && placed[picked] && (
            <button type="button" className={p.dropHere} onClick={() => place(picked, null)}>
              남은 카드로 되돌리기
            </button>
          )}
        </section>
      )}

      <div className={p.bins}>
        {lesson.bins.map((bin) => {
          const cards = lesson.cards.filter((c) => placed[c.id] === bin.id);
          return (
            <section key={bin.id} className={p.bin} aria-labelledby={`bin-${bin.id}`} {...dropProps(bin.id)}>
              <div>
                <h3 id={`bin-${bin.id}`} className={p.binTitle}>
                  {bin.title}
                </h3>
                <p className={l.note}>{bin.desc}</p>
              </div>
              {cards.length > 0 && <ul className={p.binCards}>{cards.map(renderCard)}</ul>}
              {!result && picked && placed[picked] !== bin.id && (
                <button type="button" className={p.dropHere} onClick={() => place(picked, bin.id)}>
                  여기에 놓기
                </button>
              )}
              {coach?.to === bin.id && <p className={p.ghost}>여기로 옮겨 보면?</p>}
            </section>
          );
        })}
      </div>

      {result ? (
        <BackToLecture runner={runner} />
      ) : (
        <SubmitRow
          runner={runner}
          note={pool.length ? `카드 ${pool.length}장을 더 놓으면 제출 가능` : null}
          disabled={pool.length > 0}
          onClick={() => runner.submit({ answer: placed })}
        />
      )}
    </>
  );
}

// ---------- choose: 항목마다 방법 고르기 (D13 표, D14 피드백) ----------

export function PracticeChoose({ lesson, runner }) {
  const { stage, grade } = runner;
  const [chosen, setChosen] = useState({});
  const result = stage === "result" && grade?.cards ? grade : null;
  const right = result ? Object.fromEntries(result.cards.map((c) => [c.id, c.right])) : null;
  const coach = result?.coaching;
  const count = lesson.cards.filter((c) => chosen[c.id]).length;
  const optionName = (id) => lesson.bins.find((b) => b.id === id)?.title;
  const rowName = lesson.course === "flow" ? "단계" : "상황";

  let head = null;
  if (result) {
    const { right: n, total } = result.score;
    const wrong = total - n;
    const desc = result.passed
      ? `${total}개 중 ${n}개 맞음.${wrong ? ` 다르게 고른 ${counted(wrong, "개")}도 아래에서 확인.` : ""}`
      : `${total}개 중 ${n}개 맞음. ${result.criteria[1].met ? `${lesson.pass.min}개 이상 맞혀야 통과.` : lesson.mustNote}`;
    head = <Head runner={runner} result={result} desc={desc} got={n} total={total} />;
  }

  if (result) {
    const items = lesson.cards.map((card, i) => ({
      key: card.id,
      label: `${i + 1}. ${card.text}`,
      met: right[card.id],
      after: `내가 고른 방법: ${optionName(chosen[card.id])}`,
    }));
    const wrong = items.some((c) => !c.met);
    return (
      <>
        {head}
        {coach && <CoachCard question={coach.question} hint={coach.detail} />}
        {result.leftover && (
          <p className={p.leftover}>
            <b>{result.leftover.question}</b> {result.leftover.detail}
          </p>
        )}
        <section className={l.card} aria-labelledby="choose-review">
          <h2 id="choose-review" className={l.cardTitle}>
            {wrong ? `다시 볼 ${rowName}` : "고른 방법"}
          </h2>
          <div>
            <CriteriaResult items={items} foldLabel={(n) => `맞게 고른 ${n}개 보기`} />
          </div>
        </section>
        <BackToLecture runner={runner} />
      </>
    );
  }

  return (
    <>
      <TodoCard lesson={lesson} />
      <Rule runner={runner} />
      <section className={`${l.card} ${p.matrixCard}`} aria-label={`${rowName}마다 방법 고르기`}>
        <table className={p.matrix}>
          <colgroup>
            <col />
            {lesson.bins.map((b) => (
              <col key={b.id} className={p.matrixCol} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{rowName}</th>
              {lesson.bins.map((b) => (
                <th key={b.id} scope="col">
                  {b.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lesson.cards.map((card, i) => (
              <tr key={card.id} className={chosen[card.id] ? p.chosenRow : undefined}>
                <th scope="row">
                  <span className={p.num}>{i + 1}</span>
                  {card.text}
                </th>
                {lesson.bins.map((b) => (
                  <td key={b.id}>
                    <label className={p.radio}>
                      <input
                        type="radio"
                        name={`choose-${lesson.id}-${card.id}`}
                        checked={chosen[card.id] === b.id}
                        onChange={() => setChosen((prev) => ({ ...prev, [card.id]: b.id }))}
                      />
                      <span className={l.srOnly}>
                        {card.text}: {b.title}
                      </span>
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <SubmitRow
        runner={runner}
        note={`${lesson.cards.length}개 중 ${count}개 선택`}
        disabled={count < lesson.cards.length}
        onClick={() => runner.submit({ answer: chosen })}
      />
    </>
  );
}

// ---------- spot: AI 답변에서 문제 찾기 (D9, D10) ----------

export function PracticeSpot({ lesson, runner }) {
  const { stage, grade } = runner;
  const [picks, setPicks] = useState({});
  const [open, setOpen] = useState(null);
  const [missing, setMissing] = useState("");
  const [showRest, setShowRest] = useState(false);
  const result = stage === "result" && grade?.review ? grade : null;
  const kindName = (id) => lesson.kinds.find((k) => k.id === id)?.name;
  const pickedCount = Object.keys(picks).length;

  const setPick = (i, change) => setPicks((prev) => ({ ...prev, [i]: { ...prev[i], ...change } }));
  function unpick(i) {
    setPicks((prev) => {
      const next = { ...prev };
      delete next[i];
      return next;
    });
    setOpen(null);
  }
  function restart() {
    setPicks({});
    setMissing("");
    setOpen(null);
    runner.go("practice");
  }
  const send = () =>
    runner.submit({
      answer: {
        picks: Object.entries(picks).map(([i, v]) => ({
          index: Number(i),
          kind: v.kind,
          ...(v.fix?.trim() ? { fix: v.fix.trim() } : {}),
        })),
        missing,
      },
    });

  const material = (
    <aside className={l.aside}>
      <MaterialPanel material={lesson.material} />
    </aside>
  );

  if (result) {
    const { found, total, falsePicks } = result.score;
    let desc;
    if (result.passed) {
      desc = found === total ? `숨겨 둔 ${total}곳 모두 찾음.` : `숨겨 둔 ${total}곳 중 ${found}곳 찾음. 놓친 곳은 아래에서 확인.`;
    } else if (!result.criteria[1].met) {
      desc = `맞는 문장을 틀렸다고 고른 것 ${falsePicks}개. ${lesson.pass.maxFalse}개까지만 허용.`;
    } else {
      desc = `숨겨 둔 ${total}곳 중 ${found}곳 찾음. ${lesson.pass.min}곳 이상 찾아야 통과.`;
    }
    const rows = result.review.sentences.map((r, i) => ({ ...r, i, text: lesson.sentences[i].text }));
    // 통과 전에는 놓친 곳을 드러내지 않는다(코칭 질문 하나만). 그래서 놓친 문장은 '나머지'에 섞인다.
    // 다시 볼 곳: 놓친 곳을 먼저, 잘못 고른 문장을 다음에(보드 D10)
    const again = rows
      .filter((r) => r.status === "false" || (r.status === "missed" && r.question))
      .sort((a, b) => Number(b.status === "missed") - Number(a.status === "missed"));
    const foundRows = rows.filter((r) => r.status === "found");
    const rest = rows.filter((r) => !again.includes(r) && !foundRows.includes(r));
    const miss = result.review.missing;
    const sameAs = josa(lesson.source, ["과", "와"]);
    const sentence = (r, extra, cls = "") => (
      <li key={r.i} className={`${p.sentence} ${cls}`}>
        <div className={p.sentenceRow}>
          <span className={p.num}>{r.i + 1}</span>
          <div>
            {r.text}
            {extra}
          </div>
          {r.status === "missed" ? <span className={p.missedTag}>놓친 곳</span> : r.kindName ? <span className={p.kindTag}>{r.kindName}</span> : <span />}
        </div>
      </li>
    );
    return (
      <>
        <Head runner={runner} result={result} desc={desc} got={found} total={total} retry={restart} />
        {result.coaching && <CoachCard question={result.coaching.question} hint={result.coaching.detail} />}
        <div className={l.work}>
          <div className={l.aside}>
            {(again.length > 0 || miss?.status === "missed") && (
              <section className={l.card} aria-labelledby="spot-again">
                <h2 id="spot-again" className={l.cardTitle}>
                  다시 볼 곳
                </h2>
                <ol className={p.sentences}>
                  {again.map((r) =>
                    r.status === "missed"
                      ? sentence(
                          r,
                          <p className={p.feedback}>
                            <b>{r.question}</b> <span className={p.muted}>{r.why}</span>
                          </p>,
                          p.missedBox,
                        )
                      : sentence(
                          r,
                          <p className={p.feedback}>
                            <b>{sameAs} 다시 맞춰 보면?</b> <span className={p.muted}>이 문장이 {sameAs} 같은지 다시 확인.</span>
                          </p>,
                          p.picked,
                        ),
                  )}
                  {miss?.status === "missed" && (
                    <li className={`${p.sentence} ${p.missedBox}`}>
                      <div className={p.sentenceRow}>
                        <span className={p.num}>+</span>
                        <div>
                          <b className={p.small}>빠진 내용</b>
                          {missing.trim() ? ` · ${missing.trim()}` : ""}
                          <p className={p.feedback}>
                            <b>{miss.question}</b>
                          </p>
                        </div>
                        <span />
                      </div>
                    </li>
                  )}
                </ol>
              </section>
            )}
            <section className={l.card} aria-labelledby="spot-found">
              <h2 id="spot-found" className={l.cardTitle}>
                찾은 곳
              </h2>
              {foundRows.length === 0 && miss?.status !== "found" ? (
                <p className={l.note}>아직 찾은 곳 없음</p>
              ) : (
                <ol className={p.sentences}>
                  {foundRows.map((r) =>
                    sentence(
                      r,
                      <p className={`${p.feedback} ${p.muted}`}>
                        찾음{r.fix ? ` · 내가 고친 문장: ${r.fix}` : ""}
                        {r.note ? ` · ${r.note}` : ""}
                      </p>,
                    ),
                  )}
                  {miss?.status === "found" && (
                    <li className={p.sentence}>
                      <div className={p.sentenceRow}>
                        <span className={p.num}>+</span>
                        <div>
                          <b className={p.small}>빠진 내용</b> · {missing.trim()}
                          <p className={`${p.feedback} ${p.muted}`}>찾음. {miss.note}</p>
                        </div>
                        <span />
                      </div>
                    </li>
                  )}
                </ol>
              )}
              {rest.length > 0 && (
                <>
                  <button type="button" className={l.fold} aria-expanded={showRest} onClick={() => setShowRest(!showRest)}>
                    {showRest ? "접기" : `${result.passed ? "문제 없는 문장" : "나머지 문장"} ${rest.length}개 보기`}
                    <span className={l.foldIcon}>
                      <ChevronIcon open={showRest} />
                    </span>
                  </button>
                  {showRest && <ol className={p.sentences}>{rest.map((r) => sentence({ ...r, kindName: null, status: "ok" }))}</ol>}
                </>
              )}
            </section>
            {result.passed ? (
              <div className={l.after}>
                <button type="button" className={l.secondary} onClick={restart}>
                  <PencilIcon />
                  다시 해 보기
                </button>
              </div>
            ) : (
              <BackToLecture runner={runner} />
            )}
          </div>
          {material}
        </div>
      </>
    );
  }

  const renderSentence = (s, i) => {
    const pick = picks[i];
    return (
      <li key={i} className={`${p.sentence} ${pick || open === i ? p.picked : ""}`}>
        <button type="button" className={`${p.sentenceRow} ${p.sentenceBtn}`} aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
          <span className={p.num}>{i + 1}</span>
          <span>{s.text}</span>
          {pick ? <span className={p.kindTag}>{kindName(pick.kind)}</span> : <span />}
        </button>
        {open === i && (
          <div className={p.pickBox}>
            <div role="group" aria-label="문제 종류" className={p.kindRow}>
              {lesson.kinds.map((k) => (
                <button key={k.id} type="button" className={p.kindBtn} aria-pressed={pick?.kind === k.id} onClick={() => setPick(i, { kind: k.id })}>
                  {k.name}
                </button>
              ))}
            </div>
            {pick && (
              <>
                <label className={p.fixLabel}>
                  <span>
                    고친 문장 <span className={p.muted}>(선택)</span>
                  </span>
                  <input className={p.fixInput} value={pick.fix ?? ""} maxLength={200} onChange={(e) => setPick(i, { fix: e.target.value })} />
                </label>
                <button type="button" className={p.linkBtn} onClick={() => unpick(i)}>
                  고르기 취소
                </button>
              </>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <>
      <TodoCard lesson={lesson}>
        <p className={p.kindsLine}>
          <b>문제 종류</b>
          {lesson.kinds.map((k) => (
            <span key={k.id} className={p.kindTag}>
              {k.name}
            </span>
          ))}
          <span className={l.note}>문장 선택 후 종류 고르기</span>
        </p>
      </TodoCard>
      <Rule runner={runner} />
      <div className={l.work}>
        <section className={`${l.card} ${p.answer}`} aria-labelledby="spot-answer">
          <div className={l.cardHead}>
            <h2 id="spot-answer" className={l.cardTitle}>
              {lesson.answerTitle}
            </h2>
            <span className={l.note}>
              고른 문장 <span className={l.mono}>{pickedCount}</span>개
            </span>
          </div>
          <ol className={p.sentences}>{lesson.sentences.map(renderSentence)}</ol>
          <label htmlFor="spot-missing" className={l.cardTitle}>
            빠진 내용
          </label>
          <textarea
            id="spot-missing"
            className={p.missingInput}
            value={missing}
            maxLength={300}
            placeholder={`${lesson.source}에 있는데 ${lesson.answerName}에 없는 내용 쓰기`}
            onChange={(e) => setMissing(e.target.value)}
          />
          <SubmitRow runner={runner} note="다 골랐으면 제출" onClick={send} />
        </section>
        {material}
      </div>
    </>
  );
}

// ---------- file: 파일을 붙이고 프롬프트 쓰기 (D8, D7) ----------

// 결과물에서 자료에 없는 숫자를 점선으로 표시한다. 목록 번호(1. 2.)는 숫자로 보지 않는다.
const NUMBER_TOKEN = /(\d[\d,]*(?:\.\d+)?(?:%|일|건|개|명|원|배|시간|분|초|월|주|편|년|쪽)?)/;
const normalize = (token) =>
  token
    .match(/\d[\d,]*(?:\.\d+)?/)[0]
    .replace(/,(?=\d{3}\b)/g, "")
    .replace(/,$/, "");

function MarkedLine({ text, unknown }) {
  return text.split(NUMBER_TOKEN).map((part, i) =>
    i % 2 === 1 && unknown.has(normalize(part)) ? (
      <span key={i}>
        <mark className={p.unknownNum}>{part}</mark>
        <sup className={p.unknownTag}>없는 숫자</sup>
      </span>
    ) : (
      part
    ),
  );
}

function CheckedOutput({ text, unknown }) {
  const set = new Set(unknown);
  const lines = text.split("\n").filter((t) => t.trim());
  const listed = lines.length > 1 && lines.every((t) => /^\s*\d+[.)]\s/.test(t));
  if (listed) {
    return (
      <ol className={p.outList}>
        {lines.map((t, i) => (
          <li key={i}>
            <MarkedLine text={t.replace(/^\s*\d+[.)]\s/, "")} unknown={set} />
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className={p.outText}>
      {lines.map((t, i) => {
        const [, marker = "", body] = t.match(/^(\s*\d+[.)]\s)?([\s\S]*)$/);
        return (
          <p key={i}>
            {marker}
            <MarkedLine text={body} unknown={set} />
          </p>
        );
      })}
    </div>
  );
}

// 예시 파일 하나를 /api/files로 올리고 화면에 둘 정보만 남긴다.
async function uploadSample(sample) {
  const blob = await fetch(sample.url).then((r) => {
    if (!r.ok) throw new Error("SAMPLE");
    return r.blob();
  });
  const up = await api.uploadFile(new File([blob], sample.name, { type: sample.type }));
  return up.uri
    ? { name: up.name, mimeType: up.mimeType, size: up.size, uri: up.uri, sig: up.sig }
    : { name: up.name, mimeType: up.mimeType, size: up.size };
}

// 미리 보기 칸 아래 링크: PDF는 "PDF로 열어 보기", 나머지는 "파일 열어 보기"
const openLabel = (sample) => (sample.type === "application/pdf" ? "PDF로 열어 보기" : "파일 열어 보기");
// 미리 보기 탭 이름: 파일 이름 앞의 날짜(예: 11월4일 → 11월 4일), 없으면 번호
const tabName = (sample, i) => sample.name.match(/^(\d+월)\s?(\d+일)/)?.slice(1).join(" ") ?? `자료 ${i + 1}`;

export function PracticeFile({ lesson, runner }) {
  const { stage, grade } = runner;
  const samples = lesson.samples;
  const label = lesson.sampleLabel;
  const [mode, setMode] = useState("sample");
  const [tab, setTab] = useState(0);
  const [draft, setDraft] = useState("");
  const [entries, setEntries] = useState([]);
  const [uploaded, setUploaded] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const live = useMemo(() => analyze(draft), [draft]);
  const result = stage === "result" && grade ? grade : null;
  const uploading = mode === "own" && isUploading(entries);
  const shown = samples[Math.min(tab, samples.length - 1)];

  // 예시 파일은 처음 보낼 때 /api/files로 올리고, 받은 주소를 다시 쓴다. 만료됐으면(410) 한 번 새로 올린다.
  async function sampleFiles(fresh = false) {
    if (uploaded && !fresh) return uploaded;
    const metas = await Promise.all(samples.map(uploadSample));
    setUploaded(metas);
    return metas;
  }

  async function send() {
    if (!draft.trim()) return runner.setError("프롬프트를 써야 평가 가능");
    if (mode === "own" && !attachedFiles(entries).length) return runner.setError("파일을 붙여야 평가 가능");
    setPreparing(true);
    try {
      const isSample = mode === "sample";
      const files = isSample ? await sampleFiles() : attachedFiles(entries);
      const err = await runner.submit({ prompt: draft, files, sample: isSample });
      if (err?.expired && isSample) await runner.submit({ prompt: draft, files: await sampleFiles(true), sample: true });
    } catch {
      runner.setError(`${josa(label, ["을", "를"])} 올리지 못함. 잠시 뒤 다시 시도.`);
    } finally {
      setPreparing(false);
    }
  }

  if (result)
    return (
      <FileResult
        lesson={lesson}
        runner={runner}
        result={result}
        draft={draft}
        fileName={
          mode === "sample"
            ? samples.map((f) => f.name).join(", ")
            : attachedFiles(entries)
                .map((f) => f.name)
                .join(", ")
        }
      />
    );

  const textarea = (
    <textarea
      className={p.fileInput}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      placeholder="붙인 파일로 AI가 할 일 쓰기"
      aria-label="AI에게 보낼 프롬프트"
      rows={4}
    />
  );

  return (
    <>
      <TodoCard lesson={lesson} />
      <Rule runner={runner} />
      <div className={`${l.work} ${l.wide}`}>
        <section className={l.card} aria-labelledby="file-editor">
          <div className={l.cardHead}>
            <h2 id="file-editor" className={l.cardTitle}>
              내 프롬프트
            </h2>
            <span className={l.headEnd}>
              <span className={l.empty}>{emptyLine(live.found)}</span>
              <MiniBar found={live.found} />
            </span>
          </div>
          <div role="group" aria-label="쓸 파일" className={p.tabs}>
            <button type="button" className="chip" aria-pressed={mode === "sample"} onClick={() => setMode("sample")}>
              {josa(label, ["으로", "로"])} 하기
            </button>
            <button type="button" className="chip" aria-pressed={mode === "own"} onClick={() => setMode("own")}>
              내 파일 올리기
            </button>
          </div>
          {mode === "sample" ? (
            <div className={fa.frame}>
              {textarea}
              <div className={p.sampleRow}>
                {samples.map((f) => (
                  <span key={f.name} className={p.sampleChip}>
                    <FileIcon />
                    {f.name}
                    <span className={p.eduTag}>교육용 예시</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <FileAttach entries={entries} setEntries={setEntries}>
              {textarea}
            </FileAttach>
          )}
          <SubmitRow
            runner={{ ...runner, busy: runner.busy || preparing }}
            note={`내 파일은 ${MAX_FILES}개까지, 하나에 4MB`}
            busyLabel="보내는 중…"
            disabled={uploading}
            onClick={send}
          />
        </section>

        <aside className={l.aside}>
          {mode === "sample" && (
            <section className={l.card} aria-labelledby="sample-preview">
              <h2 id="sample-preview" className={l.cardTitle}>
                자료 미리 보기{shown.pages ? ` · ${shown.pages}쪽` : ""}
              </h2>
              {samples.length > 1 && (
                <div role="tablist" aria-label={label} className={p.tabs}>
                  {samples.map((f, i) => (
                    <button key={f.name} type="button" role="tab" className="chip chip-sm" aria-selected={i === tab} onClick={() => setTab(i)}>
                      {tabName(f, i)}
                    </button>
                  ))}
                </div>
              )}
              <div className={p.preview} role={samples.length > 1 ? "tabpanel" : undefined}>
                <span className={p.previewTag}>교육용 예시 자료</span>
                <strong>{shown.title}</strong>
                {shown.preview.map((t) => (
                  <span key={t}>{t}</span>
                ))}
                <span aria-hidden="true">…</span>
              </div>
              <a className={p.textLink} href={shown.url} target="_blank" rel="noreferrer">
                {openLabel(shown)}
              </a>
            </section>
          )}
          <section className={l.card} aria-labelledby="file-criteria">
            <h2 id="file-criteria" className={l.cardTitle}>
              통과 기준
            </h2>
            <CriteriaDots
              criteria={lesson.criteria}
              extra={mode === "sample" ? [`AI 결과에 ${josa(lesson.check.unknownLabel, ["이", "가"])} 있는지 확인`] : []}
            />
          </section>
        </aside>
      </div>
    </>
  );
}

function FileResult({ lesson, runner, result, draft, fileName }) {
  const met = result.criteria.filter((c) => c.met).length;
  const total = result.criteria.length;
  const unknown = result.check?.unknown ?? [];
  const { unknownLabel, unknownNote, compareNote } = lesson.check;
  const unknownLine = unknown.length ? ` 결과에 ${unknownLabel} ${countWord(unknown.length)}.` : "";
  const desc = `${criteriaDesc(result)}${result.passed && unknownLine ? ` 다만${unknownLine}` : unknownLine}`;
  const rule = result.source === "rule";
  const outTitle = result.sample
    ? rule
      ? "AI 결과물"
      : `AI가 ${josa(lesson.sampleLabel.replace(/^예시 /, ""), ["을", "를"])} 읽고 낸 결과`
    : "AI가 내 파일을 읽고 낸 결과";
  const coreMissed = lesson.check.core.map((c) => c.label).filter((name) => !result.check?.core.includes(name));
  const coachHint = result.coaching ? lesson.criteria.find((c) => c.question === result.coaching.question)?.hint : null;

  const mine = (
    <section className={l.card} aria-labelledby="file-mine">
      <h2 id="file-mine" className={l.smallTitle}>
        내 프롬프트
      </h2>
      <p className={p.mine}>{draft}</p>
      {result.passed && (
        <>
          <h3 className={l.smallTitle}>채운 통과 기준</h3>
          <CriteriaResult items={result.criteria} />
        </>
      )}
    </section>
  );

  const output = (
    <section className={l.card} aria-labelledby="file-output">
      <div className={l.cardHead}>
        <h2 id="file-output" className={l.smallTitle}>
          {result.output ? outTitle : "AI 결과"}
        </h2>
        {result.sample && rule && result.output && <ExampleChip />}
        {fileName && (
          <span className={`${p.sampleChip} ${l.headEnd}`}>
            <FileIcon />
            {fileName}
          </span>
        )}
      </div>
      {result.output ? <CheckedOutput text={result.output} unknown={unknown} /> : <p className={l.note}>AI 미연결 · 파일은 읽지 않고 프롬프트만 채점</p>}
      {result.check && (
        <div className={p.checkNotes}>
          <p className={l.smallTitle}>결과 확인</p>
          <p className={p.checkLine}>
            <span className={unknown.length ? l.icNo : l.icOk}>{unknown.length ? <MissIcon size={9} /> : <MetIcon size={11} />}</span>
            <span>
              <b>{unknown.length ? `${unknownLabel} ${counted(unknown.length, "개")}.` : `${unknownLabel} 없음.`}</b> {compareNote}
              {unknown.length ? ` ${unknownNote}` : ""}
            </span>
          </p>
          <p className={p.checkLine}>
            <span className={result.check.coreOk ? l.icOk : l.icNo}>{result.check.coreOk ? <MetIcon size={11} /> : <MissIcon size={9} />}</span>
            <span>
              <b>{result.check.coreOk ? "핵심을 잘 담음." : "핵심이 덜 담김."}</b>{" "}
              {result.check.coreOk ? result.check.core.join(", ") : `${coreMissed.join(", ")} 안 보임`}
            </span>
          </p>
        </div>
      )}
      {!result.sample && <p className={l.note}>내 파일은 정답 없음. 결과가 맞는지 직접 확인.</p>}
      {result.sample && rule && result.output && <p className={l.note}>{NO_AI_TEXT}</p>}
    </section>
  );

  return (
    <>
      <Head runner={runner} result={result} desc={desc} got={met} total={total} />
      {result.coaching && <CoachCard question={result.coaching.question} hint={coachHint} />}
      {result.passed ? (
        <div className={`${l.work} ${l.passed}`}>
          {mine}
          {output}
        </div>
      ) : (
        <div className={`${l.work} ${l.result}`}>
          <section className={l.card} aria-labelledby="file-criteria-result">
            <h2 id="file-criteria-result" className={l.cardTitle}>
              통과 기준
            </h2>
            <div>
              <CriteriaResult items={result.criteria} />
            </div>
          </section>
          <div className={l.aside}>
            {mine}
            {output}
          </div>
        </div>
      )}
      <BackToLecture runner={runner}>
        <button type="button" className={p.textLink} onClick={() => runner.onOpenCourse?.("verify")}>
          결과를 직접 확인하는 법은 과정 4에서 →
        </button>
      </BackToLecture>
    </>
  );
}
