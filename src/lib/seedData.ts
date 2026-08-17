import { supabase } from "@/integrations/supabase/client";

export const SEED_SUPPLIER_NAME = "Metro Wholesale";

const SEED_ITEM_NAMES = new Set([
  "Morning Glory",
  "Bok Choy",
  "Carrots",
  "Potatoes",
  "Onions",
  "Garlic",
  "Ginger",
  "Thai Basil",
  "Lemongrass",
  "Chili Peppers",
  "Tomatoes",
  "Bean Sprouts",
  "Chicken Breast",
  "Chicken Thigh",
  "Pork Belly",
  "Ground Pork",
  "Beef Sirloin",
  "Tiger Prawns",
  "Squid",
  "Fish Fillet",
  "Eggs",
  "Butter",
  "Coconut Milk",
  "Cooking Oil",
  "Fish Sauce",
  "Soy Sauce",
  "Rice",
  "Noodles",
  "Sugar",
  "Dish Soap",
]);

/**
 * Remove English Metro Wholesale sample purchases from a real/admin account.
 * Only deletes payments whose lines are entirely the seeded catalog names.
 */
export async function purgeSeededSampleSpend(userId: string): Promise<number> {
  const { data: suppliers, error: supErr } = await supabase
    .from("suppliers")
    .select("id")
    .eq("user_id", userId)
    .eq("name", SEED_SUPPLIER_NAME);
  if (supErr || !suppliers?.length) return 0;

  const supplierIds = suppliers.map(s => s.id);
  const { data: payments, error: payErr } = await supabase
    .from("payments")
    .select("id, sub_payments(item_name)")
    .eq("user_id", userId)
    .in("supplier_id", supplierIds);
  if (payErr || !payments?.length) return 0;

  const seedPaymentIds = payments
    .filter(p => {
      const lines = (p.sub_payments as { item_name: string }[] | null) ?? [];
      return lines.length > 0 && lines.every(line => SEED_ITEM_NAMES.has(line.item_name));
    })
    .map(p => p.id);
  if (seedPaymentIds.length === 0) return 0;

  await supabase.from("sub_payments").delete().in("payment_id", seedPaymentIds).eq("user_id", userId);
  await supabase.from("payments").delete().in("id", seedPaymentIds).eq("user_id", userId);
  return seedPaymentIds.length;
}

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
    { name: SEED_SUPPLIER_NAME, contact: "0903456789", user_id: userId },
    { name: "Local Herb Garden", contact: "0905678901", user_id: userId },
  ]).select("id, name");

  if (!suppliers) return;
  const supMap = Object.fromEntries(suppliers.map(s => [s.name, s.id]));

  // Items — 30 common restaurant items
  const { data: itemsData } = await supabase.from("items").insert([
    { name: "Morning Glory", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Vegetables"], sub_sub_category_id: subSubMap["Leafy Greens"], default_supplier_id: supMap["Farm Fresh Co."], default_unit_price: 15000, unit: "kg", user_id: userId },
    { name: "Bok Choy", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Vegetables"], sub_sub_category_id: subSubMap["Leafy Greens"], default_supplier_id: supMap["Green Valley Market"], default_unit_price: 12000, unit: "kg", user_id: userId },
    { name: "Carrots", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Vegetables"], sub_sub_category_id: subSubMap["Root Vegetables"], default_supplier_id: supMap["Farm Fresh Co."], default_unit_price: 18000, unit: "kg", user_id: userId },
    { name: "Potatoes", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Vegetables"], sub_sub_category_id: subSubMap["Root Vegetables"], default_supplier_id: supMap["Farm Fresh Co."], default_unit_price: 14000, unit: "kg", user_id: userId },
    { name: "Onions", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Vegetables"], sub_sub_category_id: subSubMap["Root Vegetables"], default_supplier_id: supMap["Green Valley Market"], default_unit_price: 10000, unit: "kg", user_id: userId },
    { name: "Garlic", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Vegetables"], sub_sub_category_id: subSubMap["Herbs & Aromatics"], default_supplier_id: supMap["Local Herb Garden"], default_unit_price: 40000, unit: "kg", user_id: userId },
    { name: "Ginger", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Vegetables"], sub_sub_category_id: subSubMap["Herbs & Aromatics"], default_supplier_id: supMap["Local Herb Garden"], default_unit_price: 35000, unit: "kg", user_id: userId },
    { name: "Thai Basil", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Vegetables"], sub_sub_category_id: subSubMap["Herbs & Aromatics"], default_supplier_id: supMap["Local Herb Garden"], default_unit_price: 25000, unit: "kg", user_id: userId },
    { name: "Lemongrass", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Vegetables"], sub_sub_category_id: subSubMap["Herbs & Aromatics"], default_supplier_id: supMap["Local Herb Garden"], default_unit_price: 20000, unit: "kg", user_id: userId },
    { name: "Chili Peppers", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Vegetables"], sub_sub_category_id: subSubMap["Herbs & Aromatics"], default_supplier_id: supMap["Green Valley Market"], default_unit_price: 30000, unit: "kg", user_id: userId },
    { name: "Tomatoes", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Vegetables"], sub_sub_category_id: subSubMap["Root Vegetables"], default_supplier_id: supMap["Farm Fresh Co."], default_unit_price: 22000, unit: "kg", user_id: userId },
    { name: "Bean Sprouts", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Vegetables"], sub_sub_category_id: subSubMap["Leafy Greens"], default_supplier_id: supMap["Green Valley Market"], default_unit_price: 8000, unit: "kg", user_id: userId },
    { name: "Chicken Breast", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Meat & Seafood"], sub_sub_category_id: subSubMap["Poultry"], default_supplier_id: supMap[SEED_SUPPLIER_NAME], default_unit_price: 85000, unit: "kg", user_id: userId },
    { name: "Chicken Thigh", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Meat & Seafood"], sub_sub_category_id: subSubMap["Poultry"], default_supplier_id: supMap[SEED_SUPPLIER_NAME], default_unit_price: 75000, unit: "kg", user_id: userId },
    { name: "Pork Belly", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Meat & Seafood"], sub_sub_category_id: subSubMap["Beef & Pork"], default_supplier_id: supMap[SEED_SUPPLIER_NAME], default_unit_price: 120000, unit: "kg", user_id: userId },
    { name: "Ground Pork", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Meat & Seafood"], sub_sub_category_id: subSubMap["Beef & Pork"], default_supplier_id: supMap[SEED_SUPPLIER_NAME], default_unit_price: 95000, unit: "kg", user_id: userId },
    { name: "Beef Sirloin", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Meat & Seafood"], sub_sub_category_id: subSubMap["Beef & Pork"], default_supplier_id: supMap[SEED_SUPPLIER_NAME], default_unit_price: 250000, unit: "kg", user_id: userId },
    { name: "Tiger Prawns", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Meat & Seafood"], sub_sub_category_id: subSubMap["Seafood"], default_supplier_id: supMap["Ocean Catch Seafood"], default_unit_price: 280000, unit: "kg", user_id: userId },
    { name: "Squid", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Meat & Seafood"], sub_sub_category_id: subSubMap["Seafood"], default_supplier_id: supMap["Ocean Catch Seafood"], default_unit_price: 150000, unit: "kg", user_id: userId },
    { name: "Fish Fillet", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Meat & Seafood"], sub_sub_category_id: subSubMap["Seafood"], default_supplier_id: supMap["Ocean Catch Seafood"], default_unit_price: 180000, unit: "kg", user_id: userId },
    { name: "Eggs", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Dairy & Eggs"], default_supplier_id: supMap[SEED_SUPPLIER_NAME], default_unit_price: 3500, unit: "piece", user_id: userId },
    { name: "Butter", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Dairy & Eggs"], default_supplier_id: supMap[SEED_SUPPLIER_NAME], default_unit_price: 65000, unit: "block", user_id: userId },
    { name: "Coconut Milk", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Dairy & Eggs"], default_supplier_id: supMap[SEED_SUPPLIER_NAME], default_unit_price: 18000, unit: "can", user_id: userId },
    { name: "Cooking Oil", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Dry Goods & Spices"], default_supplier_id: supMap[SEED_SUPPLIER_NAME], default_unit_price: 45000, unit: "liter", user_id: userId },
    { name: "Fish Sauce", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Dry Goods & Spices"], default_supplier_id: supMap[SEED_SUPPLIER_NAME], default_unit_price: 22000, unit: "bottle", user_id: userId },
    { name: "Soy Sauce", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Dry Goods & Spices"], default_supplier_id: supMap[SEED_SUPPLIER_NAME], default_unit_price: 18000, unit: "bottle", user_id: userId },
    { name: "Rice", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Dry Goods & Spices"], default_supplier_id: supMap[SEED_SUPPLIER_NAME], default_unit_price: 16000, unit: "kg", user_id: userId },
    { name: "Noodles", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Dry Goods & Spices"], default_supplier_id: supMap[SEED_SUPPLIER_NAME], default_unit_price: 12000, unit: "pack", user_id: userId },
    { name: "Sugar", category_id: catMap["Food & Ingredients"], sub_category_id: subMap["Dry Goods & Spices"], default_supplier_id: supMap[SEED_SUPPLIER_NAME], default_unit_price: 15000, unit: "kg", user_id: userId },
    { name: "Dish Soap", category_id: catMap["Kitchen Supplies"], sub_category_id: subMap["Cleaning"], default_supplier_id: supMap[SEED_SUPPLIER_NAME], default_unit_price: 35000, unit: "bottle", user_id: userId },
  ]).select("id, name, category_id, sub_category_id, default_supplier_id, default_unit_price");
  if (!itemsData) return;
  const itemMap = Object.fromEntries(itemsData.map(i => [i.name, i]));

  // Seed sample purchases for past 7 days (~20 items per day
  const today = new Date();
  const pastDays = [
    { offset: 1, purchases: [
      { item: "Morning Glory", qty: 3, amount: 45000 },
      { item: "Chicken Breast", qty: 2, amount: 170000 },
      { item: "Eggs", qty: 30, amount: 105000 },
      { item: "Cooking Oil", qty: 1, amount: 45000 },
      { item: "Thai Basil", qty: 0.5, amount: 12500 },
      { item: "Onions", qty: 2, amount: 20000 },
      { item: "Garlic", qty: 0.5, amount: 20000 },
      { item: "Rice", qty: 5, amount: 80000 },
      { item: "Fish Sauce", qty: 1, amount: 22000 },
      { item: "Tomatoes", qty: 1.5, amount: 33000 },
      { item: "Bean Sprouts", qty: 1, amount: 8000 },
      { item: "Chili Peppers", qty: 0.3, amount: 9000 },
      { item: "Lemongrass", qty: 0.5, amount: 10000 },
      { item: "Coconut Milk", qty: 3, amount: 54000 },
      { item: "Sugar", qty: 1, amount: 15000 },
      { item: "Ginger", qty: 0.3, amount: 10500 },
      { item: "Soy Sauce", qty: 1, amount: 18000 },
      { item: "Noodles", qty: 3, amount: 36000 },
      { item: "Ground Pork", qty: 1, amount: 95000 },
      { item: "Potatoes", qty: 2, amount: 28000 },
    ]},
    { offset: 2, purchases: [
      { item: "Tiger Prawns", qty: 1.5, amount: 420000 },
      { item: "Pork Belly", qty: 2, amount: 240000 },
      { item: "Bok Choy", qty: 2, amount: 24000 },
      { item: "Dish Soap", qty: 2, amount: 70000 },
      { item: "Garlic", qty: 1, amount: 40000 },
      { item: "Onions", qty: 3, amount: 30000 },
      { item: "Eggs", qty: 30, amount: 105000 },
      { item: "Rice", qty: 5, amount: 80000 },
      { item: "Cooking Oil", qty: 1, amount: 45000 },
      { item: "Chili Peppers", qty: 0.5, amount: 15000 },
      { item: "Fish Sauce", qty: 1, amount: 22000 },
      { item: "Squid", qty: 1, amount: 150000 },
      { item: "Tomatoes", qty: 2, amount: 44000 },
      { item: "Butter", qty: 1, amount: 65000 },
      { item: "Lemongrass", qty: 0.5, amount: 10000 },
      { item: "Ginger", qty: 0.5, amount: 17500 },
      { item: "Thai Basil", qty: 0.5, amount: 12500 },
      { item: "Sugar", qty: 1, amount: 15000 },
      { item: "Noodles", qty: 2, amount: 24000 },
      { item: "Chicken Thigh", qty: 2, amount: 150000 },
    ]},
    { offset: 3, purchases: [
      { item: "Carrots", qty: 5, amount: 90000 },
      { item: "Chicken Breast", qty: 3, amount: 255000 },
      { item: "Morning Glory", qty: 2, amount: 30000 },
      { item: "Fish Fillet", qty: 1.5, amount: 270000 },
      { item: "Garlic", qty: 0.5, amount: 20000 },
      { item: "Onions", qty: 2, amount: 20000 },
      { item: "Eggs", qty: 20, amount: 70000 },
      { item: "Rice", qty: 5, amount: 80000 },
      { item: "Soy Sauce", qty: 2, amount: 36000 },
      { item: "Coconut Milk", qty: 2, amount: 36000 },
      { item: "Bean Sprouts", qty: 1, amount: 8000 },
      { item: "Ground Pork", qty: 1.5, amount: 142500 },
      { item: "Potatoes", qty: 3, amount: 42000 },
      { item: "Tomatoes", qty: 1, amount: 22000 },
      { item: "Chili Peppers", qty: 0.3, amount: 9000 },
      { item: "Cooking Oil", qty: 1, amount: 45000 },
      { item: "Ginger", qty: 0.3, amount: 10500 },
      { item: "Beef Sirloin", qty: 1, amount: 250000 },
      { item: "Noodles", qty: 2, amount: 24000 },
      { item: "Sugar", qty: 0.5, amount: 7500 },
    ]},
    { offset: 4, purchases: [
      { item: "Chicken Thigh", qty: 3, amount: 225000 },
      { item: "Pork Belly", qty: 1.5, amount: 180000 },
      { item: "Morning Glory", qty: 2, amount: 30000 },
      { item: "Bok Choy", qty: 1.5, amount: 18000 },
      { item: "Eggs", qty: 30, amount: 105000 },
      { item: "Rice", qty: 5, amount: 80000 },
      { item: "Garlic", qty: 1, amount: 40000 },
      { item: "Onions", qty: 2, amount: 20000 },
      { item: "Fish Sauce", qty: 1, amount: 22000 },
      { item: "Cooking Oil", qty: 1, amount: 45000 },
      { item: "Squid", qty: 1, amount: 150000 },
      { item: "Lemongrass", qty: 0.5, amount: 10000 },
      { item: "Bean Sprouts", qty: 1, amount: 8000 },
      { item: "Chili Peppers", qty: 0.5, amount: 15000 },
      { item: "Tomatoes", qty: 1, amount: 22000 },
      { item: "Coconut Milk", qty: 2, amount: 36000 },
      { item: "Butter", qty: 1, amount: 65000 },
      { item: "Carrots", qty: 2, amount: 36000 },
      { item: "Noodles", qty: 3, amount: 36000 },
      { item: "Thai Basil", qty: 0.5, amount: 12500 },
    ]},
    { offset: 5, purchases: [
      { item: "Tiger Prawns", qty: 1, amount: 280000 },
      { item: "Chicken Breast", qty: 2, amount: 170000 },
      { item: "Garlic", qty: 0.5, amount: 20000 },
      { item: "Onions", qty: 2, amount: 20000 },
      { item: "Ginger", qty: 0.5, amount: 17500 },
      { item: "Eggs", qty: 20, amount: 70000 },
      { item: "Rice", qty: 5, amount: 80000 },
      { item: "Cooking Oil", qty: 1, amount: 45000 },
      { item: "Fish Sauce", qty: 1, amount: 22000 },
      { item: "Soy Sauce", qty: 1, amount: 18000 },
      { item: "Fish Fillet", qty: 1, amount: 180000 },
      { item: "Morning Glory", qty: 2, amount: 30000 },
      { item: "Potatoes", qty: 2, amount: 28000 },
      { item: "Tomatoes", qty: 1, amount: 22000 },
      { item: "Chili Peppers", qty: 0.3, amount: 9000 },
      { item: "Bean Sprouts", qty: 1, amount: 8000 },
      { item: "Lemongrass", qty: 0.5, amount: 10000 },
      { item: "Ground Pork", qty: 1, amount: 95000 },
      { item: "Sugar", qty: 1, amount: 15000 },
      { item: "Dish Soap", qty: 1, amount: 35000 },
    ]},
    { offset: 6, purchases: [
      { item: "Beef Sirloin", qty: 1.5, amount: 375000 },
      { item: "Pork Belly", qty: 1, amount: 120000 },
      { item: "Bok Choy", qty: 2, amount: 24000 },
      { item: "Carrots", qty: 3, amount: 54000 },
      { item: "Garlic", qty: 0.5, amount: 20000 },
      { item: "Onions", qty: 2, amount: 20000 },
      { item: "Eggs", qty: 30, amount: 105000 },
      { item: "Rice", qty: 5, amount: 80000 },
      { item: "Coconut Milk", qty: 3, amount: 54000 },
      { item: "Noodles", qty: 2, amount: 24000 },
      { item: "Thai Basil", qty: 0.5, amount: 12500 },
      { item: "Ginger", qty: 0.3, amount: 10500 },
      { item: "Chili Peppers", qty: 0.5, amount: 15000 },
      { item: "Tomatoes", qty: 1.5, amount: 33000 },
      { item: "Cooking Oil", qty: 1, amount: 45000 },
      { item: "Fish Sauce", qty: 1, amount: 22000 },
      { item: "Squid", qty: 1, amount: 150000 },
      { item: "Chicken Thigh", qty: 2, amount: 150000 },
      { item: "Sugar", qty: 1, amount: 15000 },
      { item: "Butter", qty: 1, amount: 65000 },
    ]},
    { offset: 7, purchases: [
      { item: "Chicken Breast", qty: 3, amount: 255000 },
      { item: "Tiger Prawns", qty: 1, amount: 280000 },
      { item: "Morning Glory", qty: 3, amount: 45000 },
      { item: "Garlic", qty: 1, amount: 40000 },
      { item: "Onions", qty: 3, amount: 30000 },
      { item: "Eggs", qty: 30, amount: 105000 },
      { item: "Rice", qty: 10, amount: 160000 },
      { item: "Cooking Oil", qty: 2, amount: 90000 },
      { item: "Fish Sauce", qty: 2, amount: 44000 },
      { item: "Soy Sauce", qty: 1, amount: 18000 },
      { item: "Potatoes", qty: 3, amount: 42000 },
      { item: "Tomatoes", qty: 2, amount: 44000 },
      { item: "Chili Peppers", qty: 0.5, amount: 15000 },
      { item: "Ground Pork", qty: 2, amount: 190000 },
      { item: "Fish Fillet", qty: 1, amount: 180000 },
      { item: "Bean Sprouts", qty: 1, amount: 8000 },
      { item: "Lemongrass", qty: 0.5, amount: 10000 },
      { item: "Ginger", qty: 0.5, amount: 17500 },
      { item: "Noodles", qty: 3, amount: 36000 },
      { item: "Coconut Milk", qty: 2, amount: 36000 },
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
      supplier_id: supMap[SEED_SUPPLIER_NAME],
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
