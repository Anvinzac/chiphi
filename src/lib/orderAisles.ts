/** Market-aisle labels for pantry subcategory slugs (and free-text names). */

export type AisleMeta = {
  key: string;
  title: string;
  emoji: string;
  fill: string;
  ink: string;
};

const AISLES: Record<string, Omit<AisleMeta, "key">> = {
  "root-vegetables": { title: "Củ", emoji: "🥕", fill: "#ead8c8", ink: "#4a3b32" },
  "leafy-greens": { title: "Lá", emoji: "🥬", fill: "#d8e4d2", ink: "#3a4a36" },
  herbs: { title: "Thơm", emoji: "🌿", fill: "#dce6d4", ink: "#3a4634" },
  "fruit-vegetables": { title: "Trái", emoji: "🍆", fill: "#e6d8de", ink: "#4a3840" },
  mushrooms: { title: "Nấm", emoji: "🍄", fill: "#e4d6cc", ink: "#4a3c36" },
  "beans-legumes": { title: "Đậu", emoji: "🫘", fill: "#e6dfd0", ink: "#4a4336" },
  "stems-shoots": { title: "Ngọn", emoji: "🎋", fill: "#d6e2dc", ink: "#354640" },
  "sea-vegetables": { title: "Biển", emoji: "🌊", fill: "#d4dfe6", ink: "#334048" },
  "tofu-products": { title: "Đậu phụ", emoji: "🧈", fill: "#e8e2d4", ink: "#4a4436" },
};

const FALLBACK: Omit<AisleMeta, "key"> = { title: "Khác", emoji: "✦", fill: "#e4ddd6", ink: "#3f3a36" };
const SEARCH: Omit<AisleMeta, "key"> = { title: "Tìm", emoji: "🔎", fill: "#d8e0e6", ink: "#364048" };

/** Market-walk order: củ → lá → thơm → trái → nấm → đậu → ngọn → khác. */
const WALK = [
  "root-vegetables",
  "leafy-greens",
  "herbs",
  "fruit-vegetables",
  "mushrooms",
  "beans-legumes",
  "stems-shoots",
  "sea-vegetables",
  "tofu-products",
  "khac",
] as const;

export function aisleWalkIndex(key: string): number {
  const i = (WALK as readonly string[]).indexOf(key);
  return i >= 0 ? i : WALK.length;
}

export function aisleMeta(subcategory: string | null | undefined): AisleMeta {
  const raw = (subcategory || "").trim();
  if (!raw) return { key: "khac", ...FALLBACK };
  const folded = raw.toLowerCase();
  const known = AISLES[folded];
  if (known) return { key: folded, ...known };
  const pretty = raw.includes("-")
    ? raw.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : raw;
  return { key: folded, title: pretty, emoji: "✦", fill: FALLBACK.fill, ink: FALLBACK.ink };
}

export function searchAisleMeta(): AisleMeta {
  return { key: "search", ...SEARCH };
}
