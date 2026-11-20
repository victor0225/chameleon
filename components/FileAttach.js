"use client";

// 입력 칸 아래 파일 첨부: [파일 첨부] 버튼, 안내, 첨부한 파일 칩. 고르자마자 /api/files로 올린다.
// 진단 프롬프트 쓰기와 파일 활용 실습이 같이 쓴다. 상태(entries)는 부모가 useState로 들고 setEntries를 넘긴다.
//
// entry: { id, name, size, mimeType?, uri?, sig?, status, progress, file? }  file은 다시 올리기에 쓰는 원본(화면에서만)
//   status: uploading 올리는 중 | done 다 올림 | nokey AI 연결 안 됨(이름만) | failed 올리지 못함
//           big 4MB보다 큼 | office HWP·DOCX 같은 문서 | type 못 읽는 형식 | empty 빈 파일
import { useId, useRef, useState } from "react";
import * as api from "@/lib/api";
import { ACCEPT, checkFile, FILE_ERROR, formatSize, MAX_FILES } from "@/lib/fileRules";
import { ExampleChip } from "./Common";
import s from "./fileAttach.module.css";

// AI가 연결되지 않아 파일 내용을 읽지 않을 때: 입력 칸 안 문장 대신 파일 칩 옆에 '예시 결과'와 같은 칩 하나(캔버스 A3)
const NOKEY_CHIP = "AI 미연결 · 파일 이름만 기록";

// 진단·실습에 넘길 파일. 다 올렸거나(uri) 키가 없어 이름만 받은 것만 보낸다.
export const attachedFiles = (entries) =>
  entries
    .filter((e) => e.status === "done" || e.status === "nokey")
    .map(({ name, mimeType, size, uri, sig }) => (uri ? { name, mimeType, size, uri, sig } : { name, mimeType, size }));

export const isUploading = (entries) => entries.some((e) => e.status === "uploading");

// 저장해 둔 진단의 files로 칩을 다시 채운다(?edit=1).
export const entriesFrom = (files) =>
  (files ?? []).map((f, i) => ({ ...f, id: `saved-${i}-${f.name}`, status: f.uri ? "done" : "nokey", progress: 1 }));

let seq = 0;

// bare: 테두리 없는 모양(첫 화면 입력 카드 안). footer({ open, full, disabled })를 주면 아래 도구 줄 대신 그것을 그린다
// (첫 화면은 '파일·그림 첨부' 버튼을 진단하기 왼쪽에 둔다, 보드 K2).
export function FileAttach({ entries, setEntries, disabled = false, bare = false, footer, children }) {
  const inputId = useId();
  const input = useRef(null);
  const full = entries.length >= MAX_FILES;

  const patch = (id, change) => setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...change } : e)));

  function upload(id, file) {
    patch(id, { status: "uploading", progress: 0 });
    api
      .uploadFile(file, (progress) => patch(id, { progress }))
      .then((r) => patch(id, { status: r.uri ? "done" : "nokey", mimeType: r.mimeType, uri: r.uri, sig: r.sig, progress: 1 }))
      .catch((err) => patch(id, { status: "failed", message: err?.message }));
  }

  function pick(e) {
    const chosen = [...(e.target.files ?? [])].slice(0, Math.max(0, MAX_FILES - entries.length));
    e.target.value = "";
    const added = chosen.map((file) => {
      const id = `f${++seq}`;
      const check = checkFile({ name: file.name, type: file.type, size: file.size });
      const status = check.error ?? "uploading";
      return { id, name: file.name, size: file.size, mimeType: check.mimeType, status, progress: 0, file };
    });
    setEntries((list) => [...list, ...added]);
    for (const entry of added) if (entry.status === "uploading") upload(entry.id, entry.file);
  }

  const remove = (id) => setEntries((list) => list.filter((e) => e.id !== id));

  const hiddenInput = (
    <input
      ref={input}
      id={inputId}
      type="file"
      accept={ACCEPT}
      multiple
      className={s.input}
      onChange={pick}
      disabled={disabled || full}
      tabIndex={-1}
      aria-hidden="true"
    />
  );
  // footer가 그리는 버튼에도 넘기려고 ref 대신 id로 찾는다(그리는 중에 ref를 넘기지 않게).
  const open = () => document.getElementById(inputId)?.click();

  return (
    <div className={`${bare ? s.bare : s.frame} ${disabled ? s.frameDisabled : ""}`}>
      {children}
      {entries.length > 0 && (
        <ul className={s.chips} aria-label="첨부한 파일">
          {entries.map((e) => (
            <Chip key={e.id} entry={e} onRemove={() => remove(e.id)} onRetry={() => upload(e.id, e.file)} disabled={disabled} />
          ))}
          {entries.some((e) => e.status === "nokey") && (
            <li className={s.item}>
              <ExampleChip>{NOKEY_CHIP}</ExampleChip>
            </li>
          )}
        </ul>
      )}
      {hiddenInput}
      {footer ? (
        footer({ open, full, disabled })
      ) : (
        <div className={s.tools}>
          <button type="button" className={s.attach} onClick={open} disabled={disabled || full} data-tour="file-attach">
            <ClipIcon />
            파일 첨부
          </button>
          <span className={s.hint}>
            {full ? `파일은 ${MAX_FILES}개까지. 하나 지우면 더 붙이기 가능` : `PDF · 그림 · 텍스트 파일 · 하나에 4MB`}
          </span>
          <span className={`${s.count} ${full ? s.countFull : ""}`} aria-label={`파일 ${entries.length}개 붙임, ${MAX_FILES}개까지`}>
            파일 {entries.length}/{MAX_FILES}
          </span>
        </div>
      )}
    </div>
  );
}

