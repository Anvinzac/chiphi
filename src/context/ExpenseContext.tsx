import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Category, SubCategory, Supplier, Item, Payment, SubPayment } from "@/types/expense";
import { defaultCategories, defaultSubCategories, defaultSuppliers, defaultItems, defaultPayments } from "@/data/mockData";

interface ExpenseStore {
  categories: Category[];
  subCategories: SubCategory[];
  suppliers: Supplier[];
  items: Item[];
  payments: Payment[];
  // Actions
  addPayment: (payment: Payment) => void;
  updatePayment: (id: string, updates: Partial<Payment>) => void;
  deletePayment: (id: string) => void;
  addSubPayment: (paymentId: string, sub: SubPayment) => void;
  addCategory: (cat: Category) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  addSubCategory: (sub: SubCategory) => void;
  updateSubCategory: (id: string, updates: Partial<SubCategory>) => void;
  deleteSubCategory: (id: string) => void;
  addSupplier: (sup: Supplier) => void;
  updateSupplier: (id: string, updates: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
  addItem: (item: Item) => void;
  updateItem: (id: string, updates: Partial<Item>) => void;
  deleteItem: (id: string) => void;
  findItemByName: (name: string) => Item | undefined;
  getPaymentsByDate: (date: string) => Payment[];
}

const ExpenseContext = createContext<ExpenseStore | null>(null);

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>(() => loadFromStorage("mise-categories", defaultCategories));
  const [subCategories, setSubCategories] = useState<SubCategory[]>(() => loadFromStorage("mise-subcategories", defaultSubCategories));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadFromStorage("mise-suppliers", defaultSuppliers));
  const [items, setItems] = useState<Item[]>(() => loadFromStorage("mise-items", defaultItems));
  const [payments, setPayments] = useState<Payment[]>(() => loadFromStorage("mise-payments", defaultPayments));

  useEffect(() => { localStorage.setItem("mise-categories", JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem("mise-subcategories", JSON.stringify(subCategories)); }, [subCategories]);
  useEffect(() => { localStorage.setItem("mise-suppliers", JSON.stringify(suppliers)); }, [suppliers]);
  useEffect(() => { localStorage.setItem("mise-items", JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem("mise-payments", JSON.stringify(payments)); }, [payments]);

  const addPayment = useCallback((p: Payment) => setPayments(prev => [...prev, p]), []);
  const updatePayment = useCallback((id: string, updates: Partial<Payment>) =>
    setPayments(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p)), []);
  const deletePayment = useCallback((id: string) => setPayments(prev => prev.filter(p => p.id !== id)), []);
  const addSubPayment = useCallback((paymentId: string, sub: SubPayment) =>
    setPayments(prev => prev.map(p => p.id === paymentId
      ? { ...p, subPayments: [...p.subPayments, sub], totalAmount: p.totalAmount + sub.amount }
      : p)), []);

  const addCategory = useCallback((c: Category) => setCategories(prev => [...prev, c]), []);
  const updateCategory = useCallback((id: string, u: Partial<Category>) =>
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...u } : c)), []);
  const deleteCategory = useCallback((id: string) => setCategories(prev => prev.filter(c => c.id !== id)), []);

  const addSubCategory = useCallback((s: SubCategory) => setSubCategories(prev => [...prev, s]), []);
  const updateSubCategory = useCallback((id: string, u: Partial<SubCategory>) =>
    setSubCategories(prev => prev.map(s => s.id === id ? { ...s, ...u } : s)), []);
  const deleteSubCategory = useCallback((id: string) => setSubCategories(prev => prev.filter(s => s.id !== id)), []);

  const addSupplier = useCallback((s: Supplier) => setSuppliers(prev => [...prev, s]), []);
  const updateSupplier = useCallback((id: string, u: Partial<Supplier>) =>
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...u } : s)), []);
  const deleteSupplier = useCallback((id: string) => setSuppliers(prev => prev.filter(s => s.id !== id)), []);

  const addItem = useCallback((i: Item) => setItems(prev => [...prev, i]), []);
  const updateItem = useCallback((id: string, u: Partial<Item>) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...u } : i)), []);
  const deleteItem = useCallback((id: string) => setItems(prev => prev.filter(i => i.id !== id)), []);

  const findItemByName = useCallback((name: string) => {
    const lower = name.toLowerCase().trim();
    return items.find(i => i.name.toLowerCase() === lower) ||
      items.find(i => i.name.toLowerCase().includes(lower));
  }, [items]);

  const getPaymentsByDate = useCallback((date: string) =>
    payments.filter(p => p.date === date), [payments]);

  const store: ExpenseStore = {
    categories, subCategories, suppliers, items, payments,
    addPayment, updatePayment, deletePayment, addSubPayment,
    addCategory, updateCategory, deleteCategory,
    addSubCategory, updateSubCategory, deleteSubCategory,
    addSupplier, updateSupplier, deleteSupplier,
    addItem, updateItem, deleteItem,
    findItemByName, getPaymentsByDate,
  };

  return <ExpenseContext.Provider value={store}>{children}</ExpenseContext.Provider>;
}

export function useExpenseStore() {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error("useExpenseStore must be used within ExpenseProvider");
  return ctx;
}
