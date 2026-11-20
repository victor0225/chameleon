"use client";

// 처음 열 때 화면 안내(작업 J). 화면에 <Tour id="mission" when={...} />를 두면, 그 화면을 처음 열 때 data/tours.js의 단계를 차례로 짚는다.
// - 화면을 어둡게 덮고 짚을 곳(data-tour)만 밝게 뚫는다. 짚을 곳이 화면에 없는 단계는 건너뛰고, 남은 단계가 없으면 띄우지 않는다.
// - 레벨업 배너(data-tour-wait)나 다른 창(aria-modal)이 떠 있으면 닫힌 뒤에 띄운다.
// - 본 기록: 로그인했으면 /api/tour, 아니면(또는 서버에 표가 없으면) 브라우저(localStorage). 판단은 lib/tour.js.
// - 헤더 "화면 안내" 버튼은 useCurrentTour()로 지금 화면의 안내를 알고 replayTour()로 다시 띄운다.
// - cacheComponents: 띄울지는 effect에서 정하고, 화면이 숨겨지면(Activity) useLayoutEffect cleanup으로 닫는다.
// - 말풍선은 짚는 곳 옆에서 카드를 가리지 않는 빈 곳에 둔다(placeCard). 단계를 넘길 때 움직이는 효과 없이 바로 옮긴다.
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

const PAD = 6; // 짚는 곳 둘레 밝은 여백
const GAP = 12; // 밝은 여백과 말풍선 사이(화살표 자리)
const EDGE = 16; // 화면 가장자리와 말풍선 사이
const NEAR = 48; // 작은 곳을 짚을 때 화살표가 말풍선 모서리에서 떨어지는 거리
const ARROW_MIN = 22; // 화살표 가운데가 말풍선 모서리에 붙지 않게
const SIDES = ["bottom", "top", "right", "left"];
const ALIGNS = ["start", "end", "center"];

const rectOf = (el) => {
  const r = el?.getBoundingClientRect();
  return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
};
const clamp = (v, lo, hi) => Math.min(Math.max(lo, v), Math.max(lo, hi));
const overlap = (a, b) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const headerEl = () => document.querySelector(".topbar");

// 가리면 안 되는 칸: main 안의 카드처럼 보이는 큰 칸(배경색·테두리·그림자). 짚는 곳 안쪽은 뺀다.
function contentBlocks(target) {
  const main = document.querySelector("main");
  if (!main) return [];
  const pageBg = getComputedStyle(document.body).backgroundColor;
  const filled = (c) => c !== pageBg && c !== "transparent" && !/,\s*0\)$/.test(c);
  const out = [];
  for (const el of main.querySelectorAll("*")) {
    if (!(el.offsetWidth >= 120 && el.offsetHeight >= 56)) continue;
    if (target && target.contains(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden") continue;
    if (filled(cs.backgroundColor) || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== "none") out.push(el);
  }
  return out;
}

// 말풍선 자리: 짚는 곳의 위·아래·옆 중 화면 안에 들어가고 카드를 덜 가리는 곳.
// place(단계에 적은 자리)를 먼저, 그다음 아래 → 위 → 오른쪽 → 왼쪽 순서로 본다. 카드를 거의 안 가리는 첫 자리를 쓰고,
// 모두 가리면 가장 덜 가리는 자리. 위아래·옆 어디에도 안 들어가면(짚는 곳이 화면만큼 크면) 화면 아래쪽에 겹쳐 둔다.
// box: 말풍선을 붙일 곳, card: 말풍선 크기, blocks: [{ rect, weight }] → { x, y, side, arrow }
function placeCard(box, card, blocks, place) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const { w, h } = card;
  if (!box) return { x: (vw - w) / 2, y: (vh - h) / 2, side: null, arrow: 0 };
  const r = { left: box.left - PAD, top: box.top - PAD, right: box.right + PAD, bottom: box.bottom + PAD };
  const cx = (r.left + r.right) / 2;
  const cy = (r.top + r.bottom) / 2;
  const along = (align, start, end, center, size, near) =>
    align === "start" ? Math.min(start, center - near) : align === "end" ? Math.max(end - size, center + near - size) : center - size / 2;

  const order = SIDES.flatMap((side) => ALIGNS.map((align) => `${side}-${align}`));
  if (place) order.unshift(place.includes("-") ? place : `${place}-start`);
  const free = w * h * 0.02;
  let best = null;
  for (const name of order) {
    const [side, align] = name.split("-");
    let x;
    let y;
    let fits;
    if (side === "bottom" || side === "top") {
      x = clamp(along(align, r.left, r.right, cx, w, NEAR), EDGE, vw - w - EDGE);
      y = side === "bottom" ? r.bottom + GAP : r.top - GAP - h;
      fits = side === "bottom" ? y + h <= vh - EDGE : y >= EDGE;
    } else {
      y = clamp(along(align, r.top, r.bottom, cy, h, 28), EDGE, vh - h - EDGE);
      x = side === "right" ? r.right + GAP : r.left - GAP - w;
      fits = side === "right" ? x + w <= vw - EDGE : x >= EDGE;
    }
    if (!fits) continue;
    const at = { left: x, top: y, right: x + w, bottom: y + h };
    const score = blocks.reduce((sum, b) => sum + overlap(at, b.rect) * b.weight, 0);
    // 화살표: 말풍선과 짚는 곳이 겹치는 구간의 가운데
    const arrow =
      side === "bottom" || side === "top"
        ? clamp((Math.max(r.left, x) + Math.min(r.right, x + w)) / 2 - x, ARROW_MIN, w - ARROW_MIN)
        : clamp((Math.max(r.top, y) + Math.min(r.bottom, y + h)) / 2 - y, ARROW_MIN, h - ARROW_MIN);
    const cand = { x, y, side, arrow, score };
    if (score <= free) return cand;
    if (!best || score < best.score) best = cand;
  }
  return best ?? { x: clamp(r.left, EDGE, vw - w - EDGE), y: Math.max(EDGE, vh - h - EDGE), side: null, arrow: 0 };
}

