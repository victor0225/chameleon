"use client";

import Link from "next/link";
import { AnatomyText, ScaleBar, segVar } from "@/components/Anatomy";
import { useAppState } from "@/components/AppState";
import { EXPERIENCE, JOB } from "@/data/jobs";
import { ITEM } from "@/lib/items";
import { Progress } from "../_components/Progress";
import s from "../diagnosis.module.css";

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

export default function DiagnosisResult() {
  const { ready, diagnosis } = useAppState();

  if (!ready) {
    return (
      <div className={s.wrap}>
        <Progress step={3} />
      </div>
    );
  }

  if (!diagnosis) {
    return (
      <div className={s.wrap}>
        <div className={s.empty}>
          <h1 className="display">아직 진단 결과가 없어요</h1>
          <p className="muted">질문 두 개에 답하고 프롬프트를 한 번 써 보면 결과가 여기에 나와요.</p>
          <Link href="/diagnosis" className="btn">
            진단하러 가기
          </Link>
        </div>
      </div>
    );
  }

  const { level, found, missing, comment, segments, prompt, job, experience, at } = diagnosis;
  const target = JOB[job];

  return (
    <div className={s.wrap}>
      <div className={s.noPrint}>
        <Progress step={3} />
      </div>

      <article className={s.report} aria-labelledby="result-title">
        <header className={s.reportHead}>
          <h1 id="result-title" className="display">
            진단 결과
          </h1>
          <dl className={s.meta}>
            <div>
              <dt>진단 날짜</dt>
              <dd>{formatDate(at)}</dd>
            </div>
            {target && (
              <div>
                <dt>관심 직무</dt>
                <dd>{target.name}</dd>
              </div>
            )}
            {EXPERIENCE[experience] && (
              <div>
                <dt>AI 경험</dt>
                <dd>{EXPERIENCE[experience].title}</dd>
              </div>
            )}
          </dl>
        </header>

        <section className={s.levelRow} aria-label="지금 수준">
          <p className={`display ${s.level}`}>{level}</p>
          <p>
            다섯 요소 중 <strong>{found.length}개</strong>가 들어 있어요.{" "}
            {comment ||
              (missing.length > 0
                ? "아래 요소를 채우는 연습부터 시작해요."
                : "이미 탄탄해요. 더 어려운 업무로 연습해 보세요.")}
          </p>
        </section>

        <section className={s.section} aria-labelledby="result-prompt">
          <h2 id="result-prompt">내가 쓴 프롬프트</h2>
          {target && <p className="small muted">과제: {target.diagnosisTask}</p>}
          <AnatomyText text={prompt} segments={segments} className={s.promptBox} />
          <ScaleBar found={found} />
        </section>

        {missing.length > 0 && (
          <section className={s.section} aria-labelledby="result-missing">
            <h2 id="result-missing">채우면 좋은 요소</h2>
            <ul className="missing">
              {missing.map((id) => (
                <li key={id} style={segVar(ITEM[id].color)}>
                  <strong>{ITEM[id].name}</strong>
                  {ITEM[id].hint}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className={`small muted ${s.printOnly}`}>카멜레온에서 받은 프롬프트 진단 결과예요.</p>
      </article>

      <div className={`${s.resultActions} ${s.noPrint}`}>
        <div className={s.pdf}>
          <Link href="/diagnosis/report?print=1" target="_blank" className={`btn ${s.cta}`}>
            PDF로 저장하기
          </Link>
          <p className="small muted">새 탭의 저장 창에서 &lsquo;PDF로 저장&rsquo;을 고르세요.</p>
        </div>
        <Link href="/diagnosis" className="btn ghost">
          다시 진단하기
        </Link>
      </div>

      <section className={`${s.next} ${s.noPrint}`} aria-labelledby="next-title">
        <h2 id="next-title" className="display">
          이제 둘 중 하나를 골라 시작하세요
        </h2>
        <div className={s.services}>
          <Link href="/prompt" className={`service-card ${s.service}`}>
            <span className="service-no">서비스 1</span>
            <strong>프롬프트 작성 도우미</strong>
            <span className="flow">목적 입력 → 프롬프트 생성 → 수정 → 완성</span>
          </Link>
          <Link href="/learn" className={`service-card ${s.service}`}>
            <span className="service-no">서비스 2</span>
            <strong>AI 활용 교육</strong>
            <span className="flow">짧은 강의 → 문제 풀이 → 평가·피드백 → 레벨 상승</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
