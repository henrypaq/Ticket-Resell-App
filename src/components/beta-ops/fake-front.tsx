"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { setFakeFrontAction, type OpsActionState } from "@/domains/beta-ops/actions";
import type { QueuePaddingRow } from "@/domains/beta-ops/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const initial: OpsActionState = {};

export function FakeFrontButton({ rows }: { rows: QueuePaddingRow[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-md text-xs font-medium text-zinc-300 hover:text-zinc-100"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Fake front</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-xl bg-zinc-900 p-5">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-zinc-100">
            Fake Waitlist Front
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Artificial spots ahead of real joiners. Displayed position = real rank + padding.
          </DialogDescription>
        </DialogHeader>
        <ul className="mt-3 flex flex-col gap-2.5">
          {rows.map((row) => (
            <FakeFrontRow key={row.eventSlug} row={row} />
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function FakeFrontRow({ row }: { row: QueuePaddingRow }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(setFakeFrontAction, initial);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-zinc-800/40 p-2.5">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-zinc-200">{row.eventName}</p>
        <p className="text-[11px] text-zinc-400">First real joiner shows as #{row.fakeFront + 1}</p>
      </div>
      <form action={formAction} className="flex shrink-0 items-center gap-1.5">
        <input type="hidden" name="eventSlug" value={row.eventSlug} />
        <Input
          name="fakeFront"
          type="number"
          min={0}
          max={500}
          defaultValue={row.fakeFront}
          className="h-7 w-16 text-center tabular-nums text-xs"
          aria-label={`Fake front for ${row.eventName}`}
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={pending}
          className="h-7 rounded-md px-2.5 text-xs font-medium"
        >
          {pending ? "…" : "Save"}
        </Button>
      </form>
      {state.error && (
        <p role="alert" className="text-[11px] text-amber-400">
          {state.error}
        </p>
      )}
    </li>
  );
}
