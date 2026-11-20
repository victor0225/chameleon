"use client";

// 첫 화면(보드 K2): 진단 입구. 평소 하던 말을 쓰면 빠진 요소가 색 막대로 보이고, '진단하기'를 누르면 설문 없이 바로 결과로 간다.
// 입력 칸 예시 문장은 관심 직무에 맞춘다. 파일·그림을 붙이면 입력 칸 아래 칩으로 보이고, 진단하는 중에는 입력과 첨부를 잠근다.
// ?edit=1(결과 화면의 '고쳐서 다시 진단하기')이면 지난 프롬프트와 파일을 채우고, 이전 진단을 비교용으로 한 단계 남긴다.
import { Suspense, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as api from "@/lib/api";
import { Logo, ScaleBar } from "@/components/Anatomy";
import { useAppState } from "@/components/AppState";
import { ArrowIcon } from "@/components/Common";
import { attachedFiles, ClipIcon, entriesFrom, FileAttach, isUploading } from "@/components/FileAttach";
import { Tour } from "@/components/Tour";
import { JOB, NO_JOB_PLACEHOLDER } from "@/data/jobs";
import { analyze } from "@/lib/anatomy";
import s from "./home.module.css";

// 이전 진단에서 비교에 쓸 것만 남긴다. before.before는 버린다.
// guess는 결과 화면의 추측 결과, 없으면 결과 비교에서 받은 내 결과를 쓴다.
function beforeOf(d) {
  const guess = d.guess?.output ? d.guess : (d.compare?.mine ?? d.guess ?? null);
  return {
    prompt: d.prompt,
    found: d.found ?? [],
    missing: d.missing ?? [],
    segments: d.segments,
    files: d.files ?? [],
    guess,
    at: d.at,
  };
}

// 주소의 ?edit=1을 읽는 useSearchParams는 Suspense 안에 있어야 미리 렌더링할 수 있다.
export default function HomePage() {
  return (
    <Suspense fallback={<HomeFrame />}>
      <Home />
    </Suspense>
  );
}

function HomeFrame({ children }) {
  return (
    <div className={`page ${s.home}`}>
      <h1 className={`display ${s.title}`}>프롬프트 진단과 AI 활용 교육</h1>
      <p className={s.brand}>
        <Logo />
        카멜레온
      </p>
      {children}
    </div>
  );
}

function Home() {
  const router = useRouter();
  const editing = useSearchParams().get("edit") === "1";
  const { ready, profile, diagnosis, setDiagnosis } = useAppState();
  const [draft, setDraft] = useState("");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const input = useRef(null);
  // 진단을 마치고 결과로 넘어갔는지. 진단을 마친 글만 비우고, 쓰다가 다른 화면으로 간 글은 남긴다.
  const submitted = useRef(false);
  const found = analyze(draft).found;
  const job = JOB[profile?.job] ? profile.job : null;
  const uploading = isUploading(entries);

  // cacheComponents에서는 다른 화면으로 가도 이 화면을 숨겨 두고 상태를 그대로 둔다.
  // 숨겨질 때 진단 중 표시를 풀고, 진단을 마친 뒤라면 칸도 비워서 다음 진단이 빈 칸으로 시작하게 한다.
  useLayoutEffect(
    () => () => {
      setLoading(false);
      if (submitted.current) {
        submitted.current = false;
        setDraft("");
        setEntries([]);
        setError("");
      }
    },
    [],
  );
  // '고쳐서 다시 진단하기'(?edit=1)로 들어오면 지난 프롬프트와 첨부 파일을 채워 둔다.
  // 숨겨진 화면은 지난 주소로 다시 그려지기도 해서 그리는 중이 아니라, 화면이 보일 때 도는 effect에서 채운다.
  const savedFiles = diagnosis?.files;
  useLayoutEffect(() => {
    if (!(ready && editing && diagnosis?.prompt)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 화면이 다시 보일 때 한 번 채우는 것이라 effect가 맞다.
    setDraft(diagnosis.prompt);
    setEntries(entriesFrom(savedFiles));
  }, [ready, editing, diagnosis?.prompt, savedFiles]);

  async function submit(e) {
    e.preventDefault();
    if (!draft.trim()) {
      setError("프롬프트를 한 줄 이상 써야 진단 가능");
      input.current?.focus();
      return;
    }
    if (uploading || loading) return;
    setError("");
    setLoading(true);
    const files = attachedFiles(entries);
    // 고쳐서 다시 진단하면 이전 진단을 한 단계만 남겨, 비교 화면이 "내가 고친 프롬프트" 모드로 연다.
    const before = editing && diagnosis?.prompt ? beforeOf(diagnosis) : undefined;
    try {
      const result = await api.diagnose({ job, prompt: draft, files });
      setDiagnosis({
        ...result,
        prompt: draft,
        files,
        job,
        at: new Date().toISOString(),
        ...(before && { before }),
      });
      submitted.current = true;
      router.push("/diagnosis/result");
    } catch (err) {
      setLoading(false);
      setError(err?.message || "진단하지 못함. 잠시 뒤 다시 시도.");
    }
  }

  return (
    <HomeFrame>
      <Tour id="home" />
      <form className={`card ${s.card}`} onSubmit={submit} noValidate data-tour="home-input">
        <FileAttach
          entries={entries}
          setEntries={setEntries}
          disabled={loading}
          bare
          footer={({ open, full, disabled }) => (
            <>
              <ScaleBar found={found} />
              <div className={s.row}>
                <span className={s.count}>
                  채운 요소 <b className="mono">{found.length}/5</b>
                </span>
                <button type="button" className={`btn ghost ${s.attach}`} onClick={open} disabled={disabled || full}>
                  <ClipIcon />
                  파일·그림 첨부
                </button>
                <button type="submit" className={`btn ${s.cta}`} disabled={loading || uploading} aria-busy={loading || undefined}>
                  {loading ? (
                    <>
                      <span className={s.spinner} aria-hidden="true" />
                      진단하는 중…
                    </>
                  ) : uploading ? (
                    "파일 올리는 중…"
                  ) : (
                    <>
                      진단하기
                      <ArrowIcon />
                    </>
                  )}
                </button>
              </div>
              {error && (
                <p id="home-prompt-error" className="error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        >
          <label htmlFor="home-prompt" className={s.srOnly}>
            평소 AI에게 하던 말
          </label>
          <div className={`${s.field} ${loading ? s.locked : ""}`}>
            <input
              ref={input}
              id="home-prompt"
              className={s.input}
              value={draft}
              maxLength={3000}
              autoComplete="off"
              readOnly={loading}
              placeholder={JOB[job]?.placeholder ?? NO_JOB_PLACEHOLDER}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "home-prompt-error" : undefined}
              onChange={(e) => setDraft(e.target.value)}
            />
            {loading && <LockIcon />}
          </div>
        </FileAttach>
      </form>
    </HomeFrame>
  );
}

function LockIcon() {
  return (
    <svg className="lock" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
