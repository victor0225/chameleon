// PostgreSQL 연결. DATABASE_URL이 없으면 로그인과 저장 기능을 끄고, 화면은 브라우저 저장소만 쓴다.
// 개발 서버는 파일을 고칠 때마다 모듈을 다시 읽으니, 연결 풀은 globalThis에 하나만 둔다.
import pg from "pg";

export const hasDatabase = () => Boolean(process.env.DATABASE_URL);

export function getPool() {
  if (!globalThis.__chameleonPool) {
    globalThis.__chameleonPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }
  return globalThis.__chameleonPool;
}

export const query = (text, params) => getPool().query(text, params);

// 여러 쿼리를 한 트랜잭션으로 묶는다. fn이 던지면 되돌린다.
export async function transaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
