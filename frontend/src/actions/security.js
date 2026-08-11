// src/actions/security.js
"use server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function toggle2FA(enabled) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    await db.user.update({
      where: { id: session.userId },
      data: { twoFactorEnabled: enabled },
    });

    revalidatePath("/settings");
    return { success: true, enabled };
  } catch (error) {
    return { success: false, message: "Failed to update 2FA setting" };
  }
}