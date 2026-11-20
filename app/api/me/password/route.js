// POST /api/me/password { current, next, confirm } → { ok: true }  내 정보에서 비밀번호 바꾸기.
// 바꾸면 이 브라우저의 세션만 남기고 다른 기기의 로그인은 끊는다.
// 실패: 401 로그인 전, 415 JSON이 아님, 400 { error, field } 입력 규칙이나 지금 비밀번호가 틀림(field "current"),
//       429 { error, field: "current" } 비밀번호를 다섯 번 틀려 잠김(로그인과 같은 잠금)
import { cookies } from "next/headers";
import { checkPasswordChange } from "@/lib/credentials";
import { getSessionUser } from "@/lib/server/session";
import { readSession, SESSION_COOKIE } from "@/lib/server/sessionToken";
import { changePassword, LOCK_MINUTES } from "@/lib/server/users";

const bad = (error, field) => Response.json(field ? { error, field } : { error }, { status: 400 });

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인 필요." }, { status: 401 });
  // 다른 사이트의 폼은 JSON으로 보낼 수 없으니 JSON 요청만 받는다(몰래 보내는 요청 막기).
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "요청 형식이 올바르지 않음." }, { status: 415 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return bad("요청 형식이 올바르지 않음.");
  const invalid = checkPasswordChange(body);
  if (invalid) return bad(invalid.message, invalid.field);

  // 남길 세션: 지금 요청의 쿠키에 담긴 세션 id
  const keepSid = (await readSession((await cookies()).get(SESSION_COOKIE)?.value))?.sid ?? null;
  const result = await changePassword(user.id, { current: body.current, next: body.next, keepSid });
  if (result.error === "locked") {
    return Response.json(
      { error: `비밀번호를 여러 번 틀려 ${LOCK_MINUTES}분 동안 막음. 잠시 뒤 다시 시도.`, field: "current" },
      { status: 429 },
    );
  }
  if (result.error) return bad("지금 비밀번호가 맞지 않음", "current");
  return Response.json({ ok: true });
}
