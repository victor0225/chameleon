import s from "../diagnosis.module.css";

// 설문지의 선택 카드. 실제 radio input이라 방향키로 고르고 스크린 리더도 선택 상태를 읽는다.
export function Choice({ name, value, checked, onChange, title, desc }) {
  return (
    <label className={s.choice}>
      <input type="radio" className={s.radio} name={name} value={value} checked={checked} onChange={onChange} />
      <span className={s.choiceText}>
        <strong>{title}</strong>
        {desc && <span>{desc}</span>}
      </span>
    </label>
  );
}
