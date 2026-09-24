import { redirect } from "next/navigation";

/** Waitlist lives under Events now — click an event to see its queue. */
export default function OpsWaitlistRedirect() {
  redirect("/ops/events");
}
