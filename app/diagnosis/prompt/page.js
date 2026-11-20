"use client";

import { Suspense, useLayoutEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as api from "@/lib/api";
import { ScaleBar } from "@/components/Anatomy";
import { useAppState } from "@/components/AppState";
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
  // 결과 화면의 "고쳐서 다시 진단하기"(?edit=1)로 들어오면 저장소를 읽은 뒤 한 번만 지난 프롬프트를 채워 둔다.
  const [prefilled, setPrefilled] = useState(false);
  if (ready && !prefilled) {
    setPrefilled(true);
    if (editing && diagnosis?.prompt) setDraft(diagnosis.prompt);
  }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // cacheComponents에서는 다른 화면으로 가도 이 화면을 숨겨 두고 상태를 그대로 둔다.
  // 숨겨질 때 진단 중 표시를 풀고, 다시 들어올 때 고쳐 쓰기 채우기를 한 번 더 하게 한다.
  useLayoutEffect(
    () => () => {
      setLoading(false);
      setPrefilled(false);
    },
    [],
  );
  const found = useMemo(() => analyze(draft).found, [draft]);
  const target = survey ? JOB[survey.job] : null;

  async function submit(e) {
    e.preventDefault();
    if (!draft.trim()) {
      setError("진단하려면 프롬프트를 한 줄 이상 써 주세요.");
      return;
    }
    setError("");
    setLoading(true);
    const { job, experience } = survey;
    try {
      const result = await api.diagnose({ job, experience, prompt: draft });
      setProfile({ job, experience, level: result.level });
      setDiagnosis({
        ...result,
        prompt: draft,
        task: target.diagnosisTask,
        job,
        experience,
        at: new Date().toISOString(),
      });
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
          <p className="muted">직무를 골라야 그 직무의 과제로 프롬프트를 써 볼 수 있어요.</p>
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
        <p className="lede">정답은 없어요. 평소 AI에게 말하듯 써야 지금 수준이 정확하게 나와요.</p>
      </header>

      <form className={s.form} onSubmit={submit} noValidate>
        <section className={s.question} aria-label="프롬프트 써 보기">
          <figure className={s.task}>
            <blockquote>{target.diagnosisTask}</blockquote>
            <figcaption>{target.name} 직무 과제</figcaption>
          </figure>
          <div className="field">
            <label htmlFor="diagnosis-prompt">AI에게 보낼 프롬프트</label>
            <textarea
              id="diagnosis-prompt"
              className={s.textarea}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="평소 AI에게 말하듯 그대로 써 보세요"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "diagnosis-prompt-error" : undefined}
            />
          </div>
          <div className={s.live}>
            <ScaleBar found={found} />
            <p className="small muted">쓰는 동안 들어간 요소가 색으로 채워져요.</p>
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
          <button type="submit" className={`btn ${s.cta}`} disabled={loading}>
            {loading ? "진단하는 중…" : "진단 받기"}
          </button>
        </div>
      </form>
    </div>
  );
}
