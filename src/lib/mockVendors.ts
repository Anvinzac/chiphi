import { supabase } from "@/integrations/supabase/client";

/** Default Vietnamese market / wholesale vendors for empty accounts. */
export const MOCK_VENDORS: { name: string; contact: string | null; notes: string | null }[] = [
  { name: "Chợ Đà Lạt", contact: "0901 234 567", notes: "Rau củ mỗi sáng" },
  { name: "Chợ đầu mối Bình Điền", contact: "0902 345 678", notes: "Số lượng lớn" },
  { name: "Shopee Food Mart", contact: null, notes: "Đặt online" },
  { name: "Metro An Phú", contact: "028 7300 8888", notes: "Thẻ thành viên" },
  { name: "Vựa hải sản Quận 4", contact: "0903 456 789", notes: "Cá tươi sáng" },
  { name: "Thịt heo Ba Huân", contact: "0904 567 890", notes: null },
  { name: "Gạo sạch Cần Thơ", contact: "0905 678 901", notes: "Gạo ST25" },
  { name: "Nước đá Kính Thành", contact: "0906 789 012", notes: "Giao hàng ngày" },
];

export type VendorRow = {
  id: string;
  name: string;
  contact: string | null;
  notes: string | null;
};

/** Insert mock vendors when a throwaway account has none yet. Returns the current supplier list. */
export async function ensureMockVendors(
  userId: string,
  { allowSeed = false }: { allowSeed?: boolean } = {},
): Promise<VendorRow[]> {
  const { data: existing, error } = await supabase
    .from("suppliers")
    .select("id, name, contact, notes")
    .eq("user_id", userId)
    .order("name");

  if (error) throw error;
  if ((existing && existing.length > 0) || !allowSeed) return existing ?? [];

  const { data: inserted, error: insertError } = await supabase
    .from("suppliers")
    .insert(MOCK_VENDORS.map(v => ({ ...v, user_id: userId })))
    .select("id, name, contact, notes");

  if (insertError) throw insertError;
  return inserted ?? [];
}
