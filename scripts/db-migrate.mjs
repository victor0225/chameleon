// db/schema.sql을 DATABASE_URL의 DB에 실행한다. 사용: npm run db:migrate
import fs from "node:fs";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL이 없어요. .env.local에 넣거나 환경 변수로 주세요.");
  process.exit(1);
}
const sql = fs.readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(sql);
  const { rows } = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  );
  console.log(`표 준비 완료: ${rows.map((r) => r.table_name).join(", ")}`);
} finally {
  await client.end();
}
