// 첨부 파일 (POST /api/files)과, 진단·추측·비교가 받은 files를 Gemini contents에 붙이는 일.
// 파일은 Gemini Files API에 올리고 uri만 주고받는다. Gemini 쪽 파일은 48시간 뒤 지워진다.
// node --test로 바로 불러올 수 있게 상대 경로와 확장자를 쓴다.
import crypto from "node:crypto";
import { createPartFromUri } from "@google/genai";
import { checkFile, FILE_ERROR, MAX_FILES, MIME_TYPES } from "../fileRules.js";

export const GEMINI_FILE_PREFIX = "https://generativelanguage.googleapis.com/";
export const FILE_EXPIRED = "첨부 파일이 만료됐어요. 다시 올려 주세요.";
const MAX_NAME = 200;
const WAIT_MS = 10000;

// 이 서버가 올린 파일인지 확인하는 서명. 같은 Gemini 키를 모두가 쓰므로, 요청에 아무 파일 주소나 넣어
// 남이 올린 파일을 끌어 쓰지 못하게 업로드할 때 준 서명이 맞는 주소만 받는다.
const signKey = () =>
  crypto.createHash("sha256").update(`chameleon-file-sig:${process.env.FILE_SIGNING_SECRET || process.env.GEMINI_API_KEY || ""}`).digest();

export function signUri(uri) {
  return crypto.createHmac("sha256", signKey()).update(uri).digest("base64url");
}

function validSig(uri, sig) {
  if (typeof sig !== "string" || sig.length > 100) return false;
  const expected = Buffer.from(signUri(uri));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// FormData에서 꺼낸 file 하나를 검사한다. 틀리면 화면에 보여 줄 문장.
export function checkUpload(file) {
  if (!file || typeof file !== "object" || typeof file.arrayBuffer !== "function") return "올릴 파일이 없어요.";
  const result = checkFile({ name: file.name, type: file.type, size: file.size });
  return result.error ? FILE_ERROR[result.error] : null;
}

// Gemini Files API에 올린다. 처리 중(PROCESSING)이면 ACTIVE가 될 때까지 짧게 기다린다.
export async function uploadToGemini(file, { ai, wait = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const { mimeType } = checkFile({ name: file.name, type: file.type, size: file.size });
  let uploaded = await ai.files.upload({ file, config: { mimeType, displayName: file.name } });
  for (let waited = 0; uploaded?.state === "PROCESSING" && waited < WAIT_MS; waited += 1000) {
    await wait(1000);
    uploaded = await ai.files.get({ name: uploaded.name });
  }
  if (uploaded?.state === "FAILED" || !uploaded?.uri?.startsWith(GEMINI_FILE_PREFIX)) throw new Error("UPLOAD_FAILED");
  if (uploaded.state === "PROCESSING") throw new Error("UPLOAD_TIMEOUT");
  return { name: file.name, mimeType, size: file.size, uri: uploaded.uri, sig: signUri(uploaded.uri), source: "ai" };
}

// 요청의 files를 검사한다. 키가 없을 때는 uri 없이 이름만 온다. uri에는 업로드 때 준 sig가 맞아야 한다.
// → { value: [{ name, mimeType, uri? }] } | { error }
export function cleanFiles(files) {
  if (files === undefined || files === null) return { value: [] };
  if (!Array.isArray(files) || files.length > MAX_FILES) return { error: `파일은 ${MAX_FILES}개까지 붙일 수 있어요.` };
  const value = [];
  for (const f of files) {
    if (!f || typeof f !== "object") return { error: "첨부 파일 정보가 올바르지 않아요." };
    if (typeof f.name !== "string" || !f.name.trim() || f.name.length > MAX_NAME) return { error: "첨부 파일 이름이 올바르지 않아요." };
    if (!MIME_TYPES.includes(f.mimeType)) return { error: "첨부 파일 형식이 올바르지 않아요." };
    if (f.uri !== undefined && f.uri !== null) {
      if (typeof f.uri !== "string" || f.uri.length > 500 || !f.uri.startsWith(GEMINI_FILE_PREFIX) || !validSig(f.uri, f.sig))
        return { error: "첨부 파일 주소가 올바르지 않아요. 파일을 다시 올려 주세요." };
      value.push({ name: f.name.trim(), mimeType: f.mimeType, uri: f.uri });
    } else {
      value.push({ name: f.name.trim(), mimeType: f.mimeType });
    }
  }
  return { value };
}

// 프롬프트 글에 첨부 파일 이름 줄을 붙인다. 모델이 어떤 파일이 붙었는지 알게.
export function filesNote(files) {
  if (!files?.length) return "";
  return `첨부 파일: ${files.map((f) => f.name).join(", ")}\n`;
}

// Gemini contents: 글만 있으면 문자열 그대로, uri가 있는 파일이 있으면 [파일들, 글] 순서의 parts 배열.
export function withFiles(text, files) {
  const parts = (files ?? []).filter((f) => f.uri).map((f) => createPartFromUri(f.uri, f.mimeType));
  return parts.length ? [...parts, { text }] : text;
}

// 파일이 만료(48시간)됐거나 지워져 Gemini가 못 찾을 때의 오류인지.
export function isFileGone(error) {
  const status = Number(error?.status || error?.code);
  const message = String(error?.message ?? "");
  return (status === 403 || status === 404 || status === 400) && /file/i.test(message) && /not exist|not found|permission|expired/i.test(message);
}

export class FileExpiredError extends Error {
  constructor() {
    super(FILE_EXPIRED);
    this.name = "FileExpiredError";
  }
}
