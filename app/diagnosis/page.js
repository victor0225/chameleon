"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/AppState";
import { AI_USE, AI_USES, EXPERIENCE, EXPERIENCES, JOB, JOBS } from "@/data/jobs";
import { Choice } from "./_components/Choice";
import { Progress } from "./_components/Progress";
import s from "./diagnosis.module.css";

export default function Survey() {
  const router = useRouter();
  const { survey, profile, setSurvey } = useAppState();
  // 고른 답이 없으면 지난 설문이나 진단 때 답을 미리 골라 둔다. 저장소를 읽기 전에는 둘 다 비어 있다.
  const saved = survey ?? profile;
  const [picked, setPicked] = useState({});
  const job = picked.job ?? (JOB[saved?.job] ? saved.job : null);
  const experience = picked.experience ?? (EXPERIENCE[saved?.experience] ? saved.experience : null);
  // 3번은 여러 개를 고르고, 안 골라도 넘어갈 수 있다.
  const uses = picked.uses ?? (survey?.uses ?? []).filter((id) => AI_USE[id]);
  const answered = Boolean(job && experience);

  function toggleUse(id) {
    setPicked((p) => {
      const now = p.uses ?? uses;
      return { ...p, uses: now.includes(id) ? now.filter((u) => u !== id) : AI_USES.map((u) => u.id).filter((u) => u === id || now.includes(u)) };
    });
  }

  function next(e) {
    e.preventDefault();
    if (!answered) return;
    setSurvey({ job, experience, uses });
    router.push("/diagnosis/prompt");
  }

  return (
    <div className={s.wrap}>
      <Progress step={1} />
      <header className={s.head}>
        <h1 className="display">내 수준 진단하기</h1>
        <p className="lede">몇 가지를 고르고 프롬프트를 한 번 써 보면, 지금 수준과 먼저 채울 요소를 알려 드려요.</p>
      </header>

      <form className={s.form} onSubmit={next}>
        <section className={s.question} aria-labelledby="q-job">
          <h2 id="q-job" className={s.qTitle}>
            <span className={s.qNum}>1</span> 어떤 직무에서 AI를 쓰고 싶나요?
          </h2>
          <div className={s.choices} role="radiogroup" aria-labelledby="q-job">
            {JOBS.map((j) => (
              <Choice
                key={j.id}
                name="job"
                value={j.id}
                checked={job === j.id}
                onChange={() => setPicked((p) => ({ ...p, job: j.id }))}
                title={j.name}
                desc={j.examples.join(" · ")}
              />
            ))}
          </div>
        </section>

        <section className={s.question} aria-labelledby="q-experience">
          <h2 id="q-experience" className={s.qTitle}>
            <span className={s.qNum}>2</span> AI를 얼마나 써 봤나요?
          </h2>
          <div className={s.choices} role="radiogroup" aria-labelledby="q-experience">
            {EXPERIENCES.map((e) => (
              <Choice
                key={e.id}
                name="experience"
                value={e.id}
                checked={experience === e.id}
                onChange={() => setPicked((p) => ({ ...p, experience: e.id }))}
                title={e.title}
                desc={e.desc}
              />
            ))}
          </div>
        </section>

        <section className={s.question} aria-labelledby="q-uses">
          <h2 id="q-uses" className={s.qTitle}>
            <span className={s.qNum}>3</span> AI를 이렇게 써 봤어요
          </h2>
          <p className={s.qHint}>해당하는 것을 모두 골라 주세요. 없으면 그냥 넘어가도 돼요.</p>
          <div className={s.choices} role="group" aria-labelledby="q-uses">
            {AI_USES.map((u) => (
              <Choice
                key={u.id}
                type="checkbox"
                name="uses"
                value={u.id}
                checked={uses.includes(u.id)}
                onChange={() => toggleUse(u.id)}
                title={u.title}
                desc={u.desc}
              />
            ))}
          </div>
        </section>

        <div className={s.actions}>
          {!answered && <p className="small muted">1번과 2번에 답하면 다음으로 넘어가요.</p>}
          <button type="submit" className={`btn ${s.cta}`} disabled={!answered}>
            다음
          </button>
        </div>
      </form>
    </div>
  );
}
