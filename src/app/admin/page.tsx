import Link from "next/link";
import { listPendingEvents, listHeldTransactions, recentAdminActions } from "@/domains/admin/service";
import { listAllListings } from "@/domains/admin/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Passe" };

export default async function AdminOverviewPage() {
  const [pendingEvents, listings, transactions, actions] = await Promise.all([
    listPendingEvents(),
    listAllListings(),
    listHeldTransactions(),
    recentAdminActions(20),
  ]);

  const flagged = listings.filter((l) => l.flagged_at && !l.removed_at);
  const held = transactions.filter((t) => t.escrow_status === "held");

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Pending events" value={pendingEvents.length} href="/admin/events" />
        <Stat label="Flagged listings" value={flagged.length} href="/admin/listings" />
        <Stat label="Held payments" value={held.length} href="/admin/payments" />
      </div>

      <section>
        <h2 className="section-header">Recent admin actions</h2>
        {actions.length === 0 ? (
          <p className="mt-3 text-[14px] text-muted">Nothing logged yet.</p>
        ) : (
          <div className="mt-3 divide-y divide-hairline">
            {actions.map((a) => (
              <div key={a.id} className="py-3 text-[13.5px]">
                <p>
                  <span className="font-semibold">{a.action_type}</span>{" "}
                  <span className="text-muted">
                    · {a.target_type} {a.target_id.slice(0, 8)}
                  </span>
                </p>
                {a.notes && <p className="mt-0.5 text-muted">{a.notes}</p>}
                <p className="mt-0.5 text-[12px] text-muted">
                  {new Date(a.created_at).toLocaleString("en-CA")}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="surface rounded-2xl p-4">
      <p className="text-[26px] font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-[12.5px] text-muted">{label}</p>
    </Link>
  );
}
