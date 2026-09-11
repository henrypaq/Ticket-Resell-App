"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setFakeFrontAction, type OpsActionState } from "@/domains/beta-ops/actions";
import type { QueuePaddingRow } from "@/domains/beta-ops/shared";
import { BUTTON_CLASS_COMPACT, FIELD_CLASS } from "@/components/beta-waitlist/field-styles";

const initial: OpsActionState = {};

export function FakeFrontControls({ rows }: { rows: QueuePaddingRow[] }) {
  return (
    <section className="rounded-[18px] border border-hairline bg-white/[0.04] p-4">
      <h2 className="text-[15px] font-semibold text-ink">Fake waitlist front</h2>
      <p className="mt-1 text-[13px] text-muted">
        Artificial spots ahead of real joiners. Displayed position = real rank + padding.
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((row) => (
          <FakeFrontRow key={row.eventSlug} row={row} />
        ))}
      </ul>
    </section>
  );
}

function FakeFrontRow({ row }: { row: QueuePaddingRow }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(setFakeFrontAction, initial);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <li className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium text-ink">{row.eventName}</p>
        <p className="text-[12px] text-muted">First real joiner shows as #{row.fakeFront + 1}</p>
      </div>
      <form action={formAction} className="flex shrink-0 items-center gap-2">
        <input type="hidden" name="eventSlug" value={row.eventSlug} />
        <input
          name="fakeFront"
          type="number"
          min={0}
          max={500}
          defaultValue={row.fakeFront}
          className={`${FIELD_CLASS} w-20 !py-2 text-center tabular-nums`}
          aria-label={`Fake front for ${row.eventName}`}
        />
        <button type="submit" disabled={pending} className={BUTTON_CLASS_COMPACT}>
          {pending ? "…" : "Save"}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="text-[12px] text-urgency sm:basis-full">
          {state.error}
        </p>
      )}
    </li>
  );
}
