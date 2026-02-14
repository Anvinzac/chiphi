import { supabase } from "@/integrations/supabase/client";

const SEED_KEY = "mise-seeded";

export async function seedDataForUser(userId: string) {
  // Check if already seeded via a simple flag in categories count
  const { count } = await supabase
    .from("categories")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (count && count > 0) return; // Already has data

  // Categories
  const { data: cats } = await supabase.from("categories").insert([
    { name: "Food & Ingredients", user_id: userId },
    { name: "Kitchen Supplies", user_id: userId },
    { name: "Operations", user_id: userId },
    { name: "Beverages", user_id: userId },
  ]).select("id, name");

  if (!cats) return;
  const catMap = Object.fromEntries(cats.map(c => [c.name, c.id]));

  // Sub-categories level 1
  const { data: subs } = await supabase.from("sub_categories").insert([
    { name: "Vegetables", category_id: catMap["Food & Ingredients"], user_id: userId },
    { name: "Meat & Seafood", category_id: catMap["Food & Ingredients"], user_id: userId },
    { name: "Dairy & Eggs", category_id: catMap["Food & Ingredients"], user_id: userId },
    { name: "Dry Goods & Spices", category_id: catMap["Food & Ingredients"], user_id: userId },
    { name: "Equipment", category_id: catMap["Kitchen Supplies"], user_id: userId },
    { name: "Disposables", category_id: catMap["Kitchen Supplies"], user_id: userId },
    { name: "Cleaning", category_id: catMap["Kitchen Supplies"], user_id: userId },
    { name: "Utilities", category_id: catMap["Operations"], user_id: userId },
    { name: "Maintenance", category_id: catMap["Operations"], user_id: userId },
    { name: "Alcoholic", category_id: catMap["Beverages"], user_id: userId },
    { name: "Non-Alcoholic", category_id: catMap["Beverages"], user_id: userId },
  ]).select("id, name");

  if (!subs) return;
  const subMap = Object.fromEntries(subs.map(s => [s.name, s.id]));

  // Sub-categories level 2 (under Vegetables and Meat & Seafood)
  const { data: subSubs } = await supabase.from("sub_categories").insert([
    { name: "Leafy Greens", category_id: catMap["Food & Ingredients"], parent_sub_category_id: subMap["Vegetables"], user_id: userId },
    { name: "Root Vegetables", category_id: catMap["Food & Ingredients"], parent_sub_category_id: subMap["Vegetables"], user_id: userId },
    { name: "Herbs & Aromatics", category_id: catMap["Food & Ingredients"], parent_sub_category_id: subMap["Vegetables"], user_id: userId },
    { name: "Poultry", category_id: catMap["Food & Ingredients"], parent_sub_category_id: subMap["Meat & Seafood"], user_id: userId },
    { name: "Beef & Pork", category_id: catMap["Food & Ingredients"], parent_sub_category_id: subMap["Meat & Seafood"], user_id: userId },
    { name: "Seafood", category_id: catMap["Food & Ingredients"], parent_sub_category_id: subMap["Meat & Seafood"], user_id: userId },
  ]).select("id, name");

  if (!subSubs) return;
  const subSubMap = Object.fromEntries(subSubs.map(s => [s.name, s.id]));

  // Suppliers
  const { data: suppliers } = await supabase.from("suppliers").insert([
    { name: "Farm Fresh Co.", contact: "0901234567", user_id: userId },
    { name: "Green Valley Market", contact: "0907654321", user_id: userId },
    { name: "Ocean Catch Seafood", contact: "0909876543", user_id: userId },
    { name: "Metro Wholesale", contact: "0903456789", user_id: userId },
    { name: "Local Herb Garden", contact: "0905678901", user_id: userId },
  ]).select("id, name");

  if (!suppliers) return;
  const supMap = Object.fromEntries(suppliers.map(s => [s.name, s.id]));

  // Items
  const { data: itemsData } = await supabase.from("items").insert([
    { name: "Morning Glory", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Vegetables"], sub_sub_category_id: subSubMap["Leafy Greens"], default_supplier_id: supMap["Farm Fresh Co."], default_unit_price: 15000, unit: "kg", user_id: userId },
    { name: "Bok Choy", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Vegetables"], sub_sub_category_id: subSubMap["Leafy Greens"], default_supplier_id: supMap["Green Valley Market"], default_unit_price: 12000, unit: "kg", user_id: userId },
    { name: "Carrots", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Vegetables"], sub_sub_category_id: subSubMap["Root Vegetables"], default_supplier_id: supMap["Farm Fresh Co."], default_unit_price: 18000, unit: "kg", user_id: userId },
    { name: "Chicken Breast", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Meat & Seafood"], sub_sub_category_id: subSubMap["Poultry"], default_supplier_id: supMap["Metro Wholesale"], default_unit_price: 85000, unit: "kg", user_id: userId },
    { name: "Pork Belly", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Meat & Seafood"], sub_sub_category_id: subSubMap["Beef & Pork"], default_supplier_id: supMap["Metro Wholesale"], default_unit_price: 120000, unit: "kg", user_id: userId },
    { name: "Tiger Prawns", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Meat & Seafood"], sub_sub_category_id: subSubMap["Seafood"], default_supplier_id: supMap["Ocean Catch Seafood"], default_unit_price: 280000, unit: "kg", user_id: userId },
    { name: "Thai Basil", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Vegetables"], sub_sub_category_id: subSubMap["Herbs & Aromatics"], default_supplier_id: supMap["Local Herb Garden"], default_unit_price: 25000, unit: "kg", user_id: userId },
    { name: "Eggs", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Dairy & Eggs"], default_supplier_id: supMap["Metro Wholesale"], default_unit_price: 3500, unit: "piece", user_id: userId },
    { name: "Cooking Oil", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Dry Goods & Spices"], default_supplier_id: supMap["Metro Wholesale"], default_unit_price: 45000, unit: "liter", user_id: userId },
    { name: "Dish Soap", category_id: catMap["Kitchen Supplies"], sub_category_id: subMap["Cleaning"], default_supplier_id: supMap["Metro Wholesale"], default_unit_price: 35000, unit: "bottle", user_id: userId },
  ]).select("id, name, category_id, sub_category_id, default_supplier_id, default_unit_price");

  if (!itemsData) return;
  const itemMap = Object.fromEntries(itemsData.map(i => [i.name, i]));

  // Seed sample purchases for past 3 days
  const today = new Date();
  const pastDays = [
    { offset: 1, purchases: [
      { item: "Morning Glory", qty: 3, amount: 45000 },
      { item: "Chicken Breast", qty: 2, amount: 170000 },
      { item: "Eggs", qty: 30, amount: 105000 },
      { item: "Cooking Oil", qty: 1, amount: 45000 },
      { item: "Thai Basil", qty: 0.5, amount: 12500 },
    ]},
    { offset: 2, purchases: [
      { item: "Tiger Prawns", qty: 1.5, amount: 420000 },
      { item: "Pork Belly", qty: 2, amount: 240000 },
      { item: "Bok Choy", qty: 2, amount: 24000 },
      { item: "Dish Soap", qty: 2, amount: 70000 },
    ]},
    { offset: 3, purchases: [
      { item: "Carrots", qty: 5, amount: 90000 },
      { item: "Chicken Breast", qty: 3, amount: 255000 },
      { item: "Morning Glory", qty: 2, amount: 30000 },
    ]},
  ];

  for (const day of pastDays) {
    const d = new Date(today);
    d.setDate(d.getDate() - day.offset);
    const dateStr = d.toISOString().split("T")[0];
    const totalAmount = day.purchases.reduce((s, p) => s + p.amount, 0);

    const { data: payment } = await supabase.from("payments").insert({
      date: dateStr,
      user_id: userId,
      total_amount: totalAmount,
      supplier_id: supMap["Metro Wholesale"],
    }).select("id").single();

    if (!payment) continue;

    await supabase.from("sub_payments").insert(
      day.purchases.map(p => {
        const it = itemMap[p.item];
        return {
          payment_id: payment.id,
          item_name: p.item,
          item_id: it?.id || null,
          quantity: p.qty,
          unit_price: it?.default_unit_price || p.amount,
          amount: p.amount,
          category_id: it?.category_id || null,
          sub_category_id: it?.sub_category_id || null,
          supplier_id: it?.default_supplier_id || null,
          user_id: userId,
        };
      })
    );
  }
}
