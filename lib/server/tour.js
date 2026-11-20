// 화면 안내를 본 기록(작업 J). 표 tour_views는 팀원이 db/schema.sql에 만든다(추가기능_계획.md 작업 J의 표 모양).
// 표가 아직 없으면 isMissingTable로 알아보고, API가 { off: true }로 답해 화면이 브라우저 기록만 쓰게 한다.
import { query } from "./db.js";

export const isMissingTable = (error) => error?.code === "42P01"; // undefined_table

// → { [tourId]: "done" | "skipped" }
export async function loadTourViews(uid) {
  const { rows } = await query("SELECT tour_id, status FROM tour_views WHERE user_id = $1", [uid]);
  return Object.fromEntries(rows.map((r) => [r.tour_id, r.status]));
}

// 줄이 없으면 넣고, 있으면 status·step·updated_at만 바꾼다(first_at은 처음 본 시각 그대로).
// merge면 이미 있는 줄은 그대로 둔다. value는 lib/tour.js의 cleanTourView를 거친 값이다.
export async function saveTourView(uid, { tourId, status, step, merge }) {
  await query(
    `INSERT INTO tour_views (user_id, tour_id, status, step) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, tour_id) DO ${merge ? "NOTHING" : "UPDATE SET status = EXCLUDED.status, step = EXCLUDED.step, updated_at = now()"}`,
    [uid, tourId, status, step],
  );
}
