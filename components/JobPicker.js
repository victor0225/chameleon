"use client";

// 관심 직무 고르기(보드 K4·K5). 한 줄에 한 직무: 동그라미 · 직무 이름 · 예시 업무 셋. 회원가입과 내 정보가 같이 쓴다.
// 고른 줄은 옅은 면 + 굵은 진한 테두리 + 채운 동그라미(체크). error가 있으면 모든 줄 테두리를 오류색으로 하고 아래에 한 줄.
// 줄마다 role="radio" 버튼이라 Tab·Enter·Space로 고르고, 위아래 화살표로 줄 사이를 옮겨 다닌다.
// 화살표로는 고르지 않는다: 내 정보는 고르자마자 저장하고 닫으니, 옮겨 다니기만 해도 저장되면 안 된다.
import { CheckIcon, InfoIcon } from "@/components/Common";
import { JOBS } from "@/data/jobs";
import s from "./jobPicker.module.css";

const NEXT_KEYS = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

// value: 고른 직무 id 또는 null, onChange(id), error: 오류 문구(없으면 ""),
// label: 칸 이름. hideLabel이면 글자는 숨기고 읽기 프로그램에만 알린다(카드 제목이 이미 있는 내 정보).
// ref: 묶음(radiogroup) 요소. 가입에서 직무 없이 누르면 첫 줄로 초점을 옮길 때 쓴다.
export function JobPicker({ value, onChange, error = "", label = "관심 직무", hideLabel = false, id = "job", ref }) {
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;

  function onKeyDown(e) {
    const step = NEXT_KEYS[e.key];
    if (!step) return;
    const radios = [...e.currentTarget.querySelectorAll('[role="radio"]')];
    const at = radios.indexOf(document.activeElement);
    if (at < 0) return;
    e.preventDefault();
    radios[(at + step + radios.length) % radios.length].focus();
  }

  return (
    <div className={s.wrap}>
      {!hideLabel && (
        <p id={labelId} className={s.label}>
          {label}
        </p>
      )}
      <div
        ref={ref}
        role="radiogroup"
        aria-labelledby={hideLabel ? undefined : labelId}
        aria-label={hideLabel ? label : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${s.list}${error ? ` ${s.bad}` : ""}`}
        onKeyDown={onKeyDown}
      >
        {JOBS.map((job) => {
          const on = value === job.id;
          return (
            <button
              key={job.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`${s.row}${on ? ` ${s.on}` : ""}`}
              onClick={() => onChange(job.id)}
            >
              <span className={s.mark} aria-hidden="true">
                {on && <CheckIcon size={12} />}
              </span>
              <span className={s.text}>
                <span className={s.name}>{job.name}</span>
                <span className={s.examples}>{job.examples.join(" · ")}</span>
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className={s.error} role="alert">
          <InfoIcon size={16} />
          {error}
        </p>
      )}
    </div>
  );
}
