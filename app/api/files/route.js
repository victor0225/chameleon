// POST /api/files : 첨부 파일 하나(FormData의 file)를 받아 Gemini Files API에 올린다.
// 응답 { name, mimeType, size, uri, source: "ai" }. 키가 없으면 올리지 않고 { name, mimeType, size, source: "rule" }.
// 받는 형식과 크기 규칙은 lib/fileRules.js. 판단 로직은 lib/server/files.js.
import { GoogleGenAI } from "@google/genai";
import { checkFile, MAX_FILE_BYTES } from "@/lib/fileRules";
import { checkUpload, uploadToGemini } from "@/lib/server/files";
import { hasGeminiKey } from "@/lib/server/gemini";

export async function POST(request) {
  // FormData 머리글까지 조금 여유를 둔다. 실제 크기는 파일을 꺼내 다시 본다.
  if (Number(request.headers.get("content-length")) > MAX_FILE_BYTES + 64 * 1024) {
    return Response.json({ error: "4MB가 넘어서 올리지 못했어요. 필요한 쪽만 PDF로 저장해서 올려 주세요." }, { status: 413 });
  }
  let file;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }
  const error = checkUpload(file);
  if (error) return Response.json({ error }, { status: 400 });

  if (!hasGeminiKey()) {
    const { mimeType } = checkFile({ name: file.name, type: file.type, size: file.size });
    return Response.json({ name: file.name, mimeType, size: file.size, source: "rule" });
  }
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    return Response.json(await uploadToGemini(file, { ai }));
  } catch (err) {
    console.warn("[/api/files] 올리기 실패:", err?.message || "unknown");
    return Response.json({ error: "파일을 올리지 못했어요. 다시 올려 주세요." }, { status: 502 });
  }
}
