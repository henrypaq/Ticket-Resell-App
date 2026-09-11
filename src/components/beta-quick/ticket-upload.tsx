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

function TicketFileIcon({ kind }: { kind: "pdf" | "image" }) {
  return (
    <span
      aria-hidden
      className="relative flex h-11 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-gradient-to-b from-[#2a2a2e] to-[#1a1a1d] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
    >
      <span className="absolute inset-x-0 top-0 h-2 bg-[#ffe500]/90" />
      <span className="mt-1 font-bold tracking-tight text-[10px] text-[#ffe500]">
        {kind === "pdf" ? "PDF" : "IMG"}
      </span>
    </span>
  );
}

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
  const [dragging, setDragging] = useState(false);
  const needed = Math.max(1, quantity);
  const remaining = Math.max(0, needed - files.length);
  const complete = files.length >= needed;

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list).filter((f) => {
      if (ACCEPT_SET.has(f.type)) return true;
      const lower = f.name.toLowerCase();
      return lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".pdf");
    });
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

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  const title =
    needed === 1
      ? "Upload ticket screenshot / PDF"
      : `Upload all ${needed} tickets (${files.length}/${needed})`;

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragging(false);
        }}
        onDrop={onDrop}
        className={`flex min-h-[160px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed px-5 py-8 text-center transition-colors ${
          dragging
            ? "border-[#ffe500] bg-[#ffe500]/10"
            : complete
              ? "border-white/20 bg-white/[0.04]"
              : "border-white/25 bg-white/[0.05] hover:border-[#ffe500]/40 hover:bg-white/[0.08]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple={needed > 1}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <span className="text-[15px] font-semibold text-ink">
          {complete ? (needed === 1 ? "Replace file" : "Add or replace") : title}
        </span>
        <span className="max-w-[18rem] text-[13px] leading-relaxed text-muted">
          {dragging
            ? "Drop to upload"
            : needed > 1 && remaining > 0
              ? `${remaining} more needed · JPEG, PNG, or PDF · drag & drop or browse`
              : "JPEG, PNG, or PDF · up to 8MB each · drag & drop or browse"}
        </span>
      </div>

      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((item, index) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-[14px] border border-white/10 bg-[#17171a] px-3 py-2.5"
            >
              <TicketFileIcon kind={fileKind(item.file)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-ink">
                  {needed > 1 ? `Ticket ${index + 1}` : "Ticket file"}
                  <span className="font-normal text-muted"> · {item.file.name}</span>
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted">{formatBytes(item.file.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(item.id);
                }}
                className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold text-muted hover:bg-white/10 hover:text-ink"
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
