// PATCH /api/me/account { name } → { user: { id, loginId, name } }  내 정보에서 이름 바꾸기. 아이디는 바꿀 수 없다.
// 실패: 401 로그인 전, 415 JSON이 아님, 400 { error, field: "name" } 이름 규칙
import { checkName } from "@/lib/credentials";
import { getSessionUser } from "@/lib/server/session";
import { updateName } from "@/lib/server/users";

const bad = (error, field) => Response.json(field ? { error, field } : { error }, { status: 400 });

export async function PATCH(request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인 필요." }, { status: 401 });
  // 다른 사이트의 폼은 JSON으로 보낼 수 없으니 JSON 요청만 받는다(몰래 보내는 요청 막기).
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "요청 형식이 올바르지 않음." }, { status: 415 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return bad("요청 형식이 올바르지 않음.");
  const invalid = checkName(body.name);
  if (invalid) return bad(invalid.message, invalid.field);
  const updated = await updateName(user.id, body.name);
  if (!updated) return Response.json({ error: "로그인 필요." }, { status: 401 });
  return Response.json({ user: updated });
}
