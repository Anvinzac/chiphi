import type { PaymentGroupData } from "@/components/daily/PaymentGroup";

/**
 * Client-only sample spend for UI testing the previous period.
 * Covers Jul 3 – Aug 4, 2026 (filter by the active period bounds when loading).
 */
export const PREVIOUS_RANGE_MOCK_GROUPS: PaymentGroupData[] = [
  {
    paymentId: "mock-2026-08-04-a",
    date: "2026-08-04",
    supplierName: "Chợ Đà Lạt",
    total: 485000,
    entries: [
      { item_name: "Đi chợ", amount: 320000, category_id: null, supplier_id: null, sub_payment_id: "mock-sp-804-1" },
      { item_name: "Muối", amount: 45000, category_id: null, supplier_id: null, sub_payment_id: "mock-sp-804-2" },
      { item_name: "Nước dừa", amount: 120000, category_id: null, supplier_id: null, sub_payment_id: "mock-sp-804-3" },
    ],
  },
  {
    paymentId: "mock-2026-08-04-b",
    date: "2026-08-04",
    supplierName: "Bánh mì Hòa",
    total: 75000,
    entries: [
      { item_name: "Bánh mì", amount: 75000, category_id: null, supplier_id: null, sub_payment_id: "mock-sp-804-4" },
    ],
  },
  {
    paymentId: "mock-2026-08-01-a",
    date: "2026-08-01",
    supplierName: null,
    total: 890000,
    entries: [
      { item_name: "Internet", amount: 220000, category_id: null, supplier_id: null, sub_payment_id: "mock-sp-801-1" },
      { item_name: "Rác", amount: 70000, category_id: null, supplier_id: null, sub_payment_id: "mock-sp-801-2" },
      { item_name: "Điện", amount: 600000, category_id: null, supplier_id: null, sub_payment_id: "mock-sp-801-3" },
    ],
  },
  {
    paymentId: "mock-2026-07-28-a",
    date: "2026-07-28",
    supplierName: "Payroll",
    total: 12500000,
    entries: [
      { item_name: "Lương NV", amount: 12500000, category_id: null, supplier_id: null, sub_payment_id: "mock-sp-728-1" },
    ],
  },
  {
    paymentId: "mock-2026-07-22-a",
    date: "2026-07-22",
    supplierName: "Shopee",
    total: 356000,
    entries: [
      { item_name: "Shopee", amount: 256000, category_id: null, supplier_id: null, sub_payment_id: "mock-sp-722-1" },
      { item_name: "Vệ sinh", amount: 100000, category_id: null, supplier_id: null, sub_payment_id: "mock-sp-722-2" },
    ],
  },
  {
    paymentId: "mock-2026-07-18-a",
    date: "2026-07-18",
    supplierName: "Chợ Đà Lạt",
    total: 612000,
    entries: [
      { item_name: "Nguyên vật liệu", amount: 480000, category_id: null, supplier_id: null, sub_payment_id: "mock-sp-718-1" },
      { item_name: "Đi chợ", amount: 132000, category_id: null, supplier_id: null, sub_payment_id: "mock-sp-718-2" },
    ],
  },
  {
    paymentId: "mock-2026-07-12-a",
    date: "2026-07-12",
    supplierName: null,
    total: 450000,
    entries: [
      { item_name: "Gas", amount: 450000, category_id: null, supplier_id: null, sub_payment_id: "mock-sp-712-1" },
    ],
  },
  {
    paymentId: "mock-2026-07-12-b",
    date: "2026-07-12",
    supplierName: "Sửa ống nước Minh",
    total: 780000,
    entries: [
      { item_name: "Sửa chữa", amount: 780000, category_id: null, supplier_id: null, sub_payment_id: "mock-sp-712-2" },
    ],
  },
  {
    paymentId: "mock-2026-07-06-a",
    date: "2026-07-06",
    supplierName: "Chợ Đà Lạt",
    total: 295000,
    entries: [
      { item_name: "Đi chợ", amount: 210000, category_id: null, supplier_id: null, sub_payment_id: "mock-sp-706-1" },
      { item_name: "Bánh mì", amount: 85000, category_id: null, supplier_id: null, sub_payment_id: "mock-sp-706-2" },
    ],
  },
  {
    paymentId: "mock-2026-07-03-a",
    date: "2026-07-03",
    supplierName: null,
    total: 8400000,
    entries: [
      { item_name: "Thuê nhà", amount: 8000000, category_id: null, supplier_id: null, sub_payment_id: "mock-sp-703-1" },
      { item_name: "Giữ xe", amount: 400000, category_id: null, supplier_id: null, sub_payment_id: "mock-sp-703-2" },
    ],
  },
];

export function isMockPaymentId(id: string) {
  return id.startsWith("mock-");
}

export function getMockGroupsForRange(startStr: string, endStr: string): PaymentGroupData[] {
  return PREVIOUS_RANGE_MOCK_GROUPS.filter(
    g => !!g.date && g.date >= startStr && g.date <= endStr
  );
}
