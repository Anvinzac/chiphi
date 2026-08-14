import { supabase } from "@/integrations/supabase/client";
import { generateShareToken, hashPin } from "@/lib/orderShare";

type MockLine = { name: string; quantity: number; unit: string; notice?: string };

type MockOrder = {
  title: string;
  status: "draft" | "shared" | "closed";
  hoursAgo: number;
  items: MockLine[];
};

/** Sample kitchen orders — each has at least 7 lines. */
export const MOCK_ORDERS: MockOrder[] = [
  {
    title: "Đơn Rau · chợ sáng",
    status: "draft",
    hoursAgo: 4,
    items: [
      { name: "Rau Muống", quantity: 3, unit: "kg" },
      { name: "Cải Thìa", quantity: 2, unit: "kg" },
      { name: "Cà Rốt", quantity: 2, unit: "kg" },
      { name: "Hành Tây", quantity: 3, unit: "kg" },
      { name: "Tỏi", quantity: 1, unit: "kg" },
      { name: "Gừng", quantity: 0.5, unit: "kg" },
      { name: "Cà Chua", quantity: 2, unit: "kg" },
      { name: "Giá Đỗ", quantity: 1.5, unit: "kg" },
      { name: "Hành Lá", quantity: 1, unit: "kg", notice: "Tươi, không héo" },
    ],
  },
  {
    title: "Đơn Đậu hũ · chay",
    status: "draft",
    hoursAgo: 18,
    items: [
      { name: "Đậu hũ trắng", quantity: 10, unit: "gói" },
      { name: "Đậu hũ non", quantity: 6, unit: "gói" },
      { name: "Đậu hũ chiên", quantity: 8, unit: "gói" },
      { name: "Đậu bi", quantity: 4, unit: "gói" },
      { name: "Mì căn", quantity: 5, unit: "gói" },
      { name: "Sườn non chay", quantity: 3, unit: "gói" },
      { name: "Tàu hũ ky", quantity: 2, unit: "kg" },
    ],
  },
  {
    title: "Đơn Gia vị · kho",
    status: "shared",
    hoursAgo: 30,
    items: [
      { name: "Muối", quantity: 2, unit: "kg" },
      { name: "Tiêu Đen", quantity: 0.5, unit: "kg" },
      { name: "Đường", quantity: 3, unit: "kg" },
      { name: "Bột Ngọt", quantity: 1, unit: "kg" },
      { name: "Ớt Bột", quantity: 0.5, unit: "kg" },
      { name: "Nghệ", quantity: 0.3, unit: "kg" },
      { name: "Bột Tỏi", quantity: 0.5, unit: "kg" },
      { name: "Hoa Hồi", quantity: 0.2, unit: "kg" },
    ],
  },
  {
    title: "Đơn Nước tương · sốt",
    status: "shared",
    hoursAgo: 52,
    items: [
      { name: "Nước Tương", quantity: 4, unit: "chai" },
      { name: "Nước Mắm", quantity: 3, unit: "chai" },
      { name: "Dầu Hào", quantity: 2, unit: "chai" },
      { name: "Tương Ớt", quantity: 3, unit: "chai" },
      { name: "Giấm", quantity: 2, unit: "chai" },
      { name: "Tương Đen", quantity: 1, unit: "chai" },
      { name: "Sriracha", quantity: 2, unit: "chai" },
      { name: "Nước Cốt Dừa", quantity: 6, unit: "lon" },
    ],
  },
  {
    title: "Đơn Khác · đạm & gạo",
    status: "closed",
    hoursAgo: 78,
    items: [
      { name: "Gạo", quantity: 25, unit: "kg" },
      { name: "Gà", quantity: 8, unit: "kg" },
      { name: "Heo", quantity: 5, unit: "kg" },
      { name: "Tôm", quantity: 2, unit: "kg" },
      { name: "Trứng", quantity: 5, unit: "tá" },
      { name: "Dầu Ăn", quantity: 2, unit: "chai" },
      { name: "Bún", quantity: 8, unit: "gói" },
      { name: "Bánh Tráng", quantity: 4, unit: "gói" },
    ],
  },
];

const mockOrdersInflight = new Map<string, Promise<void>>();

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

function itemStatus(orderStatus: MockOrder["status"], index: number): "pending" | "partial" | "done" {
  if (orderStatus === "closed") return "done";
  if (orderStatus === "shared" && index === 0) return "partial";
  return "pending";
}

/** Insert mock orders when this account does not already have them. */
export async function ensureMockOrders(userId: string): Promise<void> {
  const existing = mockOrdersInflight.get(userId);
  if (existing) return existing;
  const pending = ensureMockOrdersOnce(userId).finally(() => {
    mockOrdersInflight.delete(userId);
  });
  mockOrdersInflight.set(userId, pending);
  return pending;
}

async function ensureMockOrdersOnce(userId: string): Promise<void> {
  const mockTitles = MOCK_ORDERS.map(o => o.title);
  const { data: existing, error } = await supabase
    .from("orders")
    .select("id, title")
    .eq("user_id", userId)
    .in("title", mockTitles);
  if (error) throw error;
  if ((existing || []).length >= MOCK_ORDERS.length) return;

  const have = new Set((existing || []).map(o => o.title));
  const missing = MOCK_ORDERS.filter(o => !have.has(o.title));
  if (missing.length === 0) return;

  const pinHash = await hashPin("1234");

  for (const mock of missing) {
    const at = hoursAgoIso(mock.hoursAgo);
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        title: mock.title,
        status: mock.status,
        share_token: generateShareToken(),
        supplier_pin_hash: pinHash,
        created_at: at,
        updated_at: at,
      })
      .select("id")
      .single();
    if (orderError) throw orderError;

    const { error: itemsError } = await supabase.from("order_items").insert(
      mock.items.map((item, index) => ({
        order_id: order.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        notice: item.notice ?? null,
        sort_order: index,
        status: itemStatus(mock.status, index),
      })),
    );
    if (itemsError) throw itemsError;
  }
}
