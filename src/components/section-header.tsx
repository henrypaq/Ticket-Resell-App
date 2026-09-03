import Link from "next/link";
import { ChevronRight } from "./icons";

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex items-end justify-between gap-4 px-4">
      <div className="min-w-0">
        <h2 className="section-header">{title}</h2>
        {subtitle && <p className="mt-1 text-[14px] text-muted">{subtitle}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="pill-quiet inline-flex shrink-0 items-center gap-1 px-3.5 py-2 text-[13px] font-semibold"
        >
          {action.label}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
