"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSessionUser } from "@/domains/users/session";
import { joinWaitlist, leaveWaitlist } from "./service";

export async function toggleWaitlistAction(formData: FormData) {
  const user = await requireSessionUser();
  const eventId = z.string().uuid().parse(formData.get("eventId"));
  const joined = formData.get("joined") === "true";

  if (joined) {
    await leaveWaitlist(user.id, eventId);
  } else {
    await joinWaitlist(user.id, eventId);
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/profile");
  revalidatePath("/");
}
