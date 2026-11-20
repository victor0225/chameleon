import s from "../diagnosis.module.css";

const STEPS = ["설문", "프롬프트 써 보기", "결과"];

// 진단 세 단계 중 지금 어디에 있는지 막대와 단계 이름으로 보여 준다.
export function Progress({ step }) {
  return (
    <div className={s.progress}>
      <div className={s.track} aria-hidden="true">
        <span style={{ width: `${(step / STEPS.length) * 100}%` }} />
      </div>
      <ol className={s.steps} aria-label={`진단 ${STEPS.length}단계 중 ${step}단계`}>
        {STEPS.map((name, i) => {
          const n = i + 1;
          const state = n < step ? s.done : n === step ? s.current : undefined;
          return (
            <li key={name} className={state} aria-current={n === step ? "step" : undefined}>
              <span className={s.stepNum} aria-hidden="true">
                {n < step ? "✓" : n}
              </span>
              {name}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
