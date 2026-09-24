import { redirect } from "next/navigation";

/** Offers live under Sellers now — expand a seller to see their units/offers. */
export default function OpsOffersRedirect() {
  redirect("/ops/sellers");
}
