import type { Metadata } from "next";
import Link from "next/link";
import { SELLER_TERMS } from "@/lib/compliance/seller-terms";

export const metadata: Metadata = {
  title: "Seller terms · mcgill.tickets",
  description: "Rules for asking mcgill.tickets to contact you to post a ticket.",
  robots: { index: false, follow: false },
};

export default function SellerTermsPage() {
  return (
    <main className="relative mx-auto min-h-dvh w-full max-w-lg px-5 py-10 sm:px-6">
      <p className="text-[17px] font-semibold tracking-tight text-[#ffe500]">mcgill.tickets</p>
      <h1 className="headline mt-6 text-[28px] leading-tight tracking-tight">{SELLER_TERMS.title}</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-muted">{SELLER_TERMS.intro}</p>

      <ol className="mt-8 list-decimal space-y-4 pl-5 text-[14px] leading-relaxed text-ink">
        {SELLER_TERMS.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ol>

      <p className="mt-10 text-[12px] text-muted">Updated {SELLER_TERMS.updated}</p>
      <Link
        href="/go"
        className="mt-6 inline-block text-[13.5px] font-semibold text-muted underline decoration-dotted underline-offset-4 hover:text-ink"
      >
        Back
      </Link>
    </main>
  );
}
