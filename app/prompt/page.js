"use client";

// 프롬프트 도우미: 하고 싶은 일·읽는 사람·결과물 모양으로 다섯 요소 프롬프트를 만든다(일을 대신 하지 않는다).
// 디자인 캔버스 '화면 전체 점검'의 B1(빈 화면), B2(만든 뒤). AI가 연결되지 않으면 서버가 고른 값으로 만든 예시 결과를 준다(source: "rule").
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as api from "@/lib/api";
import { ScaleBar } from "@/components/Anatomy";
import { ExampleChip, NO_AI_TEXT } from "@/components/Common";
import { ElementChip, itemVars } from "@/components/lessonBits";
import { JOB } from "@/data/jobs";
import { ITEM } from "@/lib/items";
import { useAppState } from "@/components/AppState";
import { Tour } from "@/components/Tour";
import s from "./prompt.module.css";

const SHAPES = [
  { id: "auto", name: "정하지 않음" },
  { id: "text", name: "글" },
  { id: "list", name: "목록" },
  { id: "table", name: "표" },
  { id: "email", name: "이메일" },
];
const REFINE_OPTIONS = ["더 짧게", "표로 바꾸기", "요약 한 줄 추가", "예시 하나 넣기"];
const BLANK = /(\{\{.+?\}\})/;
const GENERATE_FAIL = "프롬프트를 만들지 못함 · 잠시 뒤 다시 시도";
const REFINE_FAIL = "고치지 못함 · 잠시 뒤 다시 시도";

