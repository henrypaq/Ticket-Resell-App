import Link from "next/link";
import { requireSessionUser } from "@/domains/users/session";
import { ArrowLeft } from "@/components/icons";
import { RequestEventForm } from "./request-event-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Request an event · Passe" };

export default async function RequestEventPage() {
  await requireSessionUser();

  return (
    <main className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <Link
        href="/sell"
        aria-label="Back"
        className="pill flex h-11 w-11 items-center justify-center text-ink"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      <h1 className="headline mt-5 text-[28px] leading-tight">Request an event</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
        Paste a link to the event on Eventbrite, Showpass, Tixr, or wherever it&apos;s listed and
        we&apos;ll try to pull the details. No link? Fill it in by hand — either way, an admin reviews
        it before it&apos;s open for resale.
      </p>

      <div className="mt-7">
        <RequestEventForm />
      </div>
    </main>
  );
}
