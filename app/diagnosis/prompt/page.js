"use client";

import { Suspense, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as api from "@/lib/api";
import { ScaleBar } from "@/components/Anatomy";
import { useAppState } from "@/components/AppState";
import { attachedFiles, entriesFrom, FileAttach, isUploading } from "@/components/FileAttach";
import { JOB } from "@/data/jobs";
import { analyze } from "@/lib/anatomy";
import { Progress } from "../_components/Progress";
import s from "../diagnosis.module.css";

// 주소의 ?edit=1을 읽는 useSearchParams는 Suspense 안에 있어야 미리 렌더링할 수 있다.
export default function DiagnosisPromptPage() {
  return (
    <Suspense
      fallback={
        <div className={s.wrap}>
          <Progress step={2} />
        </div>
      }
    >
      <DiagnosisPrompt />
    </Suspense>
  );
}

function DiagnosisPrompt() {
  const router = useRouter();
  const editing = useSearchParams().get("edit") === "1";
  const { ready, survey, diagnosis, setProfile, setDiagnosis } = useAppState();
  const [draft, setDraft] = useState("");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // 진단을 마치고 결과로 넘어갔는지. 쓰다가 "이전"으로 나간 글은 남기고, 진단을 마친 글만 비운다.
  const submitted = useRef(false);
  // cacheComponents에서는 다른 화면으로 가도 이 화면을 숨겨 두고 상태를 그대로 둔다.
  // 숨겨질 때 진단 중 표시를 풀고, 진단을 마친 뒤라면 칸도 비워서 "다시 진단하기"가 빈 칸으로 시작하게 한다.
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
  // "고쳐서 다시 진단하기", "내 프롬프트 직접 고쳐 보기"(?edit=1)로 들어오면 지난 프롬프트와 첨부 파일을 채워 둔다.
  // 숨겨진 화면은 지난 주소로 다시 그려지기도 해서 그리는 중이 아니라, 화면이 보일 때 도는 effect에서 채운다.
  const savedFiles = diagnosis?.files;
  useLayoutEffect(() => {
    if (!(ready && editing && diagnosis?.prompt)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 화면이 다시 보일 때 한 번 채우는 것이라 effect가 맞다.
    setDraft(diagnosis.prompt);
    setEntries(entriesFrom(savedFiles));
  }, [ready, editing, diagnosis?.prompt, savedFiles]);
  const uploading = isUploading(entries);
  const found = useMemo(() => analyze(draft).found, [draft]);
  const target = survey ? JOB[survey.job] : null;

  async function submit(e) {
    e.preventDefault();
    if (!draft.trim()) {
      setError("진단하려면 프롬프트를 한 줄 이상 써 주세요.");
      return;
    }
    if (uploading) return;
    setError("");
    setLoading(true);
    const { job, experience } = survey;
    const files = attachedFiles(entries);
    try {
      const result = await api.diagnose({ job, experience, prompt: draft, files });
      setProfile({ job, experience, level: result.level });
      setDiagnosis({
        ...result,
        prompt: draft,
        files,
        job,
        experience,
        at: new Date().toISOString(),
      });
      submitted.current = true;
      router.push("/diagnosis/result");
    } catch (err) {
      setLoading(false);
      setError(err?.message || "진단하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    }
  }

  if (!ready) {
    return (
      <div className={s.wrap}>
        <Progress step={2} />
      </div>
    );
  }

  if (!target) {
    return (
      <div className={s.wrap}>
        <div className={s.empty}>
          <h1 className="display">설문부터 답해 주세요</h1>
          <p className="muted">직무를 고르면 프롬프트를 써 볼 수 있어요.</p>
          <Link href="/diagnosis" className="btn">
            설문으로 가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      <Progress step={2} />
      <header className={s.head}>
        <h1 className="display">프롬프트 한 번 써 보기</h1>
        <p className="lede">정답은 없어요. 평소 AI에게 일을 맡기듯 그대로 써 주세요. 업무 자료가 있으면 같이 붙여도 돼요.</p>
      </header>

      <form className={s.form} onSubmit={submit} noValidate>
        <section className={s.question} aria-label="프롬프트 써 보기">
          <div className="field">
            <label htmlFor="diagnosis-prompt">AI에게 보낼 프롬프트</label>
            <FileAttach entries={entries} setEntries={setEntries} disabled={loading}>
              <textarea
                id="diagnosis-prompt"
                className={s.textarea}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="평소 AI에게 말하듯 그대로 써 보세요"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "diagnosis-prompt-error" : undefined}
              />
            </FileAttach>
          </div>
          <div className={s.live}>
            <ScaleBar found={found} />
            <p className="small muted">
              쓰는 동안 들어간 요소가 색으로 채워져요.
              {entries.length > 0 && " 붙인 파일은 요소로 세지 않아요. 프롬프트에서 파일을 가리켜야 해요."}
            </p>
          </div>
          {error && (
            <p id="diagnosis-prompt-error" className="error" role="alert">
              {error}
            </p>
          )}
        </section>

        <div className={s.actions}>
          <Link href="/diagnosis" className="btn ghost">
            이전
          </Link>
          <button type="submit" className={`btn ${s.cta}`} disabled={loading || uploading}>
            {loading ? "진단하는 중…" : uploading ? "파일 올리는 중…" : "진단 받기"}
          </button>
        </div>
      </form>
    </div>
  );
}
