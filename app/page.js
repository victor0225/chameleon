"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnatomyText, ScaleBar } from "@/components/Anatomy";
import { useAppState } from "@/components/AppState";
import { analyze } from "@/lib/anatomy";
import s from "./home.module.css";
const BEFORE = "보고서 써줘";
const AFTER_LINES = [
  "이번 주 업무 보고서를 써 줘.",
  "팀장님이 월요일 회의 전에 읽을 거야.",
  "500자 이내, 격식 있는 말투로.",
  "완료, 진행 중, 다음 주 계획 세 칸의 표로 정리해 줘.",
  "내 메모에 없는 내용은 지어내지 말고 질문해 줘.",
];
const AFTER = AFTER_LINES.join("\n");
// 줄마다 앞 줄들의 조각 수를 더해 두고, 밑줄이 첫 줄부터 차례로 그려지게 한다.
const AFTER_OFFSETS = AFTER_LINES.map((_, i) =>
  AFTER_LINES.slice(0, i).reduce((sum, line) => sum + analyze(line).segments.length, 0),
);
const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
function Demo() {
  const [after, setAfter] = useState(false);
  // 첫 화면에서 한 번만 자동으로 넘긴다. window는 브라우저에서만 있으니 effect 안에서 읽는다.
  useEffect(() => {
    const timer = setTimeout(() => setAfter(true), prefersReducedMotion() ? 0 : 1600);
    return () => clearTimeout(timer);
  }, []);
  const text = after ? AFTER : BEFORE;
  return (
    <figure className="card demo">
      <div className="seg-toggle" role="group" aria-label="예시 프롬프트 보기">
        <button type="button" aria-pressed={!after} onClick={() => setAfter(false)}>
          처음 쓴 프롬프트
        </button>
        <button type="button" aria-pressed={after} onClick={() => setAfter(true)}>
          다듬은 프롬프트
        </button>
      </div>
      <div key={after ? "after" : "before"} className="demo-text">
        {after ? (
          AFTER_LINES.map((line, i) => <AnatomyText key={line} text={line} animate delayOffset={AFTER_OFFSETS[i]} />)
        ) : (
          <AnatomyText text={BEFORE} animate />
        )}
      </div>
      <ScaleBar found={analyze(text).found} />
      <figcaption>밑줄 색은 프롬프트에 들어 있는 요소예요. 다섯 칸이 찰수록 AI가 원하는 결과에 가까워져요.</figcaption>
    </figure>
  );
}
export default function Home() {
  const { diagnosis } = useAppState();
  return (
    <div className={`page ${s.home}`}>
      <section className="hero">
        <div>
          <h1 className="display">
            AI가 알아듣게
            <br />
            일을 맡기는 법
          </h1>
          <p className="lede">
            AI가 엉뚱한 답을 내는 건 대개 프롬프트에 무언가 빠졌기 때문이에요. 무엇이 빠졌는지 색으로 보여 드리고,
            직무별 과제로 수준에 맞춰 연습하게 도와드려요.
          </p>
          <div className="row">
            <Link href="/diagnosis" className="btn">
              내 수준 진단하기
            </Link>
            {diagnosis && (
              <Link href="/diagnosis/result" className="btn ghost">
                지난 진단 결과 보기
              </Link>
            )}
          </div>
        </div>
        <Demo />
      </section>
    </div>
  );
}
