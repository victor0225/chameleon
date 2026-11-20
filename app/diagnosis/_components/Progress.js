import { Steps } from "@/components/Common";
import s from "../diagnosis.module.css";

const STEPS = ["설문", "프롬프트 써 보기", "결과"];

// 진단 세 단계 중 지금 어디인지: 미션·결과 비교와 같은 알약 모양 단계 표시(공통 칸 ②)
export function Progress({ step }) {
  return <Steps steps={STEPS} current={step - 1} label={`진단 ${STEPS.length}단계 중 ${step}단계`} className={s.progress} />;
}
