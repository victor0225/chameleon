"use client";

// 결과 비교의 "내가 고친 프롬프트" 모드. 고쳐서 다시 진단해 diagnosis.before가 있으면 이 모드로 연다.
// AI가 다듬은 프롬프트 모드(page.js)와 같은 한 화면 틀이다(작업 O-1): 1행 두 프롬프트, 2행 두 결과, 바뀐 점, 추천 미션.
//   왼쪽 고치기 전: before.guess 결과물을 다시 쓴다. 없으면 /api/compare mine을 before.prompt로 부른다.
//   오른쪽 내가 고친 프롬프트: 새 진단의 밑줄과, 고치기 전보다 늘어난 요소("새로 채움").
//   다듬은 결과: run을 { prompt: before.prompt, missing: before.missing, improved: 새 프롬프트, before: 처음 결과물 }로 부른다.
// 받은 결과는 diagnosis.before.guess와 diagnosis.compareBefore에 붙여 저장한다.
// 키가 없으면 결과물 없이, 비어 있던 요소가 채워졌는지로 바뀐 점을 보여 준다.
// 고쳐 보는 게 목적이라 "한 번 더 고쳐 보기"를 제목 옆 보조 링크로 둔다. 빠진 요소가 없으면 추천 대신 "교육 과정 보기"가 주 버튼.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { useAppState } from "@/components/AppState";
import { ForYou } from "@/app/learn/ForYou";
import { ITEM } from "@/lib/items";
import s from "./compare.module.css";
import { Arrow, Bar, Chip, DiffList, FailBar, FilesLine, IDS, LengthLine, Making, MarkedOutput, PromptText } from "./parts";

