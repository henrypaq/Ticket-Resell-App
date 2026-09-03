"use client";

import { useActionState, useState, useTransition } from "react";
import {
  demoSignIn,
  requestCode,
  startGoogleSignIn,
  verifyCode,
  type AuthState,
} from "./actions";

const initial: AuthState = {};

export function LoginForm({
  demoEnabled,
  initialError,
  nextPath,
}: {
  demoEnabled: boolean;
  initialError?: string;
  /** Where to land after signing in — set when a signed-out visitor arrived via a shared link. */
  nextPath?: string;
}) {
  const [requestState, requestAction, requesting] = useActionState(requestCode, initial);
  const [verifyState, verifyAction, verifying] = useActionState(verifyCode, initial);
  const [providerError, setProviderError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();

  const sent = requestState.sent;
  const email = requestState.email ?? "";
  const error = verifyState.error ?? requestState.error ?? providerError;

  function onGoogle() {
    setProviderError(null);
    startTransition(async () => {
      const result = await startGoogleSignIn(window.location.origin, nextPath);
      if (result.url) {
        window.location.href = result.url;
      } else {
        setProviderError(result.error ?? "Google sign-in is unavailable.");
      }
    });
  }

  function onDemo() {
    setProviderError(null);
    startTransition(async () => {
      const result = await demoSignIn(nextPath);
      if (result?.error) setProviderError(result.error);
    });
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onGoogle}
        disabled={pending}
        className="flex w-full items-center justify-center gap-3 rounded-full border border-hairline px-5 py-3.5 text-[15px] font-semibold text-ink transition-colors hover:bg-white/5 disabled:opacity-60"
      >
        <GoogleMark className="h-[18px] w-[18px]" />
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-hairline" />
        <span className="text-[12px] uppercase tracking-wider text-muted">or</span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      {!sent ? (
        <form action={requestAction} className="space-y-3">
          {nextPath && <input type="hidden" name="next" value={nextPath} />}
          <label htmlFor="email" className="block text-[13px] text-muted">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="pill w-full px-5 py-3.5 text-[16px] text-ink outline-none placeholder:text-muted focus:border-white/25"
          />
          <button
            type="submit"
            disabled={requesting}
            className="w-full rounded-full bg-ink px-5 py-3.5 text-[15px] font-bold text-base disabled:opacity-60"
          >
            {requesting ? "Sending…" : "Send me a code"}
          </button>
        </form>
      ) : (
        <form action={verifyAction} className="space-y-3">
          <input type="hidden" name="email" value={email} />
          {nextPath && <input type="hidden" name="next" value={nextPath} />}
          <p className="text-[14px] text-muted">
            We sent a code to <span className="text-ink">{email}</span>. Enter it below, or tap the
            link in the email.
          </p>
          <input
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            placeholder="123456"
            className="pill w-full px-5 py-3.5 text-center text-[22px] tracking-[0.4em] text-ink outline-none placeholder:tracking-[0.4em] placeholder:text-muted focus:border-white/25"
          />
          <button
            type="submit"
            disabled={verifying}
            className="w-full rounded-full bg-ink px-5 py-3.5 text-[15px] font-bold text-base disabled:opacity-60"
          >
            {verifying ? "Verifying…" : "Verify and continue"}
          </button>
        </form>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-2xl border border-urgency/30 bg-urgency/10 px-4 py-3 text-[13.5px] leading-relaxed text-urgency"
        >
          {error}
        </p>
      )}

      {demoEnabled && (
        <div className="mt-8 rounded-2xl border border-dashed border-hairline p-4">
          <p className="section-header text-[11px] text-muted">Development only</p>
          <button
            type="button"
            onClick={onDemo}
            disabled={pending}
            className="mt-3 w-full rounded-full border border-hairline px-5 py-3 text-[14px] font-semibold text-ink transition-colors hover:bg-white/5 disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Enter the demo account"}
          </button>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            Skips the email round-trip and signs you into a shared demo account. This button only
            exists while <code className="text-ink">ENABLE_DEMO_LOGIN</code> is set outside
            production.
          </p>
        </div>
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