function WithBlanks({ text }) {
  return (
    <>
      {text.split(BLANK).map((part, i) =>
        BLANK.test(part) ? (
          <span key={i} className="blank">
            {part.slice(2, -2)}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
const toPlainText = (prompt) =>
  prompt.segments.map((seg) => `[${seg.label}] ${seg.text.replace(/\{\{(.+?)\}\}/g, "[$1]")}`).join("\n");
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    if (!ok) throw new Error("copy failed");
  }
}

function EmptyResult({ error }) {
  return (
    <>
      {error && (
        <p className={`error ${s.alert}`} role="alert">
          {error}
        </p>
      )}
      <div className={s.emptyBar}>
        <ScaleBar found={[]} />
      </div>
      <p className={`${s.h3} ${s.emptyTitle}`}>아직 만든 프롬프트 없음</p>
      <p className={s.emptyCap}>
        왼쪽에 하고 싶은 일을 적고 &apos;프롬프트 만들기&apos; 누르기
        <br />
        다섯 요소를 갖춘 프롬프트와 줄별 이유 표시
      </p>
    </>
  );
}

export default function PromptHelper() {
  const { ready, profile, diagnosis } = useAppState();
  // 진단 전이면 직무가 없다. 아무 직무나 고르지 않고, 직무별 예시 대신 직무마다 하나씩 보여 준다(API에는 lib/api.js가 "직무 미정"으로 보낸다).
  const job = JOB[profile?.job] ? profile.job : null;
  const level = profile?.level ?? "초급";
  const examples = job ? JOB[job].examples : Object.values(JOB).map((j) => j.examples[0]);
  const purposeRef = useRef(null);
  const [purpose, setPurpose] = useState("");
  const [reader, setReader] = useState("");
  const [shape, setShape] = useState("auto");
  const [versions, setVersions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState("");
  const [showWhy, setShowWhy] = useState(level !== "고급");
  const [purposeError, setPurposeError] = useState(false);
  const [error, setError] = useState({ where: "", text: "" });
  const [toast, setToast] = useState("");
  const shown = versions[current];
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);
  // 서버 오류 문장은 화면에 그대로 쓰지 않는다(개발자용 문장이 섞여 있다). 화면 글은 여기서 정한 한 줄만.
  async function generate() {
    if (!purpose.trim()) {
      setPurposeError(true);
      purposeRef.current?.focus();
      return;
    }
    setPurposeError(false);
    setError({ where: "", text: "" });
    setBusy("generate");
    try {
      const prompt = await api.generatePrompt({ job, level, purpose, reader, shape });
      setVersions([prompt]);
      setCurrent(0);
    } catch {
      setError({ where: "generate", text: GENERATE_FAIL });
    } finally {
      setBusy("");
    }
  }
  async function refine(request) {
    if (!shown || !request.trim()) return;
    setError({ where: "", text: "" });
    setBusy("refine");
    try {
      const next = await api.refinePrompt(shown, request);
      setVersions((v) => [...v, { ...next, version: v.length + 1 }]);
      setCurrent(versions.length);
      setExtra("");
    } catch {
      setError({ where: "refine", text: REFINE_FAIL });
    } finally {
      setBusy("");
    }
  }
  async function copy() {
    if (!shown) return;
    try {
      await copyText(toPlainText(shown));
      setToast("프롬프트 복사함");
    } catch {
      setToast("복사 실패 · 직접 골라 복사하기");
    }
  }
  const generateError = error.where === "generate" ? error.text : "";
  return (
    <div className={s.page}>
      <Tour id="helper" />
      <div className={s.head}>
        <h1 className={s.title}>하고 싶은 일로 프롬프트 만들기</h1>
        {ready && diagnosis?.prompt && (
          <Link href="/diagnosis/prompt?edit=1" className={s.link}>
            진단 때 쓴 프롬프트 다시 고쳐 보기 →
          </Link>
        )}
        {ready && !profile && (
          <Link href="/" className={s.link}>
            진단 전 · 초급 기준으로 만듦. 내 수준 진단하기 →
          </Link>
        )}
      </div>

      <div className={`${s.grid} ${shown ? s.filled : ""}`}>
        <form
          className={`${s.card} ${s.form}`}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          <div data-tour="helper-input">
            <label className={s.label} htmlFor="purpose">
              하고 싶은 일
            </label>
            <textarea
              id="purpose"
              ref={purposeRef}
              rows={3}
              maxLength={2000}
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value);
                if (e.target.value.trim()) setPurposeError(false);
              }}
              placeholder="예: 이번 주 업무 보고서 작성"
              aria-invalid={purposeError || undefined}
              aria-describedby={purposeError ? "purpose-error" : undefined}
            />
            {purposeError && (
              <p id="purpose-error" className={`error ${s.fieldError}`} role="alert">
                하고 싶은 일 먼저 적기
              </p>
            )}
            <div className={`${s.picks} ${s.examples}`} role="group" aria-labelledby="examples-label">
              <span id="examples-label" className={s.cap}>
                예시로 채우기
              </span>
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  className={`chip ${s.pick}`}
                  onClick={() => {
                    setPurpose(example);
                    setPurposeError(false);
                  }}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className={s.field}>
            <label className={s.label} htmlFor="reader">
              읽는 사람 <span className={s.optional}>선택</span>
            </label>
            <input
              id="reader"
              type="text"
              maxLength={100}
              value={reader}
              onChange={(e) => setReader(e.target.value)}
              placeholder="예: 팀장님"
            />
          </div>

          <fieldset className={s.field}>
            <legend className={s.label}>결과물 모양</legend>
            <div className={s.picks}>
              {SHAPES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`chip ${s.pick}`}
                  aria-pressed={shape === item.id}
                  onClick={() => setShape(item.id)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </fieldset>

          <button className={`btn ${shown ? "ghost" : ""} ${s.submit}`} type="submit" disabled={busy !== ""}>
            {busy === "generate" ? "만드는 중…" : shown ? "다시 만들기" : "프롬프트 만들기"}
          </button>
        </form>

        <section
          className={`${s.card} ${s.out} ${!shown && busy !== "generate" ? s.empty : ""}`}
          aria-live="polite"
          aria-busy={busy !== ""}
          aria-label="만든 프롬프트"
          data-tour="helper-questions"
        >
          {busy === "generate" ? (
            <div className={s.skeleton} aria-label="프롬프트를 만드는 중">
              {[72, 90, 64, 84, 58].map((w) => (
                <span key={w} style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : !shown ? (
            <EmptyResult error={generateError} />
          ) : (
            <>
              {generateError && (
                <p className={`error ${s.alert}`} role="alert">
                  {generateError}
                </p>
              )}
              <div className={s.outHead}>
                <h2 className={s.h3}>만든 프롬프트</h2>
                {shown.source === "rule" && <ExampleChip />}
                <div className={s.tools}>
                  {versions.length > 1 && (
                    <div className={s.versions} role="group" aria-label="버전">
                      {versions.map((v, i) => (
                        <button
                          key={v.version}
                          type="button"
                          className={`chip ${s.version}`}
                          aria-pressed={i === current}
                          onClick={() => setCurrent(i)}
                        >
                          v{v.version}
                        </button>
                      ))}
                    </div>
                  )}
                  <label className="toggle">
                    <input type="checkbox" checked={showWhy} onChange={(e) => setShowWhy(e.target.checked)} />
                    이유 보기
                  </label>
                  <button type="button" className="btn small" onClick={copy}>
                    복사하기
                  </button>
                </div>
              </div>
              <div className={s.bar}>
                <ScaleBar found={[...new Set(shown.segments.map((seg) => seg.item))]} />
              </div>
              <ol className={s.lines}>
                {shown.segments.map((seg) => (
                  <li key={seg.key} className={s.line}>
                    {ITEM[seg.item] ? <ElementChip id={seg.item} /> : <span className={s.tag}>{seg.label}</span>}
                    <div>
                      <p className={s.text}>
                        <WithBlanks text={seg.text} />
                      </p>
                      {seg.isNew && (
                        <p className={s.changed} style={ITEM[seg.item] ? itemVars(seg.item) : undefined}>
                          v{shown.version}에서 바뀜
                        </p>
                      )}
                      {showWhy && <p className={s.cap}>{seg.why}</p>}
                    </div>
                  </li>
                ))}
              </ol>
              <div className={s.notes}>
                {shown.segments.some((seg) => BLANK.test(seg.text)) && (
                  <p className={s.cap}>점선 칸 = 나만 아는 정보 · 채워서 보내면 결과가 좋아짐</p>
                )}
                {shown.source === "rule" && <p className={s.cap}>{NO_AI_TEXT}. 연결 후에는 적은 일로 생성.</p>}
              </div>

              <div className={s.refine}>
                <label htmlFor="extra" className={s.label}>
                  더 고칠 점
                </label>
                <div className={s.picks}>
                  {REFINE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`chip ${s.pick}`}
                      disabled={busy !== ""}
                      onClick={() => refine(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <form
                  className={s.refineRow}
                  onSubmit={(e) => {
                    e.preventDefault();
                    refine(extra);
                  }}
                >
                  <input
                    id="extra"
                    type="text"
                    maxLength={500}
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                    placeholder="예: 다음 주 일정도 마지막에 넣어 줘"
                    className={s.input}
                  />
                  <button className={`btn ghost ${s.apply}`} type="submit" disabled={busy !== "" || !extra.trim()}>
                    {busy === "refine" ? "반영하는 중…" : "반영하기"}
                  </button>
                </form>
                {error.where === "refine" && (
                  <p className="error" role="alert">
                    {error.text}
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
