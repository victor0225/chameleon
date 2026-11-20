"use client";

// 처음 열 때 화면 안내(작업 J). 화면에 <Tour id="mission" when={...} />를 두면, 그 화면을 처음 열 때 data/tours.js의 단계를 차례로 짚는다.
// - 화면을 어둡게 덮고 짚을 곳(data-tour)만 밝게 뚫는다. 짚을 곳이 화면에 없는 단계는 건너뛰고, 남은 단계가 없으면 띄우지 않는다.
// - 레벨업 배너(data-tour-wait)나 다른 창(aria-modal)이 떠 있으면 닫힌 뒤에 띄운다.
// - 본 기록: 로그인했으면 /api/tour, 아니면(또는 서버에 표가 없으면) 브라우저(localStorage). 판단은 lib/tour.js.
// - 헤더 "화면 안내" 버튼은 useCurrentTour()로 지금 화면의 안내를 알고 replayTour()로 다시 띄운다.
// - cacheComponents: 띄울지는 effect에서 정하고, 화면이 숨겨지면(Activity) useLayoutEffect cleanup으로 닫는다.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { TOURS } from "@/data/tours";
import { cleanSeen, mergeSeen, shouldShow, TOUR_STORAGE, toUpload, visibleSteps } from "@/lib/tour";
import { useAppState } from "./AppState";
import s from "./tour.module.css";

// ---------- 본 기록 ----------
function readLocal() {
  try {
    return cleanSeen(JSON.parse(localStorage.getItem(TOUR_STORAGE) ?? "{}"));
  } catch {
    return {}; // 못 읽으면 안 본 것으로 보고 안내를 띄운다.
  }
}

function writeLocal(tourId, status) {
  try {
    localStorage.setItem(TOUR_STORAGE, JSON.stringify({ ...readLocal(), [tourId]: status }));
  } catch {
    // 저장소를 못 쓰면 이번 방문 동안만 기억한다(cache).
  }
}

const post = (body) =>
  fetch("/api/tour", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) =>
    r.ok ? r.json() : Promise.reject(new Error("FAILED")),
  );

// 화면마다 다시 묻지 않게 한 번 읽은 기록을 둔다. key는 로그인한 사용자 id, 손님이면 "guest".
// server: 서버에 남기는지(로그인했고 tour_views 표가 있음)
let cache = { key: null, seen: null, server: false, promise: null };

function loadSeen(user) {
  const key = user?.id ?? "guest";
  if (cache.key === key && cache.promise) return cache.promise;
  const entry = { key, seen: null, server: false, promise: null };
  cache = entry;
  entry.promise = (async () => {
    const local = readLocal();
    entry.seen = local;
    if (!user) return local;
    try {
      const r = await fetch("/api/tour", { cache: "no-store" });
      const data = r.ok ? await r.json() : null;
      if (!data || data.off) return local;
      const server = cleanSeen(data.seen);
      // 로그인 전에 이 브라우저에서 본 안내를 계정으로 한 번 올린다. 이미 서버에 있는 줄은 그대로 둔다.
      await Promise.all(toUpload(local, server).map(([tourId, status]) => post({ tourId, status, step: 0, merge: true })));
      entry.server = true;
      entry.seen = mergeSeen(local, server);
    } catch {
      // 서버를 못 읽으면 브라우저 기록으로 판단한다.
    }
    return entry.seen;
  })();
  return entry.promise;
}

function markSeen(tourId, status, step) {
  const entry = cache;
  entry.seen = { ...(entry.seen ?? {}), [tourId]: status };
  entry.promise = Promise.resolve(entry.seen);
  if (!entry.server) return writeLocal(tourId, status);
  post({ tourId, status, step })
    .then((d) => d?.off && writeLocal(tourId, status))
    .catch(() => writeLocal(tourId, status));
}

// ---------- 지금 화면의 안내(헤더 "화면 안내" 버튼) ----------
const active = [];
const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = () => listeners.forEach((fn) => fn());
const currentId = () => active.at(-1)?.id ?? null;

