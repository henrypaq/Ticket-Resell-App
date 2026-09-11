"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

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
    <button
      type="button"
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
      className={
        className ||
        "rounded-full border border-urgency/40 px-2.5 py-1 text-[11px] font-semibold text-urgency hover:bg-urgency/10 disabled:opacity-50"
      }
    >
      {pending ? "…" : label}
    </button>
  );
}
