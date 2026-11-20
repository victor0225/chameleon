import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFile, filesLine, formatSize, MAX_FILE_BYTES } from "../lib/fileRules.js";
import { fileCoaching, mentionsFile } from "../lib/fileSignals.js";
import { checkUpload, cleanFiles, FileExpiredError, isFileGone, signUri, uploadToGemini, withFiles } from "../lib/server/files.js";
import { runCompare } from "../lib/server/compare.js";
import { runDiagnosis, validateDiagnosis } from "../lib/server/diagnosis.js";
import { runGuess } from "../lib/server/guess.js";
import { analyze } from "../lib/anatomy.js";

process.env.GEMINI_API_KEY = "test-key";
const URI = "https://generativelanguage.googleapis.com/v1beta/files/abc123";
const PDF = { name: "회의록_1118.pdf", mimeType: "application/pdf", uri: URI, sig: signUri(URI) };

test("받는 파일: PDF·그림·텍스트만, 4MB까지. MIME이 비면 확장자로, 오피스 문서는 따로 안내", () => {
  assert.deepEqual(checkFile({ name: "a.pdf", type: "application/pdf", size: 10 }), { mimeType: "application/pdf" });
  assert.deepEqual(checkFile({ name: "메모.md", type: "", size: 10 }), { mimeType: "text/markdown" });
  assert.deepEqual(checkFile({ name: "사진.JPG", type: "", size: 10 }), { mimeType: "image/jpeg" });
  assert.deepEqual(checkFile({ name: "견적서.hwp", type: "application/x-hwp", size: 10 }), { error: "office" });
  assert.deepEqual(checkFile({ name: "표.xlsx", type: "", size: 10 }), { error: "office" });
  assert.deepEqual(checkFile({ name: "a.zip", type: "application/zip", size: 10 }), { error: "type" });
  assert.deepEqual(checkFile({ name: "큰.pdf", type: "application/pdf", size: MAX_FILE_BYTES + 1 }), { error: "big" });
  assert.deepEqual(checkFile({ name: "빈.txt", type: "text/plain", size: 0 }), { error: "empty" });
  assert.equal(formatSize(1.2 * 1024 * 1024), "1.2MB");
  assert.equal(formatSize(300 * 1024), "300KB");
  assert.equal(filesLine([{ name: "a.pdf" }, { name: "b.csv" }]), "a.pdf 외 1개");
  assert.equal(checkUpload(null), "올릴 파일이 없어요.");
  assert.match(checkUpload(new File(["x"], "견적서.docx")), /PDF로 저장/);
  assert.equal(checkUpload(new File(["x"], "a.txt", { type: "text/plain" })), null);
});

test("요청의 files: 3개까지, 이 서버가 서명한 Gemini 파일 주소만 받고, 키가 없을 때는 이름만 와도 된다", () => {
  assert.deepEqual(cleanFiles(undefined), { value: [] });
  assert.deepEqual(cleanFiles([PDF]).value, [{ name: PDF.name, mimeType: PDF.mimeType, uri: URI }]);
  // 남이 올린 파일 주소를 서명 없이, 또는 다른 주소의 서명으로 넣으면 받지 않는다.
  const other = "https://generativelanguage.googleapis.com/v1beta/files/someoneelse";
  assert.match(cleanFiles([{ ...PDF, uri: other }]).error, /주소/);
  assert.match(cleanFiles([{ ...PDF, sig: undefined }]).error, /주소/);
  assert.match(cleanFiles([{ ...PDF, sig: "x".repeat(43) }]).error, /주소/);
  assert.deepEqual(cleanFiles([{ name: "a.pdf", mimeType: "application/pdf" }]).value, [{ name: "a.pdf", mimeType: "application/pdf" }]);
  assert.match(cleanFiles([PDF, PDF, PDF, PDF]).error, /3개까지/);
  assert.match(cleanFiles([{ ...PDF, uri: "https://evil.example/files/a" }]).error, /주소/);
  assert.match(cleanFiles([{ ...PDF, uri: "file:///etc/passwd" }]).error, /주소/);
  assert.match(cleanFiles([{ ...PDF, mimeType: "application/zip" }]).error, /형식/);
  assert.match(cleanFiles("a.pdf").error, /3개까지/);
  assert.match(validateDiagnosis({ job: "office", experience: "none", prompt: "써 줘", files: [{ ...PDF, uri: "http://x" }] }), /주소/);
  assert.equal(validateDiagnosis({ job: "office", experience: "none", prompt: "써 줘", files: [PDF] }), null);
});

test("contents: uri가 있는 파일만 parts로 붙이고, 없으면 글 그대로", () => {
  assert.equal(withFiles("글", []), "글");
  assert.equal(withFiles("글", [{ name: "a.pdf", mimeType: "application/pdf" }]), "글");
  assert.deepEqual(withFiles("글", [PDF]), [{ fileData: { fileUri: URI, mimeType: "application/pdf" } }, { text: "글" }]);
});

