"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as api from "@/lib/api";
import { ScaleBar, segVar } from "@/components/Anatomy";
import { JOB } from "@/data/jobs";
import { ITEM } from "@/lib/items";
import { useAppState } from "@/components/AppState";
import { Tour } from "@/components/Tour";
const SHAPES = [
  { id: "auto", name: "정하지 않음" },
  { id: "text", name: "글" },
  { id: "list", name: "목록" },
  { id: "table", name: "표" },
  { id: "email", name: "이메일" },
];
const REFINE_OPTIONS = ["더 짧게", "표로 바꿔 줘", "요약 한 줄 추가", "예시 하나 넣어 줘"];
const BLANK = /(\{\{.+?\}\})/;
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
  prompt.segments.map((s) => `[${s.label}] ${s.text.replace(/\{\{(.+?)\}\}/g, "[$1]")}`).join("\n");
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
export default function PromptHelper() {
  const { profile, diagnosis } = useAppState();
  // 진단 전이면 직무가 없다. 아무 직무나 고르지 않고, 직무별 예시 대신 직무마다 하나씩 보여 준다(API에는 lib/api.js가 "직무 미정"으로 보낸다).
  const job = JOB[profile?.job] ? profile.job : null;
  const level = profile?.level ?? "초급";
  const examples = job ? JOB[job].examples : Object.values(JOB).map((j) => j.examples[0]);
  const [purpose, setPurpose] = useState("");
  const [reader, setReader] = useState("");
  const [shape, setShape] = useState("auto");
  const [versions, setVersions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState("");
  const [showWhy, setShowWhy] = useState(level !== "고급");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const shown = versions[current];
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);
  async function generate() {
    if (!purpose.trim()) {
      setError("하고 싶은 일을 먼저 적어 주세요.");
      return;
    }
    setError("");
    setBusy("generate");
    try {
      const prompt = await api.generatePrompt({ job, level, purpose, reader, shape });
      setVersions([prompt]);
      setCurrent(0);
    } catch (err) {
      setError(err?.message || "생성에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy("");
    }
  }
  async function refine(request) {
    if (!shown || !request.trim()) return;
    setError("");
    setBusy("refine");
    try {
      const next = await api.refinePrompt(shown, request);
      setVersions((v) => [...v, { ...next, version: v.length + 1 }]);
      setCurrent(versions.length);
      setExtra("");
    } catch (err) {
      setError(err?.message || "수정에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy("");
    }
  }
  async function copy() {
    if (!shown) return;
    try {
      await copyText(toPlainText(shown));
      setToast("프롬프트를 복사했어요");
    } catch {
      setToast("복사하지 못했어요. 직접 선택해서 복사해 주세요");
    }
  }
  return (
    <div className="page">
      <header className="page-head">
        <h1 className="display">프롬프트 작성 도우미</h1>
        <p className="lede">하고 싶은 일을 적으면, 빠짐없는 프롬프트로 만들어 드려요.</p>
      </header>

      {!profile && (
        <p className="notice">
          진단 전이라 초급·사무·행정 기준으로 만들어요. <Link href="/">내 수준 진단하기</Link>
        </p>
      )}
      {diagnosis?.prompt && (
        <p className="notice">
          여기서 익힌 대로 진단 때 쓴 프롬프트를 직접 고쳐 보면, 고치기 전과 결과를 비교할 수 있어요.{" "}
          <Link href="/diagnosis/prompt?edit=1">진단 프롬프트 다시 고쳐 보기</Link>
        </p>
      )}

      <Tour id="helper" />
      <div className="helper">
        <form
          className="card helper-form"
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          <div className="field" data-tour="helper-input">
            <label htmlFor="purpose">무엇을 하고 싶나요?</label>
            <textarea
              id="purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="예: 이번 주 업무 보고서 작성"
            />
            <div className="chips" aria-label={job ? `${JOB[job].name} 예시` : "예시"}>
              {examples.map((example) => (
                <button key={example} type="button" className="chip chip-sm" onClick={() => setPurpose(example)}>
                  {example}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="reader">
              누가 읽나요? <span className="muted">(선택)</span>
            </label>
            <input
              id="reader"
              type="text"
              value={reader}
              onChange={(e) => setReader(e.target.value)}
              placeholder="예: 팀장님"
            />
          </div>
          <fieldset className="field">
            <legend className="label">결과물 모양</legend>
            <div className="chips">
              {SHAPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="chip"
                  aria-pressed={shape === s.id}
                  onClick={() => setShape(s.id)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </fieldset>
          <button className="btn" type="submit" disabled={busy !== ""}>
            {busy === "generate" ? "만드는 중…" : versions.length ? "처음부터 다시 만들기" : "프롬프트 만들기"}
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </form>

        <section className="card output-card" aria-live="polite" aria-busy={busy !== ""} data-tour="helper-questions">
          {busy === "generate" ? (
            <div className="skeleton" aria-label="프롬프트를 만드는 중">
              {[72, 90, 64, 84, 58].map((w) => (
                <span key={w} style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : !shown ? (
            <div className="empty">
              <ScaleBar found={[]} />
              <p>왼쪽에 하고 싶은 일을 적어 보세요. 다섯 요소를 갖춘 프롬프트가 여기에 만들어져요.</p>
            </div>
          ) : (
            <>
              <div className="out-head">
                <h2 className="display">완성된 프롬프트</h2>
                {versions.length > 1 && (
                  <div className="versions" role="group" aria-label="버전">
                    {versions.map((v, i) => (
                      <button key={v.version} type="button" aria-pressed={i === current} onClick={() => setCurrent(i)}>
                        v{v.version}
                      </button>
                    ))}
                  </div>
                )}
                <label className="toggle">
                  <input type="checkbox" checked={showWhy} onChange={(e) => setShowWhy(e.target.checked)} />
                  설명 보기
                </label>
                <button type="button" className="btn small" onClick={copy}>
                  복사하기
                </button>
              </div>
              <ScaleBar found={[...new Set(shown.segments.map((s) => s.item))]} />
              <ol className="plines">
                {shown.segments.map((s) => (
                  <li key={s.key} className={s.isNew ? "pline is-new" : "pline"} style={segVar(ITEM[s.item].color)}>
                    <span className="ptag">{s.label}</span>
                    <span className="ptext">
                      <span className="seg">
                        <WithBlanks text={s.text} />
                      </span>
                    </span>
                    {s.isNew && <span className="new">v{shown.version}에서 바뀜</span>}
                    {showWhy && <span className="why">{s.why}</span>}
                  </li>
                ))}
              </ol>
              {shown.segments.some((s) => BLANK.test(s.text)) && (
                <p className="hint">점선 칸은 나만 아는 정보예요. 채워서 보내면 결과가 훨씬 좋아져요.</p>
              )}
              <div className="refine">
                {error && <p className="error" role="alert">{error}</p>}
                <label htmlFor="extra" className="label">
                  더 바꾸고 싶은 점이 있나요?
                </label>
                <div className="chips">
                  {REFINE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="chip chip-sm"
                      disabled={busy !== ""}
                      onClick={() => refine(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <form
                  className="refine-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    refine(extra);
                  }}
                >
                  <input
                    id="extra"
                    type="text"
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                    placeholder="예: 다음 주 일정도 마지막에 넣어 줘"
                  />
                  <button className="btn" type="submit" disabled={busy !== "" || !extra.trim()}>
                    {busy === "refine" ? "반영하는 중…" : "반영하기"}
                  </button>
                </form>
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
