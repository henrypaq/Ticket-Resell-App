"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSessionUser } from "@/domains/users/session";
import { confirmAttendance, followUser, unconfirmAttendance, unfollowUser } from "./service";

export async function toggleFollowAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser();
  const followeeId = z.string().uuid().parse(formData.get("followeeId"));
  const following = formData.get("following") === "true";
  const handle = String(formData.get("handle") ?? "").trim();

  if (following) {
    await unfollowUser(user.id, followeeId);
  } else {
    await followUser(user.id, followeeId);
  }

  if (handle) revalidatePath(`/u/${handle}`);
  revalidatePath("/profile");
}

export async function toggleAttendanceAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser();
  const eventId = z.string().uuid().parse(formData.get("eventId"));
  const going = formData.get("going") === "true";

  if (going) {
    await unconfirmAttendance(user.id, eventId);
  } else {
    await confirmAttendance(user.id, eventId);
  }

  revalidatePath(`/events/${eventId}`);
}
