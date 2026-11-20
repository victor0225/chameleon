// 진단 기록 읽기(작업 I-3). 진단 변화는 lib/diagnosisTrend.js(팀 규칙)가 계산한다.
import { query } from "./db.js";

// 최근 limit개와 첫 진단. 첫 진단이 최근 limit개 안에 있으면 한 번만 넣는다. → [{ at, found, missing }] 새것부터
export async function recentDiagnoses(uid, limit = 5) {
  const { rows } = await query(
    `(SELECT id, at, found, missing FROM diagnoses WHERE user_id = $1 ORDER BY at DESC LIMIT $2)
     UNION
     (SELECT id, at, found, missing FROM diagnoses WHERE user_id = $1 ORDER BY at ASC LIMIT 1)
     ORDER BY at DESC`,
    [uid, limit],
  );
  return rows.map((r) => ({ at: r.at.toISOString(), found: r.found, missing: r.missing }));
}
