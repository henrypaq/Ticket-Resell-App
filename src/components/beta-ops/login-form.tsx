"use client";

import { useActionState } from "react";
import { betaOpsLoginAction, type OpsLoginState } from "@/domains/beta-ops/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial: OpsLoginState = {};

export function OpsLoginForm() {
  const [state, formAction, pending] = useActionState(betaOpsLoginAction, initial);

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold tracking-tight text-zinc-100">
          mcgill.tickets
        </span>
        <span className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
          ops
        </span>
      </div>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-100">Ops Sign In</h1>
      <p className="mt-1 text-xs text-zinc-400">Sign in to manage waitlists and sellers.</p>

      <form action={formAction} className="mt-6 flex flex-col gap-3.5">
        <div className="space-y-1">
          <label htmlFor="ops-email" className="text-xs font-medium text-zinc-300">
            Email
          </label>
          <Input
            id="ops-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="you@email.com"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="ops-password" className="text-xs font-medium text-zinc-300">
            Password
          </label>
          <Input
            id="ops-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {state.error && (
          <p role="alert" className="text-xs text-amber-400">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="mt-2 h-9 rounded-md text-xs font-medium">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-4 text-[11px] text-zinc-500">Session stays for 30 days on this browser.</p>
    </div>
  );
}
