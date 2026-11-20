"use client";

// A4 한 장짜리 진단 리포트. ?print=1로 열면 글꼴이 준비되는 대로 저장(인쇄) 창을 띄운다.
// 저장 창에서 대상을 'PDF로 저장'으로 고르면 파일이 된다. 파일 이름은 문서 제목을 따른다.
import { useEffect } from "react";
import Link from "next/link";
import { segVar } from "@/components/Anatomy";
import { useAppState } from "@/components/AppState";
import { LESSONS } from "@/data/curriculum";
import { EXPERIENCE, JOB } from "@/data/jobs";
import { analyze } from "@/lib/anatomy";
import { filesLine } from "@/lib/fileRules";
import { ITEM, ITEMS } from "@/lib/items";
import styles from "./report.module.css";

function fileTitle(iso) {
  const d = new Date(iso);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `카멜레온_진단결과_${ymd}`;
}

// 내 수준 강의 가운데 빠진 요소를 다루는 아직 안 끝낸 첫 강의. 없으면 내 수준의 아직 안 끝낸 첫 강의.
function recommendLesson(level, missing, completed) {
  const track = LESSONS.filter((l) => l.level === level && !completed.includes(l.id));
  return track.find((l) => missing.includes(l.focus)) ?? track[0] ?? null;
}

export default function ReportView() {
  const { ready, diagnosis, record } = useAppState();

  useEffect(() => {
    if (!ready || !diagnosis) return;
    document.title = fileTitle(diagnosis.at);
    if (new URLSearchParams(window.location.search).get("print") !== "1") return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) setTimeout(() => window.print(), 150);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, diagnosis]);

  if (!ready) return null;

  if (!diagnosis) {
    return (
      <div className={styles.wrap}>
        <div className={styles.empty}>
          <p>아직 진단 결과 없음</p>
          <Link href="/diagnosis" className="btn">
            진단하러 가기
          </Link>
        </div>
      </div>
    );
  }

  const { level, found, missing, comment, prompt, job, experience, at, files } = diagnosis;
  const segments = diagnosis.segments ?? analyze(prompt).segments;
  const lesson = recommendLesson(level, missing, record.completed);
  const date = new Date(at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <Link href="/diagnosis/result" className="btn ghost small">
          결과 화면으로
        </Link>
        <p className="small muted">저장 창에서 대상을 &lsquo;PDF로 저장&rsquo;으로 고르면 파일로 저장</p>
        <button type="button" className="btn small" onClick={() => window.print()}>
          PDF로 저장
        </button>
      </div>

      <article className={styles.sheet} aria-labelledby="report-title">
        <header className={styles.head}>
          <p className={styles.brand}>카멜레온 · AI 프롬프트 활용 진단</p>
          <h1 id="report-title">진단 결과</h1>
          <dl className={styles.meta}>
            {JOB[job] && (
              <div>
                <dt>관심 직무</dt>
                <dd>{JOB[job].name}</dd>
              </div>
            )}
            {EXPERIENCE[experience] && (
              <div>
                <dt>AI 사용 경험</dt>
                <dd>{EXPERIENCE[experience].title}</dd>
              </div>
            )}
            <div>
              <dt>진단일</dt>
              <dd>{date}</dd>
            </div>
          </dl>
        </header>

        <section className={styles.levelRow} aria-label="내 수준">
          <div>
            <p className={styles.label}>내 수준</p>
            <p className={styles.level}>{level}</p>
          </div>
          <p className={styles.comment}>
            다섯 요소 중 <strong>{found.length}개</strong> 포함.{comment ? ` ${comment}` : ""}
          </p>
        </section>

        <section className={styles.section}>
          <h2>다섯 요소 점검</h2>
          <ul className={styles.elements}>
            {ITEMS.map((item) => {
              const ok = found.includes(item.id);
              return (
                <li key={item.id} style={segVar(item.color)} className={ok ? styles.ok : styles.no}>
                  <span className={styles.chip}>{item.name}</span>
                  <span className={styles.state}>{ok ? "들어 있음" : "빠짐"}</span>
                  <span className={styles.hint}>{item.hint}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={styles.section}>
          <h2>내가 쓴 프롬프트</h2>
          <p className={styles.prompt}>
            {segments.map((s, i) =>
              s.items.length ? (
                <span key={i} className={styles.seg} style={segVar(ITEM[s.items[0]].color)}>
                  {s.text}
                </span>
              ) : (
                <span key={i}>{s.text}</span>
              ),
            )}
          </p>
          {files?.length > 0 && <p className={styles.files}>첨부한 파일: {filesLine(files)}</p>}
          <p className={styles.legend}>밑줄 색 = 문장에 들어 있는 요소</p>
        </section>

        {missing.length > 0 && (
          <section className={styles.section}>
            <h2>채우면 좋아지는 요소</h2>
            <ul className={styles.missing}>
              {missing.map((id) => (
                <li key={id} style={segVar(ITEM[id].color)}>
                  <strong>{ITEM[id].name}</strong> {ITEM[id].question}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={styles.section}>
          <h2>다음 단계</h2>
          <ol className={styles.next}>
            {lesson && (
              <li>
                AI 활용 교육에서 <strong>「{lesson.title}」</strong> 미션부터 시작 ({lesson.level} ·{" "}
                {ITEM[lesson.focus].name} 익히기)
              </li>
            )}
            <li>프롬프트 작성 도우미에서 실제 업무 프롬프트 만들기</li>
          </ol>
        </section>

        <footer className={styles.foot}>C팀 카멜레온 · {window.location.host}</footer>
      </article>
    </div>
  );
}
