import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(
  profile?: { firstName?: string | null; lastName?: string | null } | null
): string {
  const first = profile?.firstName?.trim().charAt(0) ?? ""
  const last = profile?.lastName?.trim().charAt(0) ?? ""
  return (first + last).toUpperCase()
}
