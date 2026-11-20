"use client";

// 결과 비교: 내 프롬프트로 받은 결과와, 빠진 요소를 채운 프롬프트로 받은 결과를 한 화면에 나란히 보여 준다(작업 O-1).
// 고쳐서 다시 진단해 diagnosis.before가 있으면 먼저 "내가 고친 프롬프트" 모드(SelfCompare.js)로 연다.
// 위에서 아래로: 왼쪽 "내 프롬프트" 칸과 오른쪽 "다듬은 프롬프트" 칸(칸마다 프롬프트 아래 받은 결과) → 바뀐 점 → 진단 추천.
// 결과는 세 번 나눠 받고(내 결과 → 다듬기 → 다듬은 결과) 자리마다 "만드는 중…"을 보이다가 채운다.
// 받은 결과는 진단 결과(diagnosis.compare)에 붙여 저장해서, 다시 들어와도 AI를 다시 부르지 않는다.
// 추천 미션은 진단만으로 고르니 결과를 기다리지 않고 먼저 보인다. 주 버튼은 추천 1번의 '시작' 하나다.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { useAppState } from "@/components/AppState";
import { ForYou } from "@/app/learn/ForYou";
import { ExampleChip } from "@/components/Common";
import { COMPARE_SAMPLE } from "@/data/compareSample";
import { ITEM } from "@/lib/items";
import s from "./compare.module.css";
import { SelfCompare } from "./SelfCompare";
import { Tour } from "@/components/Tour";
import {
  Arrow,
  Bar,
  Chip,
  DiffList,
  FailBar,
  FilesLine,
  IDS,
  joinSentences,
  LengthLine,
  Making,
  MarkedOutput,
  PromptText,
  vars,
  WithBlanks,
} from "./parts";

export default function ComparePage() {
  const { ready, diagnosis } = useAppState();
  // "AI가 다듬은 프롬프트와도 비교해 보기"를 눌렀는지. 숨겨질 때 처음 모드로 돌린다.
  const [aiCompare, setAiCompare] = useState(false);
  useLayoutEffect(() => () => setAiCompare(false), []);

  return (
    <>
      <Tour id="compare" when={ready} />
      {ready && diagnosis?.before && !aiCompare ? (
        <SelfCompare onAiCompare={() => setAiCompare(true)} />
      ) : (
        <RefineCompare onSelfCompare={diagnosis?.before ? () => setAiCompare(false) : null} />
      )}
    </>
  );
}

