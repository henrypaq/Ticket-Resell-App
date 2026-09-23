"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { resolveEventRequestAction } from "@/domains/beta-ops/actions";
import type { OpsEventRequest } from "@/domains/beta-ops/event-requests";
import { Button } from "@/components/ui/button";

export function EventRequestsBoard({ requests }: { requests: OpsEventRequest[] }) {
  const open = requests.filter((r) => !r.resolvedAt);
  const done = requests.filter((r) => r.resolvedAt);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Open · {open.length}
        </h2>
        {open.length === 0 ? (
          <p className="rounded-lg bg-zinc-900/60 px-3.5 py-4 text-sm text-zinc-500">
            No open event requests.
          </p>
        ) : (
          <ul className="space-y-2">
            {open.map((r) => (
              <RequestRow key={r.id} request={r} />
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Resolved · {done.length}
          </h2>
          <ul className="space-y-2">
            {done.slice(0, 20).map((r) => (
              <RequestRow key={r.id} request={r} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RequestRow({ request }: { request: OpsEventRequest }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isNew = !request.seenAt && !request.resolvedAt;

  return (
    <li
      className={`rounded-lg px-3.5 py-3 ${
        request.resolvedAt
          ? "bg-zinc-900/40 opacity-70"
          : isNew
            ? "bg-zinc-950/80 ring-1 ring-amber-400/30"
            : "bg-zinc-950/70"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-zinc-100">
            {isNew && (
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />
            )}
            {request.name}
          </p>
          {request.details && (
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">{request.details}</p>
          )}
          <p className="mt-1.5 text-[10px] text-zinc-500">
            {formatWhen(request.createdAt)}
            {request.memberName || request.memberEmail
              ? ` · ${[request.memberName, request.memberEmail].filter(Boolean).join(" · ")}`
              : " · anonymous"}
            {request.resolvedAt ? ` · resolved ${formatWhen(request.resolvedAt)}` : ""}
          </p>
        </div>
        {!request.resolvedAt && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            className="h-8 shrink-0 text-[11px]"
            onClick={() => {
              start(async () => {
                const result = await resolveEventRequestAction(request.id);
                if (result.error) window.alert(result.error);
                router.refresh();
              });
            }}
          >
            {pending ? "…" : "Mark resolved"}
          </Button>
        )}
      </div>
    </li>
  );
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
