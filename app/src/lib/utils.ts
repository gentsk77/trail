import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/* shadcn's class combiner; ui/ components depend on it. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