export const useCurrentTour = () => useSyncExternalStore(subscribe, currentId, () => null);
export const replayTour = () => active.at(-1)?.replay();

// ---------- 화면 읽기 ----------
const shown = (el) => el.getClientRects().length > 0;
const presentTargets = () => [...document.querySelectorAll("[data-tour]")].filter(shown).map((el) => el.dataset.tour);
const findTarget = (name) => [...document.querySelectorAll(`[data-tour="${name}"]`)].find(shown) ?? null;
const blocked = () => Boolean(document.querySelector('[data-tour-wait], [aria-modal="true"]:not([data-tour-dialog])'));
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const SETTLE_MS = 300; // 화면이 그려질 틈
const RETRY_MS = 400;
const RETRIES = 6; // 짚을 곳이 늦게 그려질 때(커리큘럼을 불러오는 중 등) 더 기다리는 횟수

export function Tour({ id, when = true }) {
  const { authChecked, user } = useAppState();
  const [run, setRun] = useState(null); // { steps, index }

  const open = useCallback(() => {
    const steps = visibleSteps(TOURS[id]?.steps, presentTargets());
    if (steps.length) setRun({ steps, index: 0 });
    return steps.length > 0;
  }, [id]);

  // 헤더에 이 화면의 안내를 알린다. 숨겨지거나 when이 꺼지면 뺀다.
  useEffect(() => {
    if (!when) return;
    const entry = { id, replay: open };
    active.push(entry);
    emit();
    return () => {
      active.splice(active.indexOf(entry), 1);
      emit();
    };
  }, [id, when, open]);

  // 처음 연 화면이면 띄운다. 로그인한 사람은 서버 기록을 받은 뒤에만 정한다(이미 본 사람에게 깜빡 뜨지 않게).
  useEffect(() => {
    if (!when || !authChecked) return;
    let stop = false;
    let timer;
    let tries = 0;
    loadSeen(user).then((seen) => {
      if (stop || !shouldShow(id, seen)) return;
      const attempt = () => {
        if (stop) return;
        if (blocked()) timer = setTimeout(attempt, RETRY_MS);
        else if (!open() && ++tries < RETRIES) timer = setTimeout(attempt, RETRY_MS);
      };
      timer = setTimeout(attempt, SETTLE_MS);
    });
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id, when, authChecked, user, open]);

  // 화면을 떠나 숨겨지거나 when이 꺼지면 닫는다. 끝까지 안 봤으니 기록하지 않고, 다시 오면 또 띄운다.
  useLayoutEffect(() => {
    if (!when) return;
    return () => setRun(null);
  }, [when]);

  if (!run) return null;
  const step = run.steps[run.index];
  const last = run.index === run.steps.length - 1;
  const close = (status) => {
    markSeen(id, status, status === "done" ? run.steps.length - 1 : run.index);
    setRun(null);
  };
  return createPortal(
    <TourStep
      step={step}
      index={run.index}
      total={run.steps.length}
      onPrev={() => setRun((r) => ({ ...r, index: Math.max(0, r.index - 1) }))}
      onNext={() => (last ? close("done") : setRun((r) => ({ ...r, index: r.index + 1 })))}
      onSkip={() => close("skipped")}
    />,
    document.body,
  );
}

const PAD = 8; // 짚는 곳 둘레 여백
const GAP = 12; // 짚는 곳과 말풍선 사이
const EDGE = 16; // 화면 가장자리와 말풍선 사이
const CARD_W = 320;

