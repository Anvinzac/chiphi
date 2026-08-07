import { supabase } from "@/integrations/supabase/client";
import seed from "@/data/orderIngredientsSeed.json";

/** Upsert pantry seed into the current user's order catalog. Safe to re-run. */
export async function importOrderCatalogFromSeed(userId: string): Promise<{
  categories: number;
  ingredients: number;
}> {
  const now = new Date().toISOString();
  const catByKey = new Map<string, string>();

  const { data: existingCats, error: fetchCatErr } = await supabase
    .from("order_categories")
    .select("id, source_key")
    .eq("user_id", userId)
    .not("source_key", "is", null);
  if (fetchCatErr) throw fetchCatErr;

  for (const row of existingCats || []) {
    if (row.source_key) catByKey.set(row.source_key, row.id);
  }

  for (const c of seed.categories) {
    const existingId = catByKey.get(c.key);
    if (existingId) {
      const { error } = await supabase
        .from("order_categories")
        .update({
          // Keep admin renames: only refresh sort_order on re-import
          sort_order: c.sort_order,
          updated_at: now,
        })
        .eq("id", existingId);
      if (error) throw error;
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

  const { data: existingIngs, error: fetchIngErr } = await supabase
    .from("order_ingredients")
    .select("id, source_key")
    .eq("user_id", userId)
    .not("source_key", "is", null);
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

  return { categories: catByKey.size, ingredients: ingredientCount };
}
