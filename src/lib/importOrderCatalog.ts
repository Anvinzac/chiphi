import { supabase } from "@/integrations/supabase/client";
import seed from "@/data/orderIngredientsSeed.json";

/** Old pantry keys → current 5 order categories. */
const LEGACY_SOURCE_KEY: Record<string, string> = {
  vegetables: "rau",
  tofu: "dau-hu",
  spices: "gia-vi",
  sauces: "nuoc-tuong",
  proteins: "khac",
  dairy: "khac",
  grains: "khac",
  oils: "khac",
  equipment: "khac",
  tissue: "khac",
  gas: "khac",
};

const CANONICAL_KEYS = new Set(seed.categories.map(c => c.key));

/** Upsert pantry seed into the current user's order catalog. Safe to re-run. */
export async function importOrderCatalogFromSeed(userId: string): Promise<{
  categories: number;
  ingredients: number;
}> {
  const now = new Date().toISOString();
  const catByKey = new Map<string, string>();

  const { data: existingCats, error: fetchCatErr } = await supabase
    .from("order_categories")
    .select("id, source_key, name")
    .eq("user_id", userId);
  if (fetchCatErr) throw fetchCatErr;

  for (const row of existingCats || []) {
    if (!row.source_key) continue;
    const canonical = CANONICAL_KEYS.has(row.source_key)
      ? row.source_key
      : LEGACY_SOURCE_KEY[row.source_key];
    if (canonical && !catByKey.has(canonical)) {
      // Prefer already-canonical rows; legacy rows remapped below
      if (CANONICAL_KEYS.has(row.source_key)) catByKey.set(row.source_key, row.id);
    }
  }

  for (const c of seed.categories) {
    const existingId = catByKey.get(c.key);
    if (existingId) {
      const { error } = await supabase
        .from("order_categories")
        .update({
          name: c.nameVi,
          sort_order: c.sort_order,
          source_key: c.key,
          updated_at: now,
        })
        .eq("id", existingId);
      if (error) throw error;
    } else {
      // Maybe a legacy row exists that should become this key
      const legacyKeys = Object.entries(LEGACY_SOURCE_KEY)
        .filter(([, neo]) => neo === c.key)
        .map(([old]) => old);
      const legacyRow = (existingCats || []).find(
        row => row.source_key && legacyKeys.includes(row.source_key),
      );

      if (legacyRow) {
        const { error } = await supabase
          .from("order_categories")
          .update({
            name: c.nameVi,
            sort_order: c.sort_order,
            source_key: c.key,
            updated_at: now,
          })
          .eq("id", legacyRow.id);
        if (error) throw error;
        catByKey.set(c.key, legacyRow.id);
      } else {
        const { data, error } = await supabase
          .from("order_categories")
          .insert({
            user_id: userId,
            name: c.nameVi,
            sort_order: c.sort_order,
            source_key: c.key,
          })
          .select("id")
          .single();
        if (error) throw error;
        catByKey.set(c.key, data.id);
      }
    }
  }

  // Ensure map is complete from DB
  const { data: refreshedCats, error: refErr } = await supabase
    .from("order_categories")
    .select("id, source_key")
    .eq("user_id", userId)
    .not("source_key", "is", null);
  if (refErr) throw refErr;
  for (const row of refreshedCats || []) {
    if (row.source_key && CANONICAL_KEYS.has(row.source_key)) {
      catByKey.set(row.source_key, row.id);
    }
  }

  const { data: existingIngs, error: fetchIngErr } = await supabase
    .from("order_ingredients")
    .select("id, source_key, category_id")
    .eq("user_id", userId);
  if (fetchIngErr) throw fetchIngErr;

  const ingIdByKey = new Map<string, string>();
  for (const row of existingIngs || []) {
    if (row.source_key) ingIdByKey.set(row.source_key, row.id);
  }

  let ingredientCount = 0;
  for (const ing of seed.ingredients) {
    const category_id = catByKey.get(ing.category_key);
    if (!category_id) throw new Error(`Missing category ${ing.category_key}`);

    const payload = {
      category_id,
      name: ing.name,
      unit: ing.unit,
      subcategory: ing.subcategory,
      reference_price: ing.reference_price_vnd,
      quick_quantities: ing.quick_quantities,
      updated_at: now,
    };

    const existingId = ingIdByKey.get(ing.source_key);
    if (existingId) {
      const { error } = await supabase
        .from("order_ingredients")
        .update(payload)
        .eq("id", existingId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("order_ingredients").insert({
        ...payload,
        user_id: userId,
        source_key: ing.source_key,
      });
      if (error) throw error;
    }
    ingredientCount += 1;
  }

  // Move leftover ingredients off obsolete categories, then delete those categories
  const keepIds = new Set(Array.from(catByKey.values()));
  const khacId = catByKey.get("khac");
  const obsolete = (refreshedCats || []).filter(
    row => row.source_key && !CANONICAL_KEYS.has(row.source_key),
  );
  // Also obsolete: categories whose id is not in keepIds
  const { data: allCats } = await supabase
    .from("order_categories")
    .select("id, source_key")
    .eq("user_id", userId);

  for (const cat of allCats || []) {
    if (keepIds.has(cat.id)) continue;
    if (khacId) {
      await supabase
        .from("order_ingredients")
        .update({ category_id: khacId, updated_at: now })
        .eq("category_id", cat.id)
        .eq("user_id", userId);
    }
    await supabase.from("order_categories").delete().eq("id", cat.id);
  }

  // Silence unused
  void obsolete;

  return { categories: catByKey.size, ingredients: ingredientCount };
}

/** Canonical order-category keys shown on the Đặt hàng hub. */
export const ORDER_HUB_CATEGORIES = seed.categories.map(c => ({
  key: c.key,
  name: c.nameVi,
  sort_order: c.sort_order,
  adminMatch: (c as { adminMatch?: string }).adminMatch || c.nameVi,
}));
