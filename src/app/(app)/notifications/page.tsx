import Link from "next/link";
import { requireSessionUser } from "@/domains/users/session";
import { listNotifications, markAllRead } from "@/domains/notifications/service";
import { ArrowLeft, BellIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications · Passe" };

export default async function NotificationsPage() {
  const user = await requireSessionUser();
  const notifications = await listNotifications(user.id);
  await markAllRead(user.id);

  return (
    <main className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <Link href="/" aria-label="Back" className="pill flex h-11 w-11 items-center justify-center">
        <ArrowLeft className="h-5 w-5" />
      </Link>

      <h1 className="headline mt-5 text-[28px]">Notifications</h1>

      {notifications.length === 0 ? (
        <div className="surface mt-8 rounded-2xl px-6 py-12 text-center">
          <BellIcon className="mx-auto h-7 w-7 text-muted" />
          <p className="mt-3 text-[15px] font-medium">Nothing yet</p>
          <p className="mx-auto mt-2 max-w-xs text-[13.5px] leading-relaxed text-muted">
            Join a waitlist and we&apos;ll tell you the moment a matching ticket is posted.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {notifications.map((n) => {
            const href = n.event_ref_id ? `/events/${n.event_ref_id}` : "/";
            return (
              <Link
                key={n.id}
                href={href}
                className={`block rounded-2xl border p-4 ${
                  n.read_at ? "border-hairline" : "border-white/20 bg-card"
                }`}
              >
                <div className="flex items-start gap-3">
                  {!n.read_at && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-urgency" aria-label="Unread" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold leading-snug">{n.title}</p>
                    {n.body && <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{n.body}</p>}
                    <p className="mt-2 text-[12px] text-muted">
                      {new Date(n.created_at).toLocaleString("en-CA", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
