import { listHeldTransactions } from "@/domains/admin/service";
import { formatCad } from "@/lib/compliance/pricing";
import { stripeConfigured } from "@/lib/env";
import { PaymentApprovalCard } from "./payment-approval-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Payments · Passe" };

const ESCROW_LABEL: Record<string, string> = {
  none: "No payment",
  held: "Held",
  released: "Released",
  refunded: "Refunded",
  disputed: "Disputed",
};

export default async function AdminPaymentsPage() {
  const transactions = await listHeldTransactions();
  const configured = stripeConfigured();

  return (
    <div>
      <h1 className="text-[20px] font-bold">Payment approval</h1>
      <p className="mt-1 text-[13.5px] text-muted">
        Every purchase is charged into the platform balance and held. Release sends it to the
        seller; refund returns it to the buyer and reopens the listing.
      </p>

      {!configured && (
        <p className="surface mt-4 rounded-2xl p-4 text-[13px] text-muted">
          Stripe isn&apos;t configured on this environment — release and refund are disabled until
          keys are added.
        </p>
      )}

      {transactions.length === 0 ? (
        <p className="surface mt-6 rounded-2xl p-6 text-center text-[14px] text-muted">
          No transactions yet.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {transactions.map((tx) => (
            <PaymentApprovalCard
              key={tx.id}
              transaction={{
                id: tx.id,
                amount: Number(tx.amount),
                feeAmount: Number(tx.fee_amount),
                escrowStatus: tx.escrow_status,
                verificationStatus: tx.verification_status,
                createdAt: tx.created_at,
                adminNote: tx.admin_note,
                disputeReason: tx.dispute_reason,
                buyerConfirmedAt: tx.buyer_confirmed_at,
              }}
              statusLabel={ESCROW_LABEL[tx.escrow_status] ?? tx.escrow_status}
              formattedAmount={formatCad(Number(tx.amount) + Number(tx.fee_amount))}
              stripeConfigured={configured}
            />
          ))}
        </div>
      )}
    </div>
  );
}
