"use client";

import { useRef, useState, type DragEvent } from "react";

const ACCEPT = "image/jpeg,image/png,application/pdf";
const ACCEPT_SET = new Set(["image/jpeg", "image/png", "application/pdf", "image/jpg"]);

export type TicketFile = {
  id: string;
  file: File;
};

function fileKind(file: File): "pdf" | "image" {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  return "image";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedFile(file: File): boolean {
  if (ACCEPT_SET.has(file.type)) return true;
  const lower = file.name.toLowerCase();
  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".pdf")
  );
}

/** Compact file-type mark — red accent so it reads as proof evidence, not brand chrome. */
function TicketFileIcon({ kind }: { kind: "pdf" | "image" }) {
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#ff4d4d]/15 text-[10px] font-bold tracking-wide text-[#ff4d4d]"
    >
      {kind === "pdf" ? "PDF" : "IMG"}
    </span>
  );
}

/**
 * One dropzone that scales with quantity: selling 3 tickets means 3 files
 * (or one share link covering all — handled outside this component).
 */
export function TicketUploadZone({
  quantity,
  files,
  onChange,
}: {
  quantity: number;
  files: TicketFile[];
  onChange: (files: TicketFile[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const needed = Math.max(1, quantity);
  const remaining = Math.max(0, needed - files.length);
  const complete = files.length >= needed;

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list).filter(isAcceptedFile);
    if (!incoming.length) return;
    const next = [...files];
    for (const file of incoming) {
      if (next.length >= needed) break;
      next.push({ id: crypto.randomUUID(), file });
    }
    onChange(next.slice(0, needed));
  }

  function removeAt(id: string) {
    onChange(files.filter((f) => f.id !== id));
  }

  function resetDrag() {
    dragDepth.current = 0;
    setDragging(false);
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (![...e.dataTransfer.types].includes("Files")) return;
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (![...e.dataTransfer.types].includes("Files")) return;
    e.dataTransfer.dropEffect = "copy";
    if (!dragging) setDragging(true);
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    resetDrag();
    const list = e.dataTransfer.files;
    if (list?.length) addFiles(list);
  }

  const primaryLabel = dragging
    ? "Drop to upload"
    : complete
      ? needed === 1
        ? "Replace file"
        : "Add or replace"
      : needed === 1
        ? "Upload screenshot or PDF"
        : `Upload ${needed} ticket files`;

  const secondaryLabel = dragging
    ? needed > 1
      ? `Up to ${remaining || needed} file${remaining === 1 ? "" : "s"}`
      : "Release to add"
    : needed > 1 && remaining > 0
      ? `${files.length}/${needed} · ${remaining} more · JPEG, PNG, PDF`
      : "JPEG, PNG, or PDF · up to 8MB";

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-[16px] border px-5 py-7 text-center transition-colors ${
          dragging
            ? "border-brand/50 bg-brand/[0.06]"
            : complete
              ? "border-white/10 bg-transparent"
              : "border-dashed border-white/20 bg-transparent hover:border-white/35"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple={needed > 1}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <span className="pointer-events-none text-[14px] font-semibold text-ink">{primaryLabel}</span>
        <span className="pointer-events-none text-[12.5px] text-muted">{secondaryLabel}</span>
      </button>

      {files.length > 0 && (
        <ul className="divide-y divide-white/8 overflow-hidden rounded-[16px] border border-white/10">
          {files.map((item, index) => (
            <li key={item.id} className="flex items-center gap-3 px-3.5 py-3">
              <TicketFileIcon kind={fileKind(item.file)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] text-ink">
                  {needed > 1 ? (
                    <span className="font-medium">Ticket {index + 1}</span>
                  ) : (
                    <span className="font-medium">Ticket file</span>
                  )}
                  <span className="text-muted"> · {item.file.name}</span>
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted">{formatBytes(item.file.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(item.id);
                }}
                className="shrink-0 text-[12.5px] font-medium text-muted transition-colors hover:text-ink"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