function TourStep({ step, index, total, onPrev, onNext, onSkip }) {
  const cardRef = useRef(null);
  const holeRef = useRef(null);
  const dimRef = useRef(null);
  const nextRef = useRef(null);
  const shownIndex = useRef(index);
  const last = index === total - 1;

  // 단계가 바뀌면 그리기 전에 짚을 곳으로 바로 옮긴다(움직이는 효과 없음). 그 뒤로는 자리가 바뀌는지(스크롤, 늦게 그려지는 내용) 매 프레임 본다.
  // 자리는 리렌더 없이 DOM에 바로 쓴다: 다음을 누른 그 프레임에 말풍선과 밝은 칸이 새 자리에 있게.
  useLayoutEffect(() => {
    const header = headerEl();
    const first = findTarget(step.target);
    const r = first?.getBoundingClientRect();
    const safeTop = header && !header.contains(first) ? header.getBoundingClientRect().bottom : 0;
    if (r && (r.top < safeTop || r.bottom > window.innerHeight)) first.scrollIntoView({ block: "center", behavior: "instant" });

    let blocks = null;
    let blocksAt = 0;
    let prev = "";
    let raf;
    const update = () => {
      const card = cardRef.current;
      const target = findTarget(step.target);
      const box = rectOf(target);
      const anchor = (step.near && rectOf(findTarget(step.near))) || box;
      const size = { w: card.offsetWidth, h: card.offsetHeight };
      const key = `${[box, anchor].map((b) => (b ? Object.values(b).map(Math.round).join(",") : "-")).join("|")}|${size.w}x${size.h}|${window.innerWidth}x${window.innerHeight}`;
      if (key === prev) return;
      prev = key;
      const now = performance.now();
      if (!blocks || now - blocksAt > 1000) {
        blocks = contentBlocks(target);
        blocksAt = now;
      }
      const head = headerEl();
      const rects = blocks.map((el) => ({ rect: rectOf(el), weight: 1 }));
      // 상단 바는 카드보다 덜 피한다(어둡게 덮여 있어 가려도 덜 아깝다).
      if (head && !head.contains(target)) rects.push({ rect: rectOf(head), weight: 0.5 });
      const at = placeCard(anchor, size, rects, step.place);

      holeRef.current.style.display = box ? "block" : "none";
      dimRef.current.style.display = box ? "none" : "block";
      if (box) {
        Object.assign(holeRef.current.style, {
          width: `${box.right - box.left + PAD * 2}px`,
          height: `${box.bottom - box.top + PAD * 2}px`,
          transform: `translate(${box.left - PAD}px, ${box.top - PAD}px)`,
        });
      }
      card.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
      card.style.setProperty("--arrow", `${Math.round(at.arrow)}px`);
      card.dataset.side = at.side ?? "";
      card.style.visibility = "visible";
    };
    update();
    const tick = () => {
      update();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  // 열릴 때 초점을 말풍선 자체로 옮기고(초점 테두리 없음), 닫히면 원래 자리로 돌린다.
  // 위의 자리 잡기가 먼저 돌아 말풍선이 보이는 상태여야 초점을 받을 수 있다.
  useLayoutEffect(() => {
    const before = document.activeElement;
    cardRef.current.focus({ preventScroll: true });
    return () => {
      if (before?.isConnected) before.focus?.({ preventScroll: true });
    };
  }, []);
  // 단계를 넘기며 누른 버튼이 사라지면(1단계로 돌아오면 '이전'이 없어짐) '다음'으로 옮긴다.
  // 키보드로 왔으면 '다음'에 초점 테두리가 보이고, 마우스로 눌렀으면 보이지 않는다(:focus-visible).
  useLayoutEffect(() => {
    if (shownIndex.current === index) return;
    shownIndex.current = index;
    if (!cardRef.current.contains(document.activeElement)) nextRef.current?.focus({ preventScroll: true });
  }, [index]);

  // Esc는 건너뛰기, 좌우 화살표는 이전·다음, 말풍선에 초점이 있을 때 Enter는 다음, Tab은 말풍선 안에서만 돈다.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      } else if (e.key === "ArrowRight" || (e.key === "Enter" && document.activeElement === cardRef.current)) {
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

  return (
    <div className={s.layer}>
      <div ref={holeRef} className={s.hole} aria-hidden="true" />
      <div ref={dimRef} className={s.dim} aria-hidden="true" />
      <div
        ref={cardRef}
        className={s.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        data-tour-dialog=""
      >
        <span className={s.arrow} aria-hidden="true" />
        <div className={s.head}>
          <h2 id="tour-title" className={s.title}>
            {step.title}
          </h2>
          <p className={s.count}>
            {index + 1} / {total}
          </p>
        </div>
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
            {last ? "확인" : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}
