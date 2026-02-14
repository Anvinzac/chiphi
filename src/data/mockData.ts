import type { Category, SubCategory, Supplier, Item, Payment } from "@/types/expense";

export const defaultCategories: Category[] = [
  { id: "cat-1", name: "Food & Ingredients" },
  { id: "cat-2", name: "Kitchen Supplies" },
  { id: "cat-3", name: "Operations" },
  { id: "cat-4", name: "Beverages" },
];

export const defaultSubCategories: SubCategory[] = [
  // Food & Ingredients - Level 1
  { id: "sub-1", name: "Vegetables", categoryId: "cat-1" },
  { id: "sub-2", name: "Meat & Seafood", categoryId: "cat-1" },
  { id: "sub-3", name: "Dairy & Eggs", categoryId: "cat-1" },
  { id: "sub-4", name: "Dry Goods & Spices", categoryId: "cat-1" },
  // Vegetables - Level 2
  { id: "sub-1-1", name: "Leafy Greens", categoryId: "cat-1", parentSubCategoryId: "sub-1" },
  { id: "sub-1-2", name: "Root Vegetables", categoryId: "cat-1", parentSubCategoryId: "sub-1" },
  { id: "sub-1-3", name: "Herbs & Aromatics", categoryId: "cat-1", parentSubCategoryId: "sub-1" },
  // Meat & Seafood - Level 2
  { id: "sub-2-1", name: "Poultry", categoryId: "cat-1", parentSubCategoryId: "sub-2" },
  { id: "sub-2-2", name: "Beef & Pork", categoryId: "cat-1", parentSubCategoryId: "sub-2" },
  { id: "sub-2-3", name: "Seafood", categoryId: "cat-1", parentSubCategoryId: "sub-2" },
  // Kitchen Supplies - Level 1
  { id: "sub-5", name: "Equipment", categoryId: "cat-2" },
  { id: "sub-6", name: "Disposables", categoryId: "cat-2" },
  { id: "sub-7", name: "Cleaning", categoryId: "cat-2" },
  // Operations - Level 1
  { id: "sub-8", name: "Utilities", categoryId: "cat-3" },
  { id: "sub-9", name: "Maintenance", categoryId: "cat-3" },
  // Beverages - Level 1
  { id: "sub-10", name: "Alcoholic", categoryId: "cat-4" },
  { id: "sub-11", name: "Non-Alcoholic", categoryId: "cat-4" },
];

export const defaultSuppliers: Supplier[] = [
  { id: "sup-1", name: "Farm Fresh Co.", contact: "0901234567" },
  { id: "sup-2", name: "Green Valley Market", contact: "0907654321" },
  { id: "sup-3", name: "Ocean Catch Seafood", contact: "0909876543" },
  { id: "sup-4", name: "Metro Wholesale", contact: "0903456789" },
  { id: "sup-5", name: "Local Herb Garden", contact: "0905678901" },
];

export const defaultItems: Item[] = [
  { id: "item-1", name: "Morning Glory", categoryId: "cat-1", subCategoryId: "sub-1", subSubCategoryId: "sub-1-1", defaultSupplierId: "sup-1", defaultUnitPrice: 15000, unit: "kg" },
  { id: "item-2", name: "Bok Choy", categoryId: "cat-1", subCategoryId: "sub-1", subSubCategoryId: "sub-1-1", defaultSupplierId: "sup-2", defaultUnitPrice: 12000, unit: "kg" },
  { id: "item-3", name: "Carrots", categoryId: "cat-1", subCategoryId: "sub-1", subSubCategoryId: "sub-1-2", defaultSupplierId: "sup-1", defaultUnitPrice: 18000, unit: "kg" },
  { id: "item-4", name: "Chicken Breast", categoryId: "cat-1", subCategoryId: "sub-2", subSubCategoryId: "sub-2-1", defaultSupplierId: "sup-4", defaultUnitPrice: 85000, unit: "kg" },
  { id: "item-5", name: "Pork Belly", categoryId: "cat-1", subCategoryId: "sub-2", subSubCategoryId: "sub-2-2", defaultSupplierId: "sup-4", defaultUnitPrice: 120000, unit: "kg" },
  { id: "item-6", name: "Tiger Prawns", categoryId: "cat-1", subCategoryId: "sub-2", subSubCategoryId: "sub-2-3", defaultSupplierId: "sup-3", defaultUnitPrice: 280000, unit: "kg" },
  { id: "item-7", name: "Thai Basil", categoryId: "cat-1", subCategoryId: "sub-1", subSubCategoryId: "sub-1-3", defaultSupplierId: "sup-5", defaultUnitPrice: 25000, unit: "kg" },
  { id: "item-8", name: "Eggs", categoryId: "cat-1", subCategoryId: "sub-3", defaultSupplierId: "sup-4", defaultUnitPrice: 3500, unit: "piece" },
  { id: "item-9", name: "Cooking Oil", categoryId: "cat-1", subCategoryId: "sub-4", defaultSupplierId: "sup-4", defaultUnitPrice: 45000, unit: "liter" },
  { id: "item-10", name: "Dish Soap", categoryId: "cat-2", subCategoryId: "sub-7", defaultSupplierId: "sup-4", defaultUnitPrice: 35000, unit: "bottle" },
];

export const defaultPayments: Payment[] = [];
