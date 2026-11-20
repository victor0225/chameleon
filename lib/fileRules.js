// 첨부 파일 규칙. 화면(고르자마자 안내)과 서버(최종 검사)가 같은 규칙을 쓴다.
// 3개까지, 하나에 4MB. Vercel 함수가 받는 요청이 4.5MB까지라서 이렇게 정했다.
export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

// Gemini가 바로 읽는 형식. 브라우저가 MIME을 비워 주는 파일(.md 등)은 확장자로 정한다.
const BY_EXT = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  md: "text/markdown",
};
export const MIME_TYPES = [...new Set(Object.values(BY_EXT))];
export const ACCEPT = Object.keys(BY_EXT)
  .map((ext) => `.${ext}`)
  .join(",");
// 오피스 문서는 Gemini가 바로 못 읽는다. PDF로 저장해 달라고 안내한다.
const OFFICE = new Set(["hwp", "hwpx", "doc", "docx", "xls", "xlsx", "ppt", "pptx"]);

export const FILE_ERROR = {
  big: "4MB 넘어서 올리지 못함. 필요한 쪽만 PDF로 저장해서 올리기.",
  office: "HWP·DOCX는 AI가 바로 못 읽음. PDF로 저장해서 올리기.",
  type: "PDF, 그림(PNG·JPG·WEBP), 텍스트(TXT·CSV·MD) 파일만 올리기 가능.",
  empty: "빈 파일. 내용 있는 파일 올리기.",
};

const extOf = (name) => (String(name).match(/\.([A-Za-z0-9]+)$/)?.[1] ?? "").toLowerCase();

// { name, type, size } → { mimeType } | { error: "big" | "office" | "type" | "empty" }
export function checkFile({ name, type, size }) {
  const ext = extOf(name);
  if (OFFICE.has(ext)) return { error: "office" };
  const mimeType = MIME_TYPES.includes(type) ? type : BY_EXT[ext];
  if (!mimeType) return { error: "type" };
  if (!(size > 0)) return { error: "empty" };
  if (size > MAX_FILE_BYTES) return { error: "big" };
  return { mimeType };
}

// 1.2MB, 320KB처럼 짧게
export function formatSize(bytes) {
  if (!(bytes >= 0)) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

const COUNT = ["", "한", "두", "세", "네", "다섯"];
export const countWord = (n) => (COUNT[n] ? `${COUNT[n]} 개` : `${n}개`);

// "회의록_1118.pdf 외 1개"
export function filesLine(files) {
  if (!files?.length) return "";
  return files.length === 1 ? files[0].name : `${files[0].name} 외 ${files.length - 1}개`;
}
