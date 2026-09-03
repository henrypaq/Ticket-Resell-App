import { NoteIcon } from "./icons";

/** Tag pills with a "+N" overflow chip rather than wrapping every tag (STYLE.md). */
export function TagPills({ tags, max = 2 }: { tags: string[]; max?: number }) {
  if (!tags?.length) return null;
  const shown = tags.slice(0, max);
  const overflow = tags.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {shown.map((tag) => (
        <span
          key={tag}
          className="pill-quiet inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] text-ink/90"
        >
          <NoteIcon className="h-3 w-3 text-muted" />
          {tag}
        </span>
      ))}
      {overflow > 0 && (
        <span className="pill-quiet px-2.5 py-1 text-[12px] text-ink/90">+{overflow}</span>
      )}
    </div>
  );
}
