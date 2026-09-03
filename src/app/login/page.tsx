import { redirect } from "next/navigation";
import { getSessionUser } from "@/domains/users/session";
import { demoLoginEnabled } from "@/lib/env";
import { sanitizeNextPath } from "@/lib/next-path";
import { ShieldIcon } from "@/components/icons";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · Passe" };

const ERROR_COPY: Record<string, string> = {
  invalid_link: "That sign-in link was malformed. Request a new one.",
  expired_link: "That sign-in link has expired. Request a new one.",
  missing_code: "The sign-in provider didn't return a code. Try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const nextPath = sanitizeNextPath(next);

  if (await getSessionUser()) redirect(nextPath ?? "/");

  // The demo flag is read here, on the server. The button's visibility and the
  // action's authorisation come from the same check — hiding the button is
  // never what enforces it.
  const demoEnabled = demoLoginEnabled();

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
      <p className="section-header text-muted">Passe · Montreal</p>
      <h1 className="headline mt-3 text-[36px] leading-[1.08] tracking-tight">
        Tickets that
        <br />
        actually exist.
      </h1>
      <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-muted">
        Resell and pick up tickets to parties and club nights around Montreal — at face value, with
        the full price breakdown up front.
      </p>

      <div className="mt-10">
        <LoginForm
          demoEnabled={demoEnabled}
          initialError={error ? (ERROR_COPY[error] ?? decodeURIComponent(error)) : undefined}
          nextPath={nextPath ?? undefined}
        />
      </div>

      <p className="mt-8 flex items-start gap-2.5 text-[13px] leading-relaxed text-muted">
        <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          No passwords. We email you a one-time code to confirm the address is real — that&apos;s the
          whole signup.
        </span>
      </p>
    </main>
  );
}