const dateOf = (at) => new Date(at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

export function SelfCompare({ onAiCompare }) {
  const { diagnosis, setDiagnosis } = useAppState();
  const router = useRouter();
  const [focus, setFocus] = useState(null);
  const [failure, setFailure] = useState(null);
  const [ruleAt, setRuleAt] = useState(null);
  const running = useRef(null);

  // 숨겨질 때 강조를 풀고, 실패와 규칙 모드를 풀어 다시 들어오면 새로 받아 오게 한다.
  useLayoutEffect(
    () => () => {
      setFocus(null);
      setFailure(null);
      setRuleAt(null);
    },
    [],
  );

  const before = diagnosis.before;
  const at = diagnosis.at;
  const mineOut = before.guess?.output ? before.guess : null;
  const run = diagnosis.compareBefore?.run ?? null;
  const phase = !mineOut ? 0 : !run ? 1 : 2;
  const rule = ruleAt === at || (before.guess && !before.guess.output && before.guess.source === "rule");
  const fail = failure?.at === at ? failure : null;
  const needsRun = Boolean(phase < 2 && !fail && !rule);

  const start = useCallback(
    async (target) => {
      running.current = target.at;
      const b = target.before;
      const keep = (patch) => setDiagnosis((prev) => (prev?.at === target.at ? { ...prev, ...patch(prev) } : prev));
      let mine = b.guess?.output ? b.guess : null;
      let current = 0;
      try {
        if (!mine) {
          const r = await api.compareStep("mine", { job: target.job, prompt: b.prompt, missing: b.missing, files: b.files });
          if (r.source === "rule") return setRuleAt(target.at);
          mine = r;
          keep((prev) => ({ before: { ...prev.before, guess: r } }));
        }
        current = 1;
        if (!target.compareBefore?.run) {
          const r = await api.compareStep("run", {
            job: target.job,
            prompt: b.prompt,
            missing: b.missing,
            improved: target.prompt,
            before: mine.output,
            files: target.files,
          });
          if (r.source === "rule") return setRuleAt(target.at);
          keep(() => ({ compareBefore: { run: r } }));
        }
      } catch (err) {
        setFailure({ at: target.at, phase: current, message: err?.message, expired: Boolean(err?.expired) });
      } finally {
        running.current = null;
      }
    },
    [setDiagnosis],
  );

  useEffect(() => {
    if (needsRun && running.current !== diagnosis.at) start(diagnosis);
  }, [needsRun, diagnosis, start]);

  const compared = IDS.filter((id) => before.missing.includes(id));
  const numOf = (id) => compared.indexOf(id) + 1;
  const added = IDS.filter((id) => diagnosis.found.includes(id) && !before.found.includes(id));
  const lit = !rule && run ? focus : null;

  // 키가 없을 때 바뀐 점: 비어 있던 요소가 채워졌는지로만 말한다.
  const ruleDiffs = compared.map((id) => ({
    item: id,
    before: "비어 있어 AI가 마음대로 정함",
    after: diagnosis.found.includes(id) ? "내가 정함" : "아직 비어 있음",
  }));
  const diffs = rule ? ruleDiffs : run?.diffs;

  return (
    <div className={s.wrap}>
      <Link href="/diagnosis/result" className={s.back}>
        <Arrow back />
        진단 결과로
      </Link>

      <div className={s.top}>
        <h1 className={`display ${s.title}`}>같은 일, 두 결과</h1>
        <span className={s.topLinks}>
          <Link href="/?edit=1" className={s.textLink}>
            한 번 더 고쳐 보기
          </Link>
          {diagnosis.missing?.length > 0 && (
            <button type="button" className={s.textLink} onClick={onAiCompare}>
              AI가 다듬은 프롬프트와도 비교해 보기
              <Arrow />
            </button>
          )}
        </span>
      </div>
      {rule && <p className={s.note}>AI 미연결 · 결과물 없이 두 프롬프트에서 채워진 요소만 비교</p>}

      {fail && (
        <FailBar
          failure={fail}
          onRetry={() => setFailure(null)}
          onReupload={(files) => {
            setDiagnosis((prev) => (prev?.at === at ? { ...prev, files, before: { ...prev.before, files } } : prev));
            setFailure(null);
          }}
        />
      )}

      {/* 왼쪽 고치기 전, 오른쪽 내가 고친 프롬프트. 키가 없으면 받은 결과 줄은 없다. */}
      <div className={s.board} data-tour="compare-sides">
        <section className={s.col} aria-labelledby="before-p">
          <div className={s.colHead}>
            <h2 id="before-p">고치기 전 · {dateOf(before.at)} 진단</h2>
            <Bar on={before.found} />
          </div>
          <div className={s.colPrompt}>
            <p className={s.prompt}>
              <PromptText segments={before.segments} prompt={before.prompt} />
            </p>
            <FilesLine files={before.files} />
            {compared.length > 0 && (
              <p className={s.missingLine}>비어 있던 요소 {compared.map((id) => ITEM[id].name).join(", ")}</p>
            )}
          </div>
          {!rule && (
            <div className={s.colResult}>
              <p className={s.resultHead}>
                <b>받은 결과</b>
                <span>점선 = 정보가 없어 AI가 임의로 정한 부분</span>
              </p>
              {mineOut ? (
                <>
                  <MarkedOutput output={mineOut.output} marks={mineOut.guesses} numOf={numOf} focus={lit} />
                  <LengthLine output={mineOut.output} numOf={numOf} focus={lit} />
                </>
              ) : (
                <Making failed={Boolean(fail)} />
              )}
            </div>
          )}
        </section>

        <section className={s.col} aria-labelledby="mine-fixed">
          <div className={s.colHead}>
            <h2 id="mine-fixed">
              내가 고친 프롬프트
              {added.length > 0 && (
                <span className={s.newCount} data-tour="compare-new">
                  {added.length}개 새로 채움
                </span>
              )}
            </h2>
            <Bar on={diagnosis.found} />
          </div>
          <div className={s.colPrompt}>
            <p className={s.prompt}>
              <PromptText segments={diagnosis.segments} prompt={diagnosis.prompt} />
            </p>
            <FilesLine files={diagnosis.files} />
            <ul className={s.filled} aria-label="다섯 요소">
              {IDS.map((id) => (
                <li key={id} className={diagnosis.found.includes(id) ? undefined : s.notFilled}>
                  <Chip id={id} />
                  {added.includes(id) && <span className={s.added}>새로</span>}
                  {!diagnosis.found.includes(id) && <span>아직 비어 있음</span>}
                </li>
              ))}
            </ul>
          </div>
          {!rule && (
            <div className={s.colResult}>
              <p className={s.resultHead}>
                <b>받은 결과</b>
                <span>실선 = 고친 프롬프트로 정해진 부분</span>
              </p>
              {run ? (
                <>
                  <MarkedOutput output={run.output} marks={run.marks} solid numOf={numOf} focus={lit} />
                  <LengthLine output={run.output} solid numOf={numOf} focus={lit} />
                </>
              ) : (
                <Making failed={Boolean(fail)} />
              )}
            </div>
          )}
        </section>
      </div>

      {diffs && (
        <DiffList
          diffs={diffs}
          same={IDS.filter((id) => before.found.includes(id))}
          numOf={numOf}
          focus={lit}
          onFocus={rule ? null : setFocus}
        />
      )}

      {diagnosis.missing?.length > 0 ? (
        <div className={s.forYou}>
          <ForYou tour="compare-foryou" onOpen={(id) => router.push(`/learn?mission=${id}`)} />
        </div>
      ) : (
        <div className={s.allFilled}>
          <p>다섯 요소 모두 채움</p>
          <Link href="/learn" className={s.primary}>
            교육 과정 보기
          </Link>
        </div>
      )}
    </div>
  );
}
