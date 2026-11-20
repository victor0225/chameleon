"use client";

import { Suspense, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as api from "@/lib/api";
import { ScaleBar } from "@/components/Anatomy";
import { useAppState } from "@/components/AppState";
import { attachedFiles, entriesFrom, FileAttach, isUploading } from "@/components/FileAttach";
import { Tour } from "@/components/Tour";
import { JOB } from "@/data/jobs";
import { analyze } from "@/lib/anatomy";
import { HOME_DRAFT_KEY } from "@/lib/homeDraft";
import { Progress } from "../_components/Progress";
import s from "../diagnosis.module.css";

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
  // 메인 입력 칸에 써 두고 온 글이 있으면 빈 칸에 한 번 채운다(캔버스 A1: 쓴 글을 들고 진단으로).
  useLayoutEffect(() => {
    if (editing) return;
    let saved = null;
    try {
      saved = sessionStorage.getItem(HOME_DRAFT_KEY);
      sessionStorage.removeItem(HOME_DRAFT_KEY);
    } catch {
      // 저장소를 못 쓰면 빈 칸으로 시작한다.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 화면이 보일 때 한 번 채우는 것이라 effect가 맞다.
    if (saved) setDraft((d) => d || saved);
  }, [editing]);
  const uploading = isUploading(entries);
  const found = useMemo(() => analyze(draft).found, [draft]);
  const target = survey ? JOB[survey.job] : null;

  async function submit(e) {
    e.preventDefault();
    if (!draft.trim()) {
      setError("프롬프트를 한 줄 이상 써야 진단 가능");
      return;
    }
    if (uploading) return;
    setError("");
    setLoading(true);
    const { job, experience } = survey;
    const files = attachedFiles(entries);
    // 고쳐서 다시 진단하면(?edit=1) 이전 진단을 한 단계만 남겨, 비교 화면이 "내가 고친 프롬프트" 모드로 연다.
    const before = editing && diagnosis?.prompt ? beforeOf(diagnosis) : undefined;
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
        ...(before && { before }),
      });
      submitted.current = true;
      router.push("/diagnosis/result");
    } catch (err) {
      setLoading(false);
      setError(err?.message || "진단하지 못함. 잠시 뒤 다시 시도.");
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
          <h1 className="display">설문부터 답하기</h1>
          <p className="muted">직무를 고르면 프롬프트 써 보기 가능</p>
          <Link href="/diagnosis" className="btn">
            설문으로 가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      <Tour id="diagnosis" />
      <Progress step={2} />
      <h1 className={`display ${s.centerTitle}`}>프롬프트 한 번 써 보기</h1>

      <form className={s.form} onSubmit={submit} noValidate>
        <section className={s.surveyCard} aria-label="프롬프트 써 보기">
          <div className="field">
            <label htmlFor="diagnosis-prompt">AI에게 보낼 프롬프트</label>
            <FileAttach entries={entries} setEntries={setEntries} disabled={loading}>
              <textarea
                id="diagnosis-prompt"
                data-tour="diagnosis-input"
                className={s.textarea}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="평소 AI에게 일을 맡기듯 그대로 쓰기. 정답 없음"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "diagnosis-prompt-error" : undefined}
              />
            </FileAttach>
          </div>
          <div className={s.live} data-tour="diagnosis-meter">
            <ScaleBar found={found} />
            <p className={s.note}>
              쓰는 동안 들어간 요소가 색으로 채워짐
              {entries.length > 0 ? " · 파일은 요소로 안 셈. 프롬프트에서 파일 가리키기" : " · 업무 자료는 파일로 붙이기 가능"}
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