test("업로드: 처리 중이면 ACTIVE가 될 때까지 기다리고, 실패하면 던진다", async () => {
  const file = new File(["%PDF"], "보고서.pdf", { type: "application/pdf" });
  let gets = 0;
  const ai = {
    files: {
      upload: async ({ config }) => ({ name: "files/x", state: "PROCESSING", uri: URI, mimeType: config.mimeType }),
      get: async () => (++gets < 2 ? { name: "files/x", state: "PROCESSING", uri: URI } : { name: "files/x", state: "ACTIVE", uri: URI }),
    },
  };
  const r = await uploadToGemini(file, { ai, wait: async () => {} });
  assert.deepEqual(r, { name: "보고서.pdf", mimeType: "application/pdf", size: 4, uri: URI, sig: signUri(URI), source: "ai" });
  assert.equal(gets, 2);
  const bad = { files: { upload: async () => ({ state: "FAILED", uri: URI }) } };
  await assert.rejects(uploadToGemini(file, { ai: bad }));
  const wrongHost = { files: { upload: async () => ({ state: "ACTIVE", uri: "https://evil.example/f" }) } };
  await assert.rejects(uploadToGemini(file, { ai: wrongHost }));
});

test("진단·추측·비교: 파일을 contents에 붙이고 이름을 알려 주며, 만료 오류는 따로 던진다", async () => {
  const body = { job: "office", experience: "none", prompt: "첨부한 회의록으로 보고서 써 줘", files: [PDF] };
  let sent;
  await runDiagnosis(body, { ask: async (req) => ((sent = req), { sentences: [{ index: 0, items: ["goal"] }] }) });
  assert.ok(Array.isArray(sent.contents));
  assert.deepEqual(sent.contents[0], { fileData: { fileUri: URI, mimeType: "application/pdf" } });
  assert.match(sent.contents[1].text, /첨부 파일: 회의록_1118\.pdf/);
  assert.match(sent.system, /파일을 붙였다고 요소가 채워진 것은 아니다/);

  await runGuess(body, { ask: async (req) => ((sent = req), { output: "보고서", guesses: [] }) });
  assert.match(sent.system, /첨부 파일에 있는 정보를 쓴 것은 마음대로 정한 것이 아니다/);
  assert.equal(sent.contents.length, 2);

  for (const step of ["mine", "refine", "run"]) {
    await runCompare({ ...body, step, improved: "다듬은 프롬프트", before: "처음 결과" }, { ask: async (req) => ((sent = req), { output: "x" }) }).catch(() => {});
    assert.ok(Array.isArray(sent.contents), step);
  }

  const gone = Object.assign(new Error("You do not have permission to access the File abc123 or it may not exist."), { status: 403 });
  assert.equal(isFileGone(gone), true);
  assert.equal(isFileGone(Object.assign(new Error("quota"), { status: 429 })), false);
  const fail = async () => {
    throw gone;
  };
  await assert.rejects(runDiagnosis(body, { ask: fail }), FileExpiredError);
  await assert.rejects(runGuess(body, { ask: fail }), FileExpiredError);
  await assert.rejects(runCompare({ ...body, step: "mine" }, { ask: fail }), FileExpiredError);
});

test("파일을 가리키는 말: 붙였는데 안 가리키면 질문, 안 붙였는데 가리키면 알려 준다", () => {
  for (const p of ["첨부한 회의록으로 정리해 줘", "이 파일을 요약해 줘", "보고서를 읽고 핵심만", "붙인 자료를 바탕으로 써 줘", "이 PDF에서 숫자만"]) {
    assert.equal(mentionsFile(p), true, p);
  }
  for (const p of ["이번 주 업무 보고 정리해 줘", "회의 내용을 요약해 줘", "파일럿 프로그램 소개 글 써 줘"]) {
    assert.equal(mentionsFile(p), false, p);
  }
  assert.equal(fileCoaching({ prompt: "보고 정리해 줘", files: [] }), null);
  assert.equal(fileCoaching({ prompt: "첨부한 회의록으로 정리해 줘", files: [PDF] }), null);
  const unused = fileCoaching({ prompt: "보고 정리해 줘", files: [PDF, PDF] });
  assert.equal(unused.kind, "unused");
  assert.equal(unused.question, "붙인 파일은 무엇이고, AI가 그걸로 무엇을 해야 하나요?");
  assert.match(unused.detail, /파일 두 개를 붙였지만/);
  assert.equal(fileCoaching({ prompt: "첨부한 파일 요약해 줘", files: [] }).kind, "missing");
  assert.ok(analyze("첨부한 회의록으로 정리해 줘").found.includes("context"));
});
