/** Top-N ordered ingredients per category get a color locator dot. */
export const TOP_FREQUENT_PER_CATEGORY = 5;

/** Distinct dots — stable per name so staff learn colors. */
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

export function ingredientDotClass(name: string): string {
  return DOT_CLASSES[hashName(name) % DOT_CLASSES.length];
}

type CountedIngredient = {
  name: string;
  category_id: string;
  order_count?: number | null;
};

/**
 * Names (lowercase) of the top `limit` ingredients by order_count within a category.
 * Ties keep stable name order; zero-count items are excluded.
 */
export function topFrequentNamesForCategory(
  ingredients: CountedIngredient[],
  categoryId: string,
  limit = TOP_FREQUENT_PER_CATEGORY,
): Set<string> {
  const ranked = ingredients
    .filter(ing => ing.category_id === categoryId && (ing.order_count ?? 0) > 0)
    .sort((a, b) => {
      const diff = (b.order_count ?? 0) - (a.order_count ?? 0);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, "vi");
    })
    .slice(0, limit);

  return new Set(ranked.map(ing => ing.name.trim().toLowerCase()));
}

/** Tailwind bg class for the locator dot, or null if not in the frequent set. */
export function frequentIngredientDotClass(
  name: string,
  frequentNames: Set<string>,
): string | null {
  if (!frequentNames.has(name.trim().toLowerCase())) return null;
  return ingredientDotClass(name);
}
