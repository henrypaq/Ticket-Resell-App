"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OpsDeleteButton({
  label = "Delete",
  confirmMessage,
  onConfirm,
  className = "",
}: {
  label?: string;
  confirmMessage: string;
  onConfirm: () => Promise<{ ok?: true; error?: string }>;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(confirmMessage)) return;
        start(async () => {
          const result = await onConfirm();
          if (result.error) {
            window.alert(result.error);
            return;
          }
          router.refresh();
        });
      }}
      className={cn(
        "h-7 rounded-md px-2 text-xs text-zinc-500 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-40",
        className,
      )}
    >
      {pending ? "…" : label}
    </Button>
  );
}
