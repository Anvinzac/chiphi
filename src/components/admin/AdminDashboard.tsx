import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, ChevronDown, ChevronRight, Users, Tag, BarChart3, CalendarIcon, X } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, isWithinInterval } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

type AdminTab = "summary" | "categories" | "suppliers" | "items";
type CategoryFrequency = "daily" | "weekly" | "monthly";

const CHART_COLORS = [
  "hsl(20, 50%, 53%)",
  "hsl(140, 18%, 67%)",
  "hsl(32, 40%, 71%)",
  "hsl(25, 12%, 45%)",
  "hsl(200, 25%, 60%)",
];

interface DbCategory { id: string; name: string; frequency: CategoryFrequency }
interface DbSubCategory { id: string; name: string; category_id: string; parent_sub_category_id: string | null }
interface DbSupplier { id: string; name: string; contact: string | null }
interface DbItem { id: string; name: string; category_id: string | null; default_supplier_id: string | null; default_unit_price: number | null; unit: string | null }
interface DbPayment { id: string; date: string; total_amount: number; sub_payments: { item_name: string; amount: number; category_id: string | null }[] }

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("summary");
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [subCategories, setSubCategories] = useState<DbSubCategory[]>([]);
  const [suppliers, setSuppliers] = useState<DbSupplier[]>([]);
  const [items, setItems] = useState<DbItem[]>([]);
  const [payments, setPayments] = useState<DbPayment[]>([]);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [newCatName, setNewCatName] = useState("");
  const [addingSubTo, setAddingSubTo] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [newSupName, setNewSupName] = useState("");
  const [newSupContact, setNewSupContact] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemCat, setNewItemCat] = useState("");
  const [newItemSupplier, setNewItemSupplier] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("kg");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [c, sc, s, i, p] = await Promise.all([
        supabase.from("categories").select("id, name, frequency").eq("user_id", user.id),
        supabase.from("sub_categories").select("id, name, category_id, parent_sub_category_id").eq("user_id", user.id),
        supabase.from("suppliers").select("id, name, contact").eq("user_id", user.id),
        supabase.from("items").select("id, name, category_id, default_supplier_id, default_unit_price, unit").eq("user_id", user.id),
        supabase.from("payments").select("id, date, total_amount, sub_payments(item_name, amount, category_id)").eq("user_id", user.id),
      ]);
      if (c.data) setCategories(c.data);
      if (sc.data) setSubCategories(sc.data);
      if (s.data) setSuppliers(s.data);
      if (i.data) setItems(i.data);
      if (p.data) setPayments(p.data as any);
    };
    load();
  }, [user]);

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: "summary", label: "Summary", icon: <BarChart3 className="h-4 w-4" /> },
    { key: "categories", label: "Categories", icon: <Tag className="h-4 w-4" /> },
    { key: "suppliers", label: "Suppliers", icon: <Users className="h-4 w-4" /> },
    { key: "items", label: "Items", icon: <Tag className="h-4 w-4" /> },
  ];

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const monthInterval = { start: startOfMonth(today), end: endOfMonth(today) };
  const yearInterval = { start: startOfYear(today), end: endOfYear(today) };

  const filteredPayments = useMemo(() => {
    if (!dateRange?.from && !dateRange?.to) return payments;
    const from = dateRange.from;
    const to = dateRange.to || dateRange.from;
    return payments.filter(p => {
      try { return isWithinInterval(parseISO(p.date), { start: from!, end: to! }); } catch { return false; }
    });
  }, [payments, dateRange]);

  const rangeTotal = useMemo(() => filteredPayments.reduce((s, p) => s + Number(p.total_amount), 0), [filteredPayments]);

  const dailyTotal = useMemo(() => filteredPayments.filter(p => p.date === todayStr).reduce((s, p) => s + Number(p.total_amount), 0), [filteredPayments, todayStr]);
  const monthlyTotal = useMemo(() => filteredPayments.filter(p => { try { return isWithinInterval(parseISO(p.date), monthInterval); } catch { return false; } }).reduce((s, p) => s + Number(p.total_amount), 0), [filteredPayments]);
  const yearlyTotal = useMemo(() => filteredPayments.filter(p => { try { return isWithinInterval(parseISO(p.date), yearInterval); } catch { return false; } }).reduce((s, p) => s + Number(p.total_amount), 0), [filteredPayments]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filteredPayments.forEach(p => {
      (p.sub_payments || []).forEach((sp: any) => {
        const cat = categories.find(c => c.id === sp.category_id);
        const name = cat?.name ?? "Uncategorized";
        map.set(name, (map.get(name) ?? 0) + Number(sp.amount));
      });
    });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [filteredPayments, categories]);

  const monthlyTrend = useMemo(() => {
    const months: { month: string; total: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const mStart = new Date(today.getFullYear(), m, 1);
      const mEnd = endOfMonth(mStart);
      const total = filteredPayments.filter(p => { try { return isWithinInterval(parseISO(p.date), { start: mStart, end: mEnd }); } catch { return false; } }).reduce((s, p) => s + Number(p.total_amount), 0);
      months.push({ month: format(mStart, "MMM"), total });
    }
    return months;
  }, [filteredPayments, today]);

  // CRUD helpers
  const addCategory = async () => {
    if (!newCatName.trim() || !user) return;
    const { data, error } = await supabase.from("categories").insert({ name: newCatName.trim(), user_id: user.id, frequency: "daily" }).select("id, name, frequency").single();
    if (error) { toast.error(error.message); return; }
    if (data) setCategories(prev => [...prev, data]);
    setNewCatName("");
  };

  const updateCategoryFrequency = async (id: string, frequency: CategoryFrequency) => {
    const { error } = await supabase.from("categories").update({ frequency }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCategories(prev => prev.map(category => category.id === id ? { ...category, frequency } : category));
  };

  const deleteCategory = async (id: string) => {
    await supabase.from("categories").delete().eq("id", id);
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  const addSubCategory = async (categoryId: string, parentId?: string) => {
    if (!newSubName.trim() || !user) return;
    const { data, error } = await supabase.from("sub_categories").insert({
      name: newSubName.trim(), category_id: categoryId,
      parent_sub_category_id: parentId || null, user_id: user.id,
    }).select("id, name, category_id, parent_sub_category_id").single();
    if (error) { toast.error(error.message); return; }
    if (data) setSubCategories(prev => [...prev, data]);
    setNewSubName(""); setAddingSubTo(null);
  };

  const deleteSubCategory = async (id: string) => {
    await supabase.from("sub_categories").delete().eq("id", id);
    setSubCategories(prev => prev.filter(s => s.id !== id));
  };

  const addSupplier = async () => {
    if (!newSupName.trim() || !user) return;
    const { data, error } = await supabase.from("suppliers").insert({ name: newSupName.trim(), contact: newSupContact || null, user_id: user.id }).select("id, name, contact").single();
    if (error) { toast.error(error.message); return; }
    if (data) setSuppliers(prev => [...prev, data]);
    setNewSupName(""); setNewSupContact("");
  };

  const deleteSupplier = async (id: string) => {
    await supabase.from("suppliers").delete().eq("id", id);
    setSuppliers(prev => prev.filter(s => s.id !== id));
  };

  const addItem = async () => {
    if (!newItemName.trim() || !user) return;
    const { data, error } = await supabase.from("items").insert({
      name: newItemName.trim(), category_id: newItemCat || null,
      default_supplier_id: newItemSupplier || null,
      default_unit_price: Number(newItemPrice) || null,
      unit: newItemUnit || "unit", user_id: user.id,
    }).select("id, name, category_id, default_supplier_id, default_unit_price, unit").single();
    if (error) { toast.error(error.message); return; }
    if (data) setItems(prev => [...prev, data]);
    setNewItemName(""); setNewItemPrice("");
  };

  const deleteItem = async (id: string) => {
    await supabase.from("items").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const getLevel1Subs = (catId: string) => subCategories.filter(s => s.category_id === catId && !s.parent_sub_category_id);
  const getLevel2Subs = (subId: string) => subCategories.filter(s => s.parent_sub_category_id === subId);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg overflow-x-auto" role="tablist">
        {tabs.map(({ key, label, icon }) => (
          <button key={key} role="tab" aria-selected={activeTab === key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === key ? "bg-card text-foreground shadow-warm" : "text-muted-foreground hover:text-foreground"}`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {activeTab === "summary" && (
        <div className="space-y-4">
          {/* Date Range Picker */}
          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>{format(dateRange.from, "MMM d, y")} – {format(dateRange.to, "MMM d, y")}</>
                    ) : (
                      format(dateRange.from, "MMM d, y")
                    )
                  ) : (
                    "Pick a date range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            {dateRange && (
              <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => setDateRange(undefined)}>
                <X className="h-3 w-3 mr-1" />Clear
              </Button>
            )}
          </div>

          {/* Range Total (only shown when filter is active) */}
          {dateRange && (
            <div className="card-editorial p-4 border-primary/30 bg-primary/5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {dateRange.to
                  ? `${format(dateRange.from!, "MMM d")} – ${format(dateRange.to, "MMM d, y")}`
                  : format(dateRange.from!, "MMM d, y")}
              </p>
              <p className="text-2xl font-display mt-1">{rangeTotal.toLocaleString()}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[{ label: "Today", value: dailyTotal }, { label: "This Month", value: monthlyTotal }, { label: "This Year", value: yearlyTotal }].map(({ label, value }) => (
              <div key={label} className="card-editorial p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-display mt-1">{value.toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-editorial p-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Monthly Trend</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(30,15%,88%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(25,8%,45%)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(25,8%,45%)" />
                  <Tooltip contentStyle={{ background: "hsl(30,25%,98%)", border: "1px solid hsl(30,15%,85%)", borderRadius: "8px" }} />
                  <Bar dataKey="total" fill="hsl(20,50%,53%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card-editorial p-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">By Category</h3>
              {categoryBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart><Pie data={categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>{categoryBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              ) : <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === "categories" && (
        <div className="space-y-3">
          <div className="card-editorial p-3 flex gap-2">
            <Input placeholder="New category..." value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} className="flex-1" />
            <Button onClick={addCategory} disabled={!newCatName.trim()} size="sm"><Plus className="h-4 w-4" /></Button>
          </div>
          {categories.map(cat => {
            const expanded = expandedCats.has(cat.id);
            const subs = getLevel1Subs(cat.id);
            return (
              <div key={cat.id} className="card-editorial overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <button onClick={() => setExpandedCats(prev => { const n = new Set(prev); n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id); return n; })} className="flex items-center gap-2 text-sm font-medium flex-1 text-left">
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}{cat.name}
                  </button>
                  <div className="flex items-center gap-1 text-xs">
                    {(["daily", "weekly", "monthly"] as CategoryFrequency[]).map(freq => {
                      const labels: Record<CategoryFrequency, string> = { daily: "D", weekly: "W", monthly: "M" };
                      return (
                        <button
                          key={freq}
                          type="button"
                          onClick={() => cat.frequency !== freq && updateCategoryFrequency(cat.id, freq)}
                          aria-pressed={cat.frequency === freq}
                          className={`h-7 px-2 rounded-md border text-xs font-medium transition-all ${
                            cat.frequency === freq
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border/60 bg-muted/50 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {labels[freq]}
                        </button>
                      );
                    })}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteCategory(cat.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
                {expanded && (
                  <div className="border-t border-border pl-8 pr-4 py-2 space-y-1">
                    {subs.map(sub => {
                      const l2 = getLevel2Subs(sub.id);
                      return (
                        <div key={sub.id}>
                          <div className="flex items-center justify-between py-1 text-sm">
                            <span>{sub.name}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteSubCategory(sub.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                          {l2.map(ss => (
                            <div key={ss.id} className="flex items-center justify-between py-0.5 text-sm text-muted-foreground pl-4">
                              <span>{ss.name}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteSubCategory(ss.id)}><Trash2 className="h-2.5 w-2.5" /></Button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {addingSubTo === cat.id ? (
                      <div className="flex gap-2 py-1">
                        <Input autoFocus className="h-7 text-sm" placeholder="Sub-category..." value={newSubName} onChange={(e) => setNewSubName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") addSubCategory(cat.id); }} />
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setAddingSubTo(cat.id)}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "suppliers" && (
        <div className="space-y-3">
          <div className="card-editorial p-3 flex gap-2">
            <Input placeholder="Name..." value={newSupName} onChange={(e) => setNewSupName(e.target.value)} className="flex-1" />
            <Input placeholder="Contact..." value={newSupContact} onChange={(e) => setNewSupContact(e.target.value)} className="w-32" />
            <Button onClick={addSupplier} disabled={!newSupName.trim()} size="sm"><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="card-editorial overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-muted-foreground uppercase border-b border-border"><th className="text-left px-4 py-2 font-medium">Name</th><th className="text-left px-4 py-2 font-medium">Contact</th><th className="w-10"></th></tr></thead>
              <tbody>{suppliers.map(s => (
                <tr key={s.id} className="border-b border-border/40"><td className="px-4 py-2">{s.name}</td><td className="px-4 py-2 text-muted-foreground">{s.contact || "—"}</td><td className="px-2 py-2"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteSupplier(s.id)}><Trash2 className="h-3 w-3" /></Button></td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "items" && (
        <div className="space-y-3">
          <div className="card-editorial p-3 space-y-2">
            <div className="flex gap-2 flex-wrap">
              <Input placeholder="Item name..." value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="flex-1 min-w-[120px]" />
              <select value={newItemCat} onChange={(e) => setNewItemCat(e.target.value)} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                <option value="">Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={newItemSupplier} onChange={(e) => setNewItemSupplier(e.target.value)} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                <option value="">Supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Input type="number" placeholder="Price" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} className="w-20" />
              <Input placeholder="Unit" value={newItemUnit} onChange={(e) => setNewItemUnit(e.target.value)} className="w-16" />
              <Button onClick={addItem} disabled={!newItemName.trim()} size="sm"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="card-editorial overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-muted-foreground uppercase border-b border-border"><th className="text-left px-4 py-2 font-medium">Name</th><th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Category</th><th className="text-right px-4 py-2 font-medium">Price</th><th className="w-10"></th></tr></thead>
              <tbody>{items.map(item => {
                const cat = categories.find(c => c.id === item.category_id);
                return (
                  <tr key={item.id} className="border-b border-border/40"><td className="px-4 py-2">{item.name}</td><td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{cat?.name ?? "—"}</td><td className="px-4 py-2 text-right">{item.default_unit_price?.toLocaleString() ?? "—"}/{item.unit}</td><td className="px-2 py-2"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteItem(item.id)}><Trash2 className="h-3 w-3" /></Button></td></tr>
                );
              })}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
