"use client";

// kind별 실습 칸과 평가 칸. 보드 4-1(분류), 4-2(오류 찾기), 4-3·4-4(파일). 고르기(tool1)는 보드가 없어 분류와 같은 모양으로 그린다.
// 강의 → 실습 → 평가·피드백 흐름, 채점 요청, 기록 저장은 LessonRunner가 맡고, 여기서는 runner로 받아 쓴다.
//   runner: { stage, grade, busy, error, wasDone, submit(extra), setError, go(stage), onNext, nextLabel, onOpenCourse }
// 실습과 평가를 같은 컴포넌트가 그려서, 평가 뒤 "다시"를 누르면 고른 것을 그대로 둔 채 실습으로 돌아간다.
import { useMemo, useState } from "react";
import * as api from "@/lib/api";
import { analyze } from "@/lib/anatomy";
import { ITEMS } from "@/lib/items";
import { josa } from "@/lib/josa";
import { countWord, MAX_FILES } from "@/lib/fileRules";
import { attachedFiles, FileAttach, FileIcon, isUploading } from "./FileAttach";
import { CoachCard, MetIcon, MiniBar, MissIcon } from "./lessonBits";
import fa from "./fileAttach.module.css";
import l from "./lesson.module.css";
import p from "./practice.module.css";

const WORD = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟"];
const counted = (n, unit) => (WORD[n] ? `${WORD[n]} ${unit}` : `${n}${unit}`);

// ---------- 공용 ----------

function ResultHead({ title, desc, score, grade, wasDone }) {
  return (
    <section className={`${l.card} ${p.head}`} aria-live="polite" aria-labelledby="practice-result">
      <div className={p.headText}>
        <h2 id="practice-result" className={p.headTitle}>
          {title}
        </h2>
        <p>{desc}</p>
      </div>
      <p className={p.score}>
        <span className={p.scoreNum}>{score}</span>
        {grade.passed &&
          (wasDone ? (
            <span className={l.note}>이미 마친 미션이라 XP는 그대로예요</span>
          ) : (
            <span className={l.xpPill}>+{grade.xp} XP</span>
          ))}
      </p>
    </section>
  );
}

function MissionCard({ lesson }) {
  return (
    <section className={`${l.card} ${l.missionCard}`} aria-labelledby="practice-mission">
      <h2 id="practice-mission" className={l.smallTitle}>
        할 일
      </h2>
      <p>{lesson.mission}</p>
    </section>
  );
}

function SubmitRow({ runner, label = "제출하고 평가 받기", busyLabel = "평가하는 중…", onClick, disabled = false }) {
  return (
    <div className={l.actions}>
      <button type="button" className={l.primary} onClick={onClick} disabled={runner.busy || disabled}>
        {runner.busy ? busyLabel : label}
      </button>
      {runner.error && (
        <p className={l.error} role="alert">
          {runner.error}
        </p>
      )}
    </div>
  );
}

