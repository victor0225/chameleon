// 화면 안내(작업 J)를 띄울지 정하는 순수 함수. 화면은 components/Tour.js, 기록 API는 app/api/tour/route.js.
import { TOURS } from "../data/tours.js";

export const TOUR_STORAGE = "chameleon.tourSeen"; // 손님(로그인 전)의 본 기록. { [tourId]: "done" | "skipped" }
export const TOUR_STATUS = ["done", "skipped"];
const MAX_STEP = 20;

// 저장소나 서버에서 읽은 값에서 아는 안내 id와 상태만 남긴다.
export function cleanSeen(value) {
  const out = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [id, status] of Object.entries(value)) if (Object.hasOwn(TOURS, id) && TOUR_STATUS.includes(status)) out[id] = status;
  return out;
}

// 아직 본 적 없는 안내만 띄운다(건너뛴 것도 본 것으로 친다).
export const shouldShow = (tourId, seen) => Object.hasOwn(TOURS, tourId) && !seen?.[tourId];

// present: 지금 화면에 있는 data-tour 값들 → 짚을 곳이 있는 단계만
export function visibleSteps(steps, present) {
  const here = new Set(present);
  return (steps ?? []).filter((step) => here.has(step.target));
}

// 브라우저 기록과 서버 기록을 합친다. 같은 안내면 서버 것을 쓴다.
export const mergeSeen = (local, server) => ({ ...cleanSeen(local), ...cleanSeen(server) });

// 로그인했을 때 서버로 올릴 브라우저 기록: 서버에 없는 것만 → [[tourId, status]]
export const toUpload = (local, server) => Object.entries(cleanSeen(local)).filter(([id]) => !Object.hasOwn(cleanSeen(server), id));

// POST /api/tour 본문 { tourId, status, step, merge? } → { value } | { error }
//   merge: true면 이미 있는 줄은 그대로 둔다(로그인할 때 브라우저 기록을 합칠 때).
export function cleanTourView(body) {
  if (!body || typeof body !== "object") return { error: "요청 형식이 올바르지 않음." };
  if (!Object.hasOwn(TOURS, body.tourId)) return { error: "모르는 화면 안내." };
  if (!TOUR_STATUS.includes(body.status)) return { error: "요청 형식이 올바르지 않음." };
  const step = Number.isInteger(body.step) && body.step >= 0 && body.step <= MAX_STEP ? body.step : 0;
  return { value: { tourId: body.tourId, status: body.status, step, merge: body.merge === true } };
}