// 말풍선 자리: 아래 → 위 → 오른쪽 → 왼쪽 순서로 들어가는 곳. 짚는 곳이 화면보다 크면 화면 아래쪽에 둔다.
function cardPosition(box, cardH) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x) => Math.min(Math.max(EDGE, x), vw - CARD_W - EDGE);
  const clampY = (y) => Math.min(Math.max(EDGE, y), vh - cardH - EDGE);
  if (!box) return { x: (vw - CARD_W) / 2, y: (vh - cardH) / 2 };
  const below = box.top + box.height + PAD + GAP;
  if (below + cardH <= vh - EDGE) return { x: clampX(box.left), y: below };
  const above = box.top - PAD - GAP - cardH;
  if (above >= EDGE) return { x: clampX(box.left), y: above };
  const right = box.left + box.width + PAD + GAP;
  if (right + CARD_W <= vw - EDGE) return { x: right, y: clampY(box.top) };
  const left = box.left - PAD - GAP - CARD_W;
  if (left >= EDGE) return { x: left, y: clampY(box.top) };
  return { x: clampX(box.left), y: vh - cardH - EDGE };
}

function TourStep({ step, index, total, onPrev, onNext, onSkip }) {
  const cardRef = useRef(null);
  const nextRef = useRef(null);
  const [view, setView] = useState({ box: null, cardH: 0 });
  const measured = view.cardH > 0; // 말풍선 높이를 잰 뒤에 보이고, 그때 초점을 옮길 수 있다
  const last = index === total - 1;

  // 짚을 곳을 화면 가운데로 옮기고, 그 뒤로는 자리가 바뀌는지(스크롤, 늦게 그려지는 내용) 매 프레임 본다.
  useEffect(() => {
    const el = findTarget(step.target);
    const r = el?.getBoundingClientRect();
    if (r && (r.top < 72 || r.bottom > window.innerHeight)) {
      el.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    }
    let raf;
    let prev = "";
    const tick = () => {
      const rect = findTarget(step.target)?.getBoundingClientRect();
      const cardH = cardRef.current?.offsetHeight ?? 0;
      const box = rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null;
      const key = `${box ? Object.values(box).map(Math.round).join(",") : "none"}|${cardH}|${window.innerWidth}x${window.innerHeight}`;
      if (key !== prev) {
        prev = key;
        setView({ box, cardH });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step.target]);

  // 열릴 때 말풍선으로 초점을 옮기고, 닫히면 원래 자리로 돌린다.
  useEffect(() => {
    const before = document.activeElement;
    return () => {
      if (before?.isConnected) before.focus?.({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (measured) nextRef.current?.focus({ preventScroll: true });
  }, [index, measured]);

  // Esc는 건너뛰기, 좌우 화살표는 이전·다음, Tab은 말풍선 안에서만 돈다.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "Tab") {
        const items = [...(cardRef.current?.querySelectorAll("button") ?? [])];
        if (!items.length) return;
        const at = items.indexOf(document.activeElement);
        const to = e.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : at === items.length - 1 ? 0 : at + 1;
        e.preventDefault();
        items[to].focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [index, onNext, onPrev, onSkip]);

  const { box, cardH } = view;
  const at = cardPosition(box, cardH);
  return (
    <div className={s.layer}>
      {box ? (
        <div
          className={s.hole}
          aria-hidden="true"
          style={{
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
            transform: `translate(${box.left - PAD}px, ${box.top - PAD}px)`,
          }}
        />
      ) : (
        <div className={s.dim} aria-hidden="true" />
      )}
      <div
        ref={cardRef}
        className={s.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        data-tour-dialog=""
        style={{ transform: `translate(${at.x}px, ${at.y}px)`, visibility: measured ? "visible" : "hidden" }}
      >
        <p className={s.count}>
          {index + 1} / {total}
        </p>
        <h2 id="tour-title" className={s.title}>
          {step.title}
        </h2>
        <p id="tour-body" className={s.body}>
          {step.body}
        </p>
        <div className={s.actions}>
          <button type="button" className={s.skip} onClick={onSkip}>
            건너뛰기
          </button>
          {index > 0 && (
            <button type="button" className="btn ghost small" onClick={onPrev}>
              이전
            </button>
          )}
          <button ref={nextRef} type="button" className="btn small" onClick={onNext}>
            {last ? "시작하기" : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}
