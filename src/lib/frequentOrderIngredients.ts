/** Staples that get a color dot in the order chip cloud for faster scanning. */
const FREQUENT_NAMES = [
  // Rau
  "Cà Rốt",
  "Khoai Tây",
  "Hành Tây",
  "Tỏi",
  "Gừng",
  "Bắp Cải",
  "Cải Thìa",
  "Hành Lá",
  "Ngò Rí",
  "Xà Lách",
  "Cà Chua",
  "Nấm",
  "Nấm rơm",
  "Rau Muống",
  "Bông Cải Xanh",
  // Đậu hũ
  "Đậu hũ trắng",
  "Đậu hũ non",
  "Đậu hũ chiên",
  "Đậu bi",
  // Gia vị
  "Muối",
  "Tiêu Đen",
  "Ớt Bột",
  "Bột Ngọt",
  "Nghệ",
  // Nước tương / sốt
  "Nước Tương",
  "Dầu Hào",
  "Nước Mắm",
  "Tương Ớt",
  "Giấm",
  // Khác
  "Gạo",
  "Bún",
  "Mì",
  "Đường",
  "Dầu Ăn",
  "Dầu Mè",
] as const;

const FREQUENT_KEYS = new Set(FREQUENT_NAMES.map(n => n.trim().toLowerCase()));

/** Distinct dots — stable per name so staff learn “cà rốt = amber”, etc. */
const DOT_CLASSES = [
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-rose-500",
  "bg-orange-500",
  "bg-teal-600",
  "bg-lime-600",
  "bg-cyan-600",
] as const;

function hashName(name: string): number {
  let h = 0;
  const key = name.trim().toLowerCase();
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function isFrequentIngredient(name: string): boolean {
  return FREQUENT_KEYS.has(name.trim().toLowerCase());
}

/** Tailwind bg class for the locator dot, or null if not frequent. */
export function frequentIngredientDotClass(name: string): string | null {
  if (!isFrequentIngredient(name)) return null;
  return DOT_CLASSES[hashName(name) % DOT_CLASSES.length];
}
