export type CategoryFrequency = "daily" | "weekly" | "monthly";

export type CategoryVisual = {
  name: string;
  emoji: string;
  gradient: string;
  frequency: CategoryFrequency;
};

export function foldCategoryName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Soft dusty pastels — same visual weight across the set */
export const QUICK_CATEGORY_DETAILS: CategoryVisual[] = [
  { name: "Điện", emoji: "⚡", gradient: "linear-gradient(160deg, #efe4d2 0%, #d9c6a8 100%)", frequency: "monthly" },
  { name: "Thuê nhà", emoji: "🏠", gradient: "linear-gradient(160deg, #eedfe1 0%, #d8c0c4 100%)", frequency: "monthly" },
  { name: "Gas", emoji: "🔥", gradient: "linear-gradient(160deg, #f0ddd2 0%, #dbb9a8 100%)", frequency: "weekly" },
  { name: "Đi chợ", emoji: "🛒", gradient: "linear-gradient(160deg, #dde8dc 0%, #bdcfb9 100%)", frequency: "daily" },
  { name: "Bánh mì", emoji: "🥖", gradient: "linear-gradient(160deg, #f0e6d0 0%, #dbc8a6 100%)", frequency: "daily" },
  { name: "Nguyên vật liệu", emoji: "🥬", gradient: "linear-gradient(160deg, #e0ead8 0%, #c2d2b6 100%)", frequency: "daily" },
  { name: "Rau", emoji: "🥦", gradient: "linear-gradient(160deg, #dcead8 0%, #b8d0b0 100%)", frequency: "daily" },
  { name: "Đậu hũ", emoji: "🧈", gradient: "linear-gradient(160deg, #efe8d8 0%, #d8ceb4 100%)", frequency: "daily" },
  { name: "Nước tương", emoji: "🫙", gradient: "linear-gradient(160deg, #e8ddd0 0%, #d0bca8 100%)", frequency: "weekly" },
  { name: "Gạo", emoji: "🌾", gradient: "linear-gradient(160deg, #efe6d4 0%, #d8c8a8 100%)", frequency: "weekly" },
  { name: "Nước dừa", emoji: "🥥", gradient: "linear-gradient(160deg, #d9e6e6 0%, #b7cbcc 100%)", frequency: "weekly" },
  { name: "Muối", emoji: "🧂", gradient: "linear-gradient(160deg, #e2e6ea 0%, #c5cbd2 100%)", frequency: "weekly" },
  { name: "Da", emoji: "🧊", gradient: "linear-gradient(160deg, #dce8f0 0%, #b8cddc 100%)", frequency: "weekly" },
  { name: "Gia vị", emoji: "🌶️", gradient: "linear-gradient(160deg, #eadfd4 0%, #d4c0b0 100%)", frequency: "weekly" },
  { name: "Mang về", emoji: "🥡", gradient: "linear-gradient(160deg, #e4e0d8 0%, #ccc4b8 100%)", frequency: "weekly" },
  { name: "Shopee", emoji: "🛍️", gradient: "linear-gradient(160deg, #eeddd8 0%, #d6b8b0 100%)", frequency: "daily" },
  { name: "Internet", emoji: "🌐", gradient: "linear-gradient(160deg, #dde2ec 0%, #b8c2d2 100%)", frequency: "monthly" },
  { name: "Sửa chữa", emoji: "🛠️", gradient: "linear-gradient(160deg, #e8dfd8 0%, #cec0b4 100%)", frequency: "daily" },
  { name: "Vệ sinh", emoji: "🧼", gradient: "linear-gradient(160deg, #d8e8e6 0%, #b4cfcc 100%)", frequency: "daily" },
  { name: "Lương NV", emoji: "👥", gradient: "linear-gradient(160deg, #e4dde8 0%, #c8bdd2 100%)", frequency: "monthly" },
  { name: "Thuế", emoji: "🧾", gradient: "linear-gradient(160deg, #e0e4ea 0%, #c0c6d0 100%)", frequency: "monthly" },
  { name: "BHXH", emoji: "🛡️", gradient: "linear-gradient(160deg, #d8e6e0 0%, #b4cfc2 100%)", frequency: "monthly" },
  { name: "Rác", emoji: "♻️", gradient: "linear-gradient(160deg, #e4ead8 0%, #c6d0b4 100%)", frequency: "monthly" },
  { name: "Giữ xe", emoji: "🅿️", gradient: "linear-gradient(160deg, #e6e4e0 0%, #c8c6c2 100%)", frequency: "monthly" },
  { name: "Khác", emoji: "✦", gradient: "linear-gradient(160deg, #e8dde6 0%, #d0bac8 100%)", frequency: "daily" },
];

export const EXTRA_WEEKLY_CATEGORIES = ["Da", "Gia vị", "Mang về"] as const;

const BY_NAME = new Map(QUICK_CATEGORY_DETAILS.map(d => [foldCategoryName(d.name), d]));

const FALLBACK: CategoryVisual = {
  name: "Khác",
  emoji: "✦",
  gradient: "linear-gradient(160deg, #ece6e0 0%, #d8d0c8 100%)",
  frequency: "daily",
};

export function getCategoryVisual(name?: string | null): CategoryVisual {
  if (!name?.trim()) return FALLBACK;
  return BY_NAME.get(foldCategoryName(name)) ?? FALLBACK;
}
