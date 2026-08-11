// src/actions/profile.js
"use server";

import { getSession } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await dbConnect();

  try {
    const updateData = {
      name: formData.get("name"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      "store.name": formData.get("storeName"),
      "store.email": formData.get("storeEmail"),
      "store.phone": formData.get("storePhone"),
      "store.website": formData.get("website"),
      "store.address": formData.get("address"),
      "preferences.darkMode": formData.get("darkMode") === "true",
      "preferences.notifications.email": formData.get("notif_email") === "true",
      "preferences.notifications.push": formData.get("notif_push") === "true",
      "preferences.notifications.weekly": formData.get("notif_weekly") === "true",
    };

    // Permissions alag se parse karein
    const perms = {};
    ['products','brands','categories','users','orders','settings'].forEach(key => {
      perms[`permissions.${key}`] = formData.get(`perm_${key}`) === "true";
    });

    await User.findByIdAndUpdate(session.userId, { 
      $set: { ...updateData, ...perms },
      $push: { 
        activityLog: { action: "Profile Updated", item: "Account Settings", timestamp: new Date() } 
      }
    });

    revalidatePath("/settings");
    return { success: true, message: "✅ Changes saved to database!" };
  } catch (error) {
    console.error("Save error:", error);
    return { success: false, message: "❌ Database save failed: " + error.message };
  }
}