import { parseISO } from "date-fns";
import type { User } from "@supabase/supabase-js";
import { formatDayMonth } from "@/lib/formatDateVi";

export function customerNameFromUser(user: User | null | undefined): string {
  if (!user) return "Khách";
  const meta = user.user_metadata ?? {};
  for (const key of ["full_name", "name", "display_name"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const email = user.email?.trim();
  if (email) return email.split("@")[0] || "Khách";
  return "Khách";
}

export function formatOrderDay(iso?: string | null): string {
  if (!iso) return "";
  try {
    return formatDayMonth(parseISO(iso));
  } catch {
    return "";
  }
}

export function orderIdentityLine(order: {
  created_at?: string | null;
  day_seq?: number | null;
  mgmt_id?: string | null;
}): string {
  const parts: string[] = [];
  const day = formatOrderDay(order.created_at ?? null);
  if (day) parts.push(day);
  if (order.day_seq != null && order.day_seq > 0) parts.push(`#${order.day_seq}`);
  if (order.mgmt_id) parts.push(`ID ${order.mgmt_id}`);
  return parts.join(" · ");
}
