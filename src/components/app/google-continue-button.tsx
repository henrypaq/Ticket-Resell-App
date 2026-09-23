"use client";

import { useState, useTransition } from "react";
import { startGoogleSignIn } from "@/app/login/actions";

/**
 * Continues account setup / creation via Google OAuth. Lands back on `nextPath`
 * (typically `/setup?...`) where the server links the session to a beta profile.
 */
export function GoogleContinueButton({
  nextPath,
  label = "Continue with Google",
}: {
  /** Same-origin path to resume after OAuth (must start with `/`). */
  nextPath: string;
  label?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="w-full">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await startGoogleSignIn(window.location.origin, nextPath);
            if (result.url) {
              window.location.href = result.url;
            } else {
              setError(result.error ?? "Google sign-in is unavailable.");
            }
          });
        }}
        className="flex w-full items-center justify-center gap-3 rounded-[14px] border border-white/20 bg-white/[0.06] px-5 py-3.5 text-[15px] font-semibold text-ink transition-colors hover:bg-white/[0.1] disabled:opacity-60"
      >
        <GoogleMark className="h-[18px] w-[18px]" />
        {pending ? "Opening Google…" : label}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-[13px] leading-relaxed text-urgency">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}
