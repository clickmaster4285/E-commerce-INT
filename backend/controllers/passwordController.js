// src/actions/password.js
"use server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function changePassword(currentPass, newPass) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const user = await db.user.findUnique({ where: { id: session.userId } });
    
    // Verify current password
    const isValid = await bcrypt.compare(currentPass, user.passwordHash);
    if (!isValid) return { success: false, message: "Current password is incorrect" };

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPass, 12);
    await db.user.update({
      where: { id: session.userId },
      data: { passwordHash: hashedPassword },
    });

    return { success: true, message: "Password changed successfully!" };
  } catch (error) {
    return { success: false, message: "Something went wrong" };
  }
}