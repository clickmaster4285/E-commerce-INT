import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn helper: conditional classes + Tailwind conflicts merge
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
