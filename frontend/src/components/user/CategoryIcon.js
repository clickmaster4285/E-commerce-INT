"use client";

/* Category name ke hisaab se icon — koi hardcoded category list nahi,
   sirf naam ka keyword match hota hai (jaise pehle home page par tha). */

import {
  Camera,
  FolderOpen,
  Gamepad2,
  Headphones,
  Laptop,
  Percent,
  Shirt,
  ShoppingBag,
  Smartphone,
  Tv,
  Watch,
} from "lucide-react";

export default function CategoryIcon({ name, size = 20, className = "" }) {
  const value = String(name || "").toLowerCase();
  let Icon = FolderOpen;

  if (value.includes("mobile") || value.includes("phone")) Icon = Smartphone;
  else if (value.includes("laptop") || value.includes("computer")) Icon = Laptop;
  else if (value.includes("watch")) Icon = Watch;
  else if (value.includes("headphone") || value.includes("earbud") || value.includes("audio")) Icon = Headphones;
  else if (value.includes("camera") || value.includes("photo")) Icon = Camera;
  else if (value.includes("deal") || value.includes("discount") || value.includes("offer")) Icon = Percent;
  else if (value.includes("tv") || value.includes("monitor")) Icon = Tv;
  else if (value.includes("game")) Icon = Gamepad2;
  else if (value.includes("cloth") || value.includes("fashion")) Icon = Shirt;
  else if (value.includes("accessor")) Icon = ShoppingBag;

  return <Icon size={size} className={className} />;
}