function RefineCompare({ onSelfCompare }) {
  const { ready, diagnosis, setDiagnosis } = useAppState();
  const router = useRouter();
  const [focus, setFocus] = useState(null);
  // 실패와 예시 모드는 어느 진단에서 생겼는지(at)와 함께 둔다.
  const [failure, setFailure] = useState(null);
  const [sampleAt, setSampleAt] = useState(null);
  const [copied, setCopied] = useState(false);
  const running = useRef(null);

  // cacheComponents에서는 다른 화면으로 가도 이 화면을 숨겨 두고 상태를 그대로 둔다.
  // 숨겨질 때 강조를 풀고, 실패와 예시 모드를 풀어 다시 들어오면 새로 받아 오게 한다.
  useLayoutEffect(
    () => () => {
      setFocus(null);
      setFailure(null);
      setSampleAt(null);
      setCopied(false);
    },
    [],
  );

  const at = diagnosis?.at;
  const saved = diagnosis?.compare;
  const savedMine = saved?.mine ?? (diagnosis?.guess?.output ? diagnosis.guess : null);
  const phase = !savedMine ? 0 : !saved?.refined ? 1 : !saved?.run ? 2 : 3;
  const sample = Boolean(at && sampleAt === at);
  const fail = failure?.at === at ? failure : null;
  const needsRun = Boolean(ready && diagnosis && diagnosis.missing?.length && phase < 3 && !fail && !sample);

  const start = useCallback(
    async (target) => {
      running.current = target.at;
      const base = { job: target.job, prompt: target.prompt, missing: target.missing, files: target.files };
      const keep = (patch) =>
        setDiagnosis((prev) => (prev?.at === target.at ? { ...prev, ...patch(prev) } : prev));
      let mine = target.compare?.mine ?? (target.guess?.output ? target.guess : null);
      let refined = target.compare?.refined ?? null;
      let current = 0;
      try {
        if (!mine) {
          const r = await api.compareStep("mine", base);
          if (r.source === "rule") return setSampleAt(target.at);
          mine = r;
          // 진단 결과 화면의 "AI는 이렇게 추측했어요"도 같은 결과를 쓰게 한다.
          keep((prev) => ({ guess: prev.guess?.output ? prev.guess : r, compare: { ...prev.compare, mine: r } }));
        }
        current = 1;
        if (!refined) {
          const r = await api.compareStep("refine", base);
          if (r.source === "rule") return setSampleAt(target.at);
          refined = r;
          keep((prev) => ({ compare: { ...prev.compare, mine, refined: r } }));
        }
        current = 2;
        if (!target.compare?.run) {
          const r = await api.compareStep("run", {
            ...base,
            improved: joinSentences(refined.sentences),
            before: mine.output,
          });
          if (r.source === "rule") return setSampleAt(target.at);
          keep((prev) => ({ compare: { ...prev.compare, mine, refined, run: r } }));
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

  if (!ready) return <div className={s.wrap} />;

  if (!diagnosis) {
    return (
      <div className={s.wrap}>
        <div className={s.empty}>
          <h1 className="display">아직 진단 결과 없음</h1>
          <p className={s.sub}>프롬프트를 한 번 진단받으면 다듬은 프롬프트와 결과 비교 가능</p>
          <Link href="/" className={s.primary}>
            진단하러 가기
          </Link>
        </div>
      </div>
    );
  }

  if (!diagnosis.missing?.length) {
    return (
      <div className={s.wrap}>
        <div className={s.empty}>
          <h1 className="display">다섯 요소 모두 포함</h1>
          <p className={s.sub}>채울 요소가 없어 비교할 것 없음. 더 어려운 업무로 연습하기.</p>
          {onSelfCompare ? (
            <button type="button" className={s.primary} onClick={onSelfCompare}>
              내가 고친 프롬프트와 비교하기
            </button>
          ) : (
            <Link href="/diagnosis/result" className={s.primary}>
              진단 결과로
            </Link>
          )}
        </div>
      </div>
    );
  }

  const data = sample
    ? COMPARE_SAMPLE
    : {
        job: diagnosis.job,
        prompt: diagnosis.prompt,
        segments: diagnosis.segments,
        found: diagnosis.found,
        missing: diagnosis.missing,
        files: diagnosis.files,
        mine: savedMine,
        refined: saved?.refined,
        run: saved?.run,
      };
  const compared = IDS.filter((id) => data.missing.includes(id));
  const numOf = (id) => compared.indexOf(id) + 1;
  const lit = data.run ? focus : null;
  const addedCount = data.refined?.sentences.filter((x) => x.added).length ?? 0;

  async function copyImproved() {
    try {
      await navigator.clipboard.writeText(joinSentences(data.refined.sentences));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={s.wrap}>
      <Link href="/diagnosis/result" className={s.back}>
        <Arrow back />
        진단 결과로
      </Link>

      <div className={s.top}>
        <h1 className={`display ${s.title}`}>두 프롬프트 결과 비교</h1>
        {sample && <ExampleChip />}
        {onSelfCompare && (
          <button type="button" className={s.textLink} onClick={onSelfCompare}>
            내가 고친 프롬프트와 비교하기
            <Arrow />
          </button>
        )}
      </div>

      {fail && (
        <FailBar
          failure={fail}
          onRetry={() => setFailure(null)}
          onReupload={(files) => {
            // 다시 올린 파일로 바꿔 저장하면, 실패를 풀었을 때 그 파일로 이어서 받는다.
            setDiagnosis((prev) => (prev?.at === at ? { ...prev, files } : prev));
            setFailure(null);
          }}
        />
      )}

      {/* 왼쪽·오른쪽 칸. 칸마다 프롬프트 아래 받은 결과이고, 두 결과는 같은 높이에서 시작한다(subgrid). */}
      <div className={s.board} data-tour="compare-sides">
        <section className={s.col} aria-labelledby="mine-p">
          <div className={s.colHead}>
            <h2 id="mine-p">{sample ? "예시 프롬프트" : "내 프롬프트"}</h2>
            <Bar on={data.found} />
          </div>
          <div className={s.colPrompt}>
            <p className={s.prompt}>
              <PromptText segments={data.segments} prompt={data.prompt} />
            </p>
            <FilesLine files={data.files} />
            <p className={s.missingLine}>빠진 요소 {compared.map((id) => ITEM[id].name).join(", ")}</p>
          </div>
          <div className={s.colResult}>
            <p className={s.resultHead}>
              <b>받은 결과</b>
              <span>점선 = 정보가 없어 AI가 임의로 정한 부분</span>
            </p>
            {data.mine ? (
              <>
                <MarkedOutput output={data.mine.output} marks={data.mine.guesses} numOf={numOf} focus={lit} />
                <LengthLine output={data.mine.output} numOf={numOf} focus={lit} />
              </>
            ) : (
              <Making failed={Boolean(fail)} />
            )}
          </div>
        </section>

        <section className={s.col} aria-labelledby="fixed-p">
          <div className={s.colHead}>
            <h2 id="fixed-p">
              다듬은 프롬프트
              {addedCount > 0 && <span className={s.newCount}>{addedCount}개 채움</span>}
            </h2>
            {data.refined && <Bar on={data.refined.sentences.map((x) => x.item)} />}
          </div>
          <div className={s.colPrompt}>
            {data.refined ? (
              <>
                <ol className={s.sentences}>
                  {data.refined.sentences.map((x) => (
                    <li key={x.item}>
                      <Chip id={x.item} />
                      <span className={s.sentence}>
                        <WithBlanks text={x.text} />
                      </span>
                    </li>
                  ))}
                </ol>
                <button type="button" className={s.copyBtn} onClick={copyImproved} aria-live="polite">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
                    <rect x="5" y="5" width="8.5" height="8.5" rx="2" />
                    <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
                  </svg>
                  {copied ? "복사함" : "다듬은 프롬프트 복사"}
                </button>
              </>
            ) : (
              <Making failed={Boolean(fail)} />
            )}
          </div>
          <div className={s.colResult}>
            <p className={s.resultHead}>
              <b>받은 결과</b>
              <span>실선 = 다듬은 프롬프트로 정해진 부분</span>
            </p>
            {data.run ? (
              <>
                <MarkedOutput output={data.run.output} marks={data.run.marks} solid numOf={numOf} focus={lit} />
                <LengthLine output={data.run.output} solid numOf={numOf} focus={lit} />
              </>
            ) : (
              <Making failed={Boolean(fail)} />
            )}
          </div>
        </section>
      </div>

      {data.run && (
        <DiffList
          diffs={data.run.diffs}
          same={IDS.filter((id) => data.found.includes(id))}
          numOf={numOf}
          focus={lit}
          onFocus={setFocus}
        />
      )}

      <div className={s.forYou}>
        <ForYou tour="compare-foryou" onOpen={(id) => router.push(`/learn?mission=${id}`)} />
      </div>
    </div>
  );
}