function Chip({ entry: e, onRemove, onRetry, disabled }) {
  const error = FILE_ERROR[e.status];
  // 진단하는 중에는 첨부를 잠근다(빼기 버튼도).
  const removeButton = (
    <button type="button" className={s.remove} onClick={onRemove} disabled={disabled} aria-label={`${e.name} 빼기`}>
      <CloseIcon />
    </button>
  );

  if (e.status === "uploading") {
    return (
      <li className={s.item}>
        <span className={`${s.chip} ${s.uploading}`}>
          <span className={s.row}>
            <FileIcon />
            <span className={s.name}>{e.name}</span>
            <span className={s.state}>올리는 중</span>
          </span>
          <span className={s.bar} aria-hidden="true">
            <span style={{ transform: `scaleX(${Math.max(0.05, e.progress ?? 0)})` }} />
          </span>
        </span>
      </li>
    );
  }
  if (e.status === "failed") {
    return (
      <li className={s.item}>
        <span className={s.inline}>
          <span className={`${s.chip} ${s.bad}`}>
            <span className={s.name}>{e.name}</span>
            <span className={s.badText}>올리지 못함</span>
            {removeButton}
          </span>
          {e.file && (
            <button type="button" className="btn ghost small" onClick={onRetry}>
              다시 올리기
            </button>
          )}
        </span>
      </li>
    );
  }
  if (e.status === "nokey") {
    return (
      <li className={s.item}>
        <span className={`${s.chip} ${s.nokey}`}>
          <FileIcon />
          <span className={s.name}>{e.name}</span>
          {removeButton}
        </span>
      </li>
    );
  }
  if (error) {
    return (
      <li className={s.item}>
        <span className={`${s.chip} ${s.bad}`}>
          <AlertIcon />
          <span className={s.name}>{e.name}</span>
          {e.status === "big" && <span className={`${s.size} ${s.badText}`}>{formatSize(e.size)}</span>}
          {removeButton}
        </span>
        <p className={s.error} role="alert">
          {error}
        </p>
      </li>
    );
  }
  return (
    <li className={s.item}>
      <span className={s.chip}>
        <FileIcon />
        <span className={s.name}>{e.name}</span>
        {e.size > 0 && <span className={s.size}>{formatSize(e.size)}</span>}
        {removeButton}
      </span>
    </li>
  );
}

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

export function FileIcon() {
  return (
    <svg width="16" height="16" strokeWidth="2" {...svg}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export function ClipIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} strokeWidth="2" {...svg}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" strokeWidth="2" {...svg}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" strokeWidth="2.4" {...svg}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// 결과·비교 화면: 첨부 파일이 만료(48시간)됐을 때. 파일을 다시 골라 올리면 onDone(새 files)을 부른다.
export function ExpiredNotice({ onDone, then = "다시 올리면 이어서 비교 가능." }) {
  const input = useRef(null);
  const [state, setState] = useState({ busy: false, error: "" });

  async function pick(e) {
    const chosen = [...(e.target.files ?? [])].slice(0, MAX_FILES);
    e.target.value = "";
    if (!chosen.length) return;
    const bad = chosen.map((f) => checkFile({ name: f.name, type: f.type, size: f.size })).find((c) => c.error);
    if (bad) return setState({ busy: false, error: FILE_ERROR[bad.error] });
    setState({ busy: true, error: "" });
    try {
      const uploaded = await Promise.all(chosen.map((f) => api.uploadFile(f)));
      onDone(uploaded.map(({ name, mimeType, size, uri, sig }) => (uri ? { name, mimeType, size, uri, sig } : { name, mimeType, size })));
      setState({ busy: false, error: "" });
    } catch (err) {
      setState({ busy: false, error: err?.message || "파일을 올리지 못함. 다시 올리기." });
    }
  }

  return (
    <div className={s.expired} role="status">
      <svg width="20" height="20" strokeWidth="2" {...svg}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <div className={s.expiredText}>
        <p>첨부 파일 만료. 파일은 올린 뒤 48시간 동안만 사용 가능. {then}</p>
        {state.error && (
          <p className={s.error} role="alert">
            {state.error}
          </p>
        )}
      </div>
      <input ref={input} type="file" accept={ACCEPT} multiple className={s.input} onChange={pick} tabIndex={-1} aria-hidden="true" />
      <button type="button" className="btn small" onClick={() => input.current?.click()} disabled={state.busy}>
        {state.busy ? "올리는 중…" : "다시 올리기"}
      </button>
    </div>
  );
}

// 결과·비교·리포트 화면의 "첨부한 파일" 줄
export function AttachedLine({ files, label = "첨부한 파일" }) {
  if (!files?.length) return null;
  return (
    <div className={s.attached}>
      <span>{label}</span>
      <ul aria-label={label}>
        {files.map((f, i) => (
          <li key={i}>{f.name}</li>
        ))}
      </ul>
    </div>
  );
}