// 실습 때 함께 보는 자료: 대화 기록(kind: chat)이나 줄 목록
export function MaterialPanel({ material }) {
  return (
    <section className={`${l.card} ${p.material}`} aria-labelledby="material">
      <h2 id="material" className={l.smallTitle}>
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
          {material.lines.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------- sort: 카드를 칸으로 나누기 (보드 4-1) ----------

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
        <li
          key={card.id}
          className={`${p.sortCard} ${p.graded} ${ok ? "" : p.wrong} ${coach?.card === card.id ? p.coached : ""}`}
        >
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
      ? `${total}장 중 ${n}장을 맞게 나눴어요.${wrong ? ` 틀린 ${counted(wrong, "장")}도 아래에서 확인해 보세요.` : ""}`
      : `${total}장 중 ${n}장을 맞게 나눴어요. ${
          result.criteria[1].met
            ? `${lesson.pass.min}장 이상 맞혀야 통과예요.`
            : lesson.mustNote
        }`;
    const title = result.passed ? "통과했어요" : wrong === 1 ? "한 장만 다시 볼까요?" : `${counted(wrong, "장")}을 다시 볼까요?`;
    head = <ResultHead title={title} desc={desc} score={`${n} / ${total}`} grade={result} wasDone={runner.wasDone} />;
  }

  return (
    <>
      {result ? head : <MissionCard lesson={lesson} />}
      {coach && <CoachCard question={coach.question} hint={coach.detail} />}
      {result?.leftover && (
        <p className={p.leftover}>
          <b>{result.leftover.question}</b> {result.leftover.detail}
        </p>
      )}

      {!result && (
        <section
          className={`${p.pool} ${picked && placed[picked] ? p.poolTarget : ""}`}
          aria-labelledby="pool-h"
          {...dropProps(null)}
        >
          <div className={p.poolHead}>
            <h2 id="pool-h" className={l.smallTitle}>
              {pool.length ? `아직 놓지 않은 카드 ${pool.length}장` : "카드를 모두 놓았어요"}
            </h2>
            <p className={l.note}>카드를 누른 뒤 놓을 칸의 &lsquo;여기에 놓기&rsquo;를 누르세요. 끌어다 놓아도 돼요.</p>
          </div>
          {pool.length > 0 && <ul className={p.poolCards}>{pool.map(renderCard)}</ul>}
          {picked && placed[picked] && (
            <button type="button" className={p.dropHere} onClick={() => place(picked, null)}>
              놓지 않은 카드로 되돌리기
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
              <ul className={p.binCards}>{cards.map(renderCard)}</ul>
              {!result && picked && placed[picked] !== bin.id && (
                <button type="button" className={p.dropHere} onClick={() => place(picked, bin.id)}>
                  여기에 놓기
                </button>
              )}
              {coach?.to === bin.id && <p className={p.ghost}>여기로 옮겨 볼까요?</p>}
            </section>
          );
        })}
      </div>

      {result ? (
        <div className={p.footer}>
          <button type="button" className={l.secondary} onClick={() => runner.go("lecture")}>
            배우기 다시 보기
          </button>
          {result.passed ? (
            <button type="button" className={l.primary} onClick={runner.onNext}>
              {runner.nextLabel}
            </button>
          ) : (
            <button type="button" className={l.primary} onClick={() => runner.go("practice")}>
              카드 옮겨서 다시 채점
            </button>
          )}
        </div>
      ) : (
        <SubmitRow runner={runner} onClick={() => runner.submit({ answer: placed })} />
      )}
    </>
  );
}

// ---------- choose: 상황마다 방법 고르기 (tool1, 보드 없음: 분류 실습과 같은 평가 칸) ----------

export function PracticeChoose({ lesson, runner }) {
  const { stage, grade } = runner;
  const [chosen, setChosen] = useState({});
  const result = stage === "result" && grade?.cards ? grade : null;
  const right = result ? Object.fromEntries(result.cards.map((c) => [c.id, c.right])) : null;
  const coach = result?.coaching;
  const left = lesson.cards.filter((c) => !chosen[c.id]).length;
  const optionName = (id) => lesson.bins.find((b) => b.id === id)?.title;

  let head = null;
  if (result) {
    const { right: n, total } = result.score;
    const wrong = total - n;
    const desc = result.passed
      ? `${total}개 중 ${n}개를 맞게 골랐어요.${wrong ? ` 다르게 고른 ${counted(wrong, "개")}도 아래에서 확인해 보세요.` : ""}`
      : `${total}개 중 ${n}개를 맞게 골랐어요. ${
          result.criteria[1].met ? `${lesson.pass.min}개 이상 맞혀야 통과예요.` : lesson.mustNote
        }`;
    const title = result.passed
      ? "통과했어요"
      : wrong === 1
        ? "한 가지만 다시 볼까요?"
        : `${counted(wrong, "가지")}를 다시 볼까요?`;
    head = <ResultHead title={title} desc={desc} score={`${n} / ${total}`} grade={result} wasDone={runner.wasDone} />;
  }

  return (
    <>
      {result ? head : <MissionCard lesson={lesson} />}
      {coach && <CoachCard question={coach.question} hint={coach.detail} />}
      {result?.leftover && (
        <p className={p.leftover}>
          <b>{result.leftover.question}</b> {result.leftover.detail}
        </p>
      )}

      <ol className={p.situations}>
        {lesson.cards.map((card, i) => {
          const ok = right?.[card.id];
          return (
            <li
              key={card.id}
              className={`${p.situation} ${result && !ok ? p.wrong : ""} ${coach?.card === card.id ? p.coached : ""}`}
            >
              <div className={p.situationText}>
                <span className={p.num}>{i + 1}</span>
                <span id={`situation-${card.id}`}>{card.text}</span>
                {result && (
                  <span className={`${p.mark} ${ok ? p.markOk : p.markBad}`}>
                    {ok ? <MetIcon size={12} /> : <MissIcon size={10} />}
                  </span>
                )}
              </div>
              {result ? (
                <p className={p.chosenLine}>내가 고른 방법: {optionName(chosen[card.id])}</p>
              ) : (
                <div role="radiogroup" aria-labelledby={`situation-${card.id}`} className={p.kindRow}>
                  {lesson.bins.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      role="radio"
                      aria-checked={chosen[card.id] === b.id}
                      className={p.kindBtn}
                      onClick={() => setChosen((prev) => ({ ...prev, [card.id]: b.id }))}
                    >
                      {b.title}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {result ? (
        <div className={p.footer}>
          <button type="button" className={l.secondary} onClick={() => runner.go("lecture")}>
            배우기 다시 보기
          </button>
          {result.passed ? (
            <button type="button" className={l.primary} onClick={runner.onNext}>
              {runner.nextLabel}
            </button>
          ) : (
            <button type="button" className={l.primary} onClick={() => runner.go("practice")}>
              다시 골라서 채점
            </button>
          )}
        </div>
      ) : (
        <>
          {left > 0 && <p className={l.note}>아직 고르지 않은 상황이 {left}개 있어요.</p>}
          <SubmitRow runner={runner} onClick={() => runner.submit({ answer: chosen })} />
        </>
      )}
    </>
  );
}

// ---------- spot: AI 답변에서 문제 찾기 (보드 4-2) ----------

export function PracticeSpot({ lesson, runner }) {
  const { stage, grade } = runner;
  const [picks, setPicks] = useState({});
  const [open, setOpen] = useState(null);
  const [missing, setMissing] = useState("");
  const result = stage === "result" && grade?.review ? grade : null;
  const kindName = (id) => lesson.kinds.find((k) => k.id === id)?.name;

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

  let head = null;
  if (result) {
    const { found, total, falsePicks } = result.score;
    let title;
    let desc;
    if (result.passed) {
      title = "통과했어요";
      desc =
        found === total
          ? `숨겨 둔 ${total}곳을 모두 찾았어요.`
          : `숨겨 둔 ${total}곳 중 ${found}곳을 찾았어요. 놓친 ${counted(total - found, "곳")}도 아래에서 확인해 보세요.`;
    } else if (!result.criteria[1].met) {
      title = "맞는 문장까지 골랐어요";
      desc = `맞는 문장을 틀렸다고 고른 것이 ${falsePicks}개예요. ${lesson.pass.maxFalse}개까지만 괜찮아요.`;
    } else {
      title = found === total - 1 ? "한 곳만 더 찾아볼까요?" : "조금 더 찾아볼까요?";
      desc = `숨겨 둔 ${total}곳 중 ${found}곳을 찾았어요. ${lesson.pass.min}곳 이상 찾아야 통과예요.`;
    }
    head = <ResultHead title={title} desc={desc} score={`${found} / ${total}`} grade={result} wasDone={runner.wasDone} />;
  }

  const renderSentence = (s, i) => {
    const pick = picks[i];
    if (result) {
      const r = result.review.sentences[i];
      const tag =
        r.status === "missed" && r.question ? (
          <span className={p.missedTag}>놓친 곳</span>
        ) : r.kindName ? (
          <span className={p.kindTag}>{r.kindName}</span>
        ) : null;
      return (
        <li
          key={i}
          className={`${p.sentence} ${r.status === "found" || r.status === "false" ? p.picked : ""} ${r.question ? p.missedBox : ""}`}
        >
          <div className={p.sentenceRow}>
            <span className={p.num}>{i + 1}</span>
            <span className={r.kind ? p.struck : r.status === "ok" || r.status === "missed" ? p.plain : undefined}>{s.text}</span>
            {tag}
          </div>
          {r.status === "found" && (
            <p className={p.feedback}>
              <b>찾았어요.</b>
              {r.fix && ` 내가 고친 문장: ${r.fix}`}
              {r.note && <span className={p.muted}> {r.note}</span>}
            </p>
          )}
          {r.status === "missed" && r.question && (
            <p className={p.feedback}>
              <b>{r.question}</b> <span className={p.muted}>{r.why}</span>
            </p>
          )}
          {r.status === "false" && (
            <p className={p.feedback}>
              <b>{josa(lesson.source, ["과", "와"])} 다시 맞춰 볼까요?</b>{" "}
              <span className={p.muted}>이 문장이 {josa(lesson.source, ["과", "와"])} 같은지 한 번 더 확인해 보세요.</span>
            </p>
          )}
        </li>
      );
    }
    return (
      <li key={i} className={`${p.sentence} ${pick ? p.picked : ""}`}>
        <button
          type="button"
          className={`${p.sentenceRow} ${p.sentenceBtn}`}
          aria-expanded={open === i}
          onClick={() => setOpen(open === i ? null : i)}
        >
          <span className={p.num}>{i + 1}</span>
          <span className={pick ? p.struck : undefined}>{s.text}</span>
          {pick && <span className={p.kindTag}>{kindName(pick.kind)}</span>}
        </button>
        {open === i && (
          <div className={p.pickBox}>
            <div role="group" aria-label="문제 종류" className={p.kindRow}>
              {lesson.kinds.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  className={p.kindBtn}
                  aria-pressed={pick?.kind === k.id}
                  onClick={() => setPick(i, { kind: k.id })}
                >
                  {k.name}
                </button>
              ))}
            </div>
            {pick && (
              <>
                <label className={p.fixLabel}>
                  고친 문장 <span className={p.muted}>(적지 않아도 돼요)</span>
                  <input
                    className={p.fixInput}
                    value={pick.fix ?? ""}
                    maxLength={200}
                    onChange={(e) => setPick(i, { fix: e.target.value })}
                  />
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

  const miss = result?.review.missing;

  return (
    <>
      {result ? head : <MissionCard lesson={lesson} />}
      {result?.coaching && <CoachCard question={result.coaching.question} hint={result.coaching.detail} />}

      <div className={l.split}>
        <div className={l.side}>
          <MaterialPanel material={lesson.material} />
        </div>
        <section className={`${l.main} ${p.answer}`} aria-labelledby="spot-answer">
          <h2 id="spot-answer" className={l.smallTitle}>
            {lesson.answerTitle} · {result ? "문장을 눌러 문제를 골랐어요" : "문제 있는 문장을 눌러 골라 보세요"}
          </h2>
          <ol className={p.sentences}>{lesson.sentences.map(renderSentence)}</ol>
          <div
            className={`${p.missingBox} ${miss?.status === "found" ? p.picked : ""} ${miss?.status === "missed" ? p.missedBox : ""}`}
          >
            <label htmlFor="spot-missing" className={p.missingLabel}>
              빠진 내용이 있나요?
            </label>
            <textarea
              id="spot-missing"
              className={p.missingInput}
              value={missing}
              maxLength={300}
              readOnly={Boolean(result)}
              placeholder={`${lesson.source}에 있는데 ${lesson.answerName}에 없는 내용을 적어 보세요`}
              onChange={(e) => setMissing(e.target.value)}
            />
            {miss?.status === "found" && (
              <p className={p.feedback}>
                <b>찾았어요.</b> <span className={p.muted}>{miss.note}</span>
              </p>
            )}
            {miss?.status === "missed" && (
              <p className={p.feedback}>
                <b>{miss.question}</b>
              </p>
            )}
          </div>
          <p className={l.note}>문제 종류: {lesson.kinds.map((k) => k.name).join(" · ")}</p>
        </section>
      </div>

      {result ? (
        <div className={p.footer}>
          {result.passed ? (
            <>
              <button type="button" className={l.secondary} onClick={restart}>
                다시 풀어 보기
              </button>
              <button type="button" className={l.primary} onClick={runner.onNext}>
                {runner.nextLabel}
              </button>
            </>
          ) : (
            <>
              <button type="button" className={l.secondary} onClick={() => runner.go("lecture")}>
                배우기 다시 보기
              </button>
              <button type="button" className={l.primary} onClick={() => runner.go("practice")}>
                다시 찾아보기
              </button>
            </>
          )}
        </div>
      ) : (
        <SubmitRow runner={runner} onClick={send} />
      )}
    </>
  );
}

// ---------- file: 파일을 붙이고 프롬프트 쓰기 (보드 4-3, 4-4) ----------

// 결과물에서 보고서에 없는 숫자를 점선으로 표시한다. 목록 번호(1. 2.)는 숫자로 보지 않는다.
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

const asQuestion = (label) => label.replace(/다$/, "는지");

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

export function PracticeFile({ lesson, runner }) {
  const { stage, grade } = runner;
  const samples = lesson.samples;
  const label = lesson.sampleLabel;
  const [mode, setMode] = useState("sample");
  const [draft, setDraft] = useState("");
  const [entries, setEntries] = useState([]);
  const [uploaded, setUploaded] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const live = useMemo(() => analyze(draft), [draft]);
  const result = stage === "result" && grade ? grade : null;
  const uploading = mode === "own" && isUploading(entries);

  // 예시 파일은 처음 보낼 때 /api/files로 올리고, 받은 주소를 다시 쓴다. 만료됐으면(410) 한 번 새로 올린다.
  async function sampleFiles(fresh = false) {
    if (uploaded && !fresh) return uploaded;
    const metas = await Promise.all(samples.map(uploadSample));
    setUploaded(metas);
    return metas;
  }

  async function send() {
    if (!draft.trim()) return runner.setError("프롬프트를 써야 평가할 수 있어요.");
    if (mode === "own" && !attachedFiles(entries).length) return runner.setError("파일을 붙여야 평가할 수 있어요.");
    setPreparing(true);
    try {
      const isSample = mode === "sample";
      const files = isSample ? await sampleFiles() : attachedFiles(entries);
      const err = await runner.submit({
        prompt: draft,
        files,
        sample: isSample,
      });
      if (err?.expired && isSample)
        await runner.submit({
          prompt: draft,
          files: await sampleFiles(true),
          sample: true,
        });
    } catch {
      runner.setError(`${josa(label, ["을", "를"])} 올리지 못했어요. 잠시 뒤 다시 시도해 주세요.`);
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
      placeholder="붙인 파일로 AI가 무엇을 해야 하는지 써 보세요"
      aria-label="AI에게 보낼 프롬프트"
      rows={4}
    />
  );

  return (
    <>
      <MissionCard lesson={lesson} />
      <div className={l.split}>
        <section className={`${l.card} ${l.main}`} aria-labelledby="file-editor">
          <div className={l.cardHead}>
            <h2 id="file-editor" className={l.cardTitle}>
              내 프롬프트
            </h2>
            <div role="group" aria-label="쓸 파일" className={p.toggle}>
              <button type="button" aria-pressed={mode === "sample"} onClick={() => setMode("sample")}>
                {label}로 하기
              </button>
              <button type="button" aria-pressed={mode === "own"} onClick={() => setMode("own")}>
                내 파일 올리기
              </button>
            </div>
          </div>
          {mode === "sample" ? (
            <div className={fa.frame}>
              {textarea}
              <div className={p.sampleRow}>
                {samples.map((f) => (
                  <span key={f.name} className={p.sampleChip}>
                    <FileIcon />
                    {f.name}
                    <span className={p.muted}>교육용 예시</span>
                  </span>
                ))}
                <span className={p.sampleHint}>내 파일은 {MAX_FILES}개까지, 하나에 4MB</span>
              </div>
            </div>
          ) : (
            <FileAttach entries={entries} setEntries={setEntries}>
              {textarea}
            </FileAttach>
          )}
          <div className={l.empties}>
            <MiniBar found={live.found} />
            {live.found.length < ITEMS.length && (
              <>
                <span>비어 있는 요소</span>
                {ITEMS.filter((item) => !live.found.includes(item.id)).map((item) => (
                  <span key={item.id} className={l.dashChip}>
                    {item.name}
                  </span>
                ))}
              </>
            )}
          </div>
          <SubmitRow
            runner={{ ...runner, busy: runner.busy || preparing }}
            label="AI에게 보내고 평가 받기"
            busyLabel="보내는 중…"
            disabled={uploading}
            onClick={send}
          />
        </section>

        <aside className={l.side}>
          {mode === "sample" &&
            samples.map((f, i) => (
              <section key={f.name} className={l.card} aria-labelledby={`sample-preview-${i}`}>
                <h2 id={`sample-preview-${i}`} className={l.smallTitle}>
                  {label} 미리 보기{samples.length > 1 ? ` ${i + 1}` : ""}
                  {f.pages ? ` · ${f.pages}쪽` : ""}
                </h2>
                <div className={p.preview}>
                  <span className={p.previewTag}>교육용 예시 자료</span>
                  <strong>{f.title}</strong>
                  {f.preview.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                  <span aria-hidden="true">…</span>
                </div>
                <a className={p.textLink} href={f.url} target="_blank" rel="noreferrer">
                  {openLabel(f)}
                </a>
              </section>
            ))}
          <section className={l.card} aria-labelledby="file-criteria">
            <h2 id="file-criteria" className={l.cardTitle}>
              이렇게 평가해요
            </h2>
            <ul className={p.criteriaList}>
              {lesson.criteria.map((c) => (
                <li key={c.label}>{asQuestion(c.label)}</li>
              ))}
              {mode === "sample" && <li>AI 결과에 {josa(lesson.check.unknownLabel, ["이", "가"])} 있는지</li>}
            </ul>
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
  const unknownLine = unknown.length ? `AI 결과에 ${josa(unknownLabel, ["이", "가"])} ${countWord(unknown.length)} 들어갔어요.` : "";
  const title = result.passed ? "통과했어요" : total - met === 1 ? "한 가지만 더 채워 볼까요?" : "조금 더 채워 볼까요?";
  const desc = result.passed
    ? `기준 ${total}개를 모두 채웠어요.${unknownLine && ` 다만 ${unknownLine}`}`
    : `기준 ${total}개 중 ${met}개를 채웠어요.${unknownLine && ` 그런데 ${unknownLine}`}`;
  const rule = result.source === "rule";
  const outTitle = result.sample ? (rule ? "AI 결과물 예시" : `AI가 ${josa(lesson.sampleLabel.replace(/^예시 /, ""), ["을", "를"])} 읽고 낸 결과`) : "AI가 내 파일을 읽고 낸 결과";
  const coreMissed = lesson.check.core.map((c) => c.label).filter((label) => !result.check?.core.includes(label));

  return (
    <>
      <ResultHead title={title} desc={desc} score={`${met} / ${total}`} grade={result} wasDone={runner.wasDone} />
      <div className={l.split}>
        <div className={`${l.side} ${l.resultSide}`}>
          <section className={l.card} aria-labelledby="file-mine">
            <h2 id="file-mine" className={l.cardTitle}>
              내 프롬프트
            </h2>
            <p className={p.mine}>{draft}</p>
            <ul className={l.checks}>
              {result.criteria.map((c) => (
                <li key={c.label} className={c.met ? l.met : l.miss}>
                  <span className={l.icon}>{c.met ? <MetIcon /> : <MissIcon />}</span>
                  <span className={l.grow}>{c.label}</span>
                </li>
              ))}
            </ul>
          </section>
          {result.coaching && (
            <CoachCard
              question={result.coaching.question}
              hint={lesson.criteria.find((c) => c.question === result.coaching.question)?.hint}
            />
          )}
        </div>

        <section className={`${l.card} ${l.main} ${l.resultMain}`} aria-labelledby="file-output">
          <div className={l.cardHead}>
            <h2 id="file-output" className={l.cardTitle}>
              {result.output ? outTitle : "AI 결과"}
            </h2>
            {fileName && (
              <span className={p.sampleChip}>
                <FileIcon />
                {fileName}
              </span>
            )}
          </div>
          {result.output ? (
            <CheckedOutput text={result.output} unknown={unknown} />
          ) : (
            <p className={l.note}>AI가 연결되어 있지 않아 파일을 읽지 못했어요. 프롬프트만 채점했어요.</p>
          )}
          {result.check && (
            <div className={p.checkNotes}>
              <p>
                <b>{unknown.length ? `${unknownLabel} ${counted(unknown.length, "개")}` : `${josa(unknownLabel, ["은", "는"])} 없어요`}</b>{" "}
                <span className={p.muted}>
                  · {compareNote}
                  {unknown.length ? ` ${unknownNote}` : ""}
                </span>
              </p>
              <p>
                <b>{result.check.coreOk ? "핵심은 잘 담았어요" : "핵심이 덜 담겼어요"}</b>{" "}
                <span className={p.muted}>
                  ·{" "}
                  {result.check.coreOk ? result.check.core.join(", ") : `${coreMissed.join(", ")}${josa(coreMissed.at(-1) ?? "", ["이", "가"]).slice((coreMissed.at(-1) ?? "").length)} 보이지 않아요`}
                </span>
              </p>
            </div>
          )}
          {!result.sample && <p className={l.note}>내 파일은 정답이 없어요. 결과가 맞는지는 직접 확인해 보세요.</p>}
          {result.sample && rule && <p className={l.note}>AI가 연결되어 있지 않아 미리 만든 예시 결과를 보여 줘요.</p>}
        </section>
      </div>

      <div className={p.footer}>
        <div className={p.footerLinks}>
          <button type="button" className={l.secondary} onClick={() => runner.go("lecture")}>
            배우기 다시 보기
          </button>
          <button type="button" className={p.textLink} onClick={() => runner.onOpenCourse?.("verify")}>
            결과를 직접 확인하는 법은 과정 4에서 →
          </button>
        </div>
        {result.passed ? (
          <button type="button" className={l.primary} onClick={runner.onNext}>
            {runner.nextLabel}
          </button>
        ) : (
          <button type="button" className={l.primary} onClick={() => runner.go("practice")}>
            프롬프트 고쳐서 다시
          </button>
        )}
      </div>
    </>
  );
}
