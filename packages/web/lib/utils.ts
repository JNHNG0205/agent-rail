import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/// Tailwind class merging helper for v0 and shadcn components. Member 3.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
