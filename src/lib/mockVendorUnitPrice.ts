/** Mock per-kg (or per-unit) stall prices in VND — vendor UI preview until catalog prices are shared. */

const NAMED: Record<string, number> = {
  "rau muống": 15_000,
  "cải thìa": 12_000,
  "cà rốt": 18_000,
  "hành tây": 10_000,
  "tỏi": 40_000,
  "gừng": 35_000,
  "cà chua": 22_000,
  "giá đỗ": 8_000,
  "hành lá": 25_000,
  "đậu hũ trắng": 8_000,
  "đậu hũ non": 9_000,
  "đậu hũ chiên": 10_000,
  "muối": 8_000,
  "tiêu đen": 180_000,
  "đường": 22_000,
  "nước tương": 28_000,
  "nước mắm": 35_000,
  "gạo": 18_000,
  "gà": 85_000,
};

export const VENDOR_PRICE_STEP = 1_000;

export function mockVendorUnitPrice(name: string): number {
  const key = name.trim().toLowerCase();
  const named = NAMED[key];
  if (named) return named;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 8_000 + ((hash >>> 0) % 33) * 1_000;
}

export function effectiveVendorUnitPrice(
  name: string,
  retailPrice: number | null | undefined,
): number {
  if (retailPrice != null && Number(retailPrice) > 0) return Number(retailPrice);
  return mockVendorUnitPrice(name);
}
