// POST /api/auth/login { loginId, password } → { user }
// 실패: 401 아이디나 비밀번호가 맞지 않음(어느 쪽이 틀렸는지는 알려 주지 않는다), 429 다섯 번 틀려 10분 동안 막힘
import { checkLogin } from "@/lib/credentials";
import { hasDatabase } from "@/lib/server/db";
import { hasSessionSecret, startSession } from "@/lib/server/session";
import { authenticate, LOCK_MINUTES } from "@/lib/server/users";

export async function POST(request) {
  if (!hasDatabase() || !hasSessionSecret()) {
    return Response.json({ error: "아직 로그인 불가. 서버에 DB 설정 필요." }, { status: 503 });
  }
  // 다른 사이트의 폼은 JSON 형식으로 보낼 수 없으니, JSON 요청만 받아 몰래 보내는 가입·로그인을 막는다.
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "요청 형식이 올바르지 않음." }, { status: 415 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않음." }, { status: 400 });
  }
  const invalid = checkLogin(body ?? {});
  if (invalid) return Response.json({ error: invalid.message, field: invalid.field }, { status: 400 });

  const result = await authenticate(body.loginId, body.password);
  if (result.error === "locked") {
    return Response.json(
      { error: `비밀번호를 여러 번 틀려 ${LOCK_MINUTES}분 동안 로그인 막음. 잠시 뒤 다시 시도.` },
      { status: 429 },
    );
  }
  if (result.error) return Response.json({ error: "아이디 또는 비밀번호가 맞지 않음" }, { status: 401 });
  await startSession(result.user.id);
  return Response.json({ user: result.user });
}
