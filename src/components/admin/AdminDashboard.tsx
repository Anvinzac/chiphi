import { useState, useMemo } from "react";
import { useExpenseStore } from "@/context/ExpenseContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Users, Tag, BarChart3 } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, eachMonthOfInterval, parseISO, isWithinInterval } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import type { Category, SubCategory, Supplier, Item } from "@/types/expense";

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type AdminTab = "categories" | "suppliers" | "items" | "summary";

const CHART_COLORS = [
  "hsl(20, 50%, 53%)",   // primary/terracotta
  "hsl(140, 18%, 67%)",  // secondary/sage
  "hsl(32, 40%, 71%)",   // accent/gold
  "hsl(25, 12%, 45%)",   // muted brown
  "hsl(200, 25%, 60%)",  // soft blue
];

export default function AdminDashboard() {
  const store = useExpenseStore();
  const [activeTab, setActiveTab] = useState<AdminTab>("summary");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Category management
  const [newCatName, setNewCatName] = useState("");
  const [newSubName, setNewSubName] = useState("");
  const [addingSubTo, setAddingSubTo] = useState<string | null>(null);
  const [newSubSubName, setNewSubSubName] = useState("");
  const [addingSubSubTo, setAddingSubSubTo] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");

  // Supplier management
  const [newSupName, setNewSupName] = useState("");
  const [newSupContact, setNewSupContact] = useState("");

  // Item management
  const [newItemName, setNewItemName] = useState("");
  const [newItemCat, setNewItemCat] = useState("");
  const [newItemSub, setNewItemSub] = useState("");
  const [newItemSupplier, setNewItemSupplier] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("kg");

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: "summary", label: "Summary", icon: <BarChart3 className="h-4 w-4" /> },
    { key: "categories", label: "Categories", icon: <Tag className="h-4 w-4" /> },
    { key: "suppliers", label: "Suppliers", icon: <Users className="h-4 w-4" /> },
    { key: "items", label: "Items", icon: <Tag className="h-4 w-4" /> },
  ];

  // Summary data
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const dailyTotal = useMemo(() =>
    store.payments.filter(p => p.date === todayStr).reduce((s, p) => s + p.totalAmount, 0),
    [store.payments, todayStr]
  );

  const monthInterval = { start: startOfMonth(today), end: endOfMonth(today) };
  const monthlyTotal = useMemo(() =>
    store.payments.filter(p => {
      const d = parseISO(p.date);
      return isWithinInterval(d, monthInterval);
    }).reduce((s, p) => s + p.totalAmount, 0),
    [store.payments]
  );

  const yearInterval = { start: startOfYear(today), end: endOfYear(today) };
  const yearlyTotal = useMemo(() =>
    store.payments.filter(p => {
      const d = parseISO(p.date);
      return isWithinInterval(d, yearInterval);
    }).reduce((s, p) => s + p.totalAmount, 0),
    [store.payments]
  );

  // Category breakdown for pie chart
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    store.payments.forEach(p => {
      p.subPayments.forEach(sp => {
        const cat = store.categories.find(c => c.id === sp.categoryId);
        const name = cat?.name ?? "Uncategorized";
        map.set(name, (map.get(name) ?? 0) + sp.amount);
      });
    });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [store.payments, store.categories]);

  // Monthly trend
  const monthlyTrend = useMemo(() => {
    const months = eachMonthOfInterval(yearInterval);
    return months.map(m => {
      const mStart = startOfMonth(m);
      const mEnd = endOfMonth(m);
      const total = store.payments
        .filter(p => {
          const d = parseISO(p.date);
          return isWithinInterval(d, { start: mStart, end: mEnd });
        })
        .reduce((s, p) => s + p.totalAmount, 0);
      return { month: format(m, "MMM"), total };
    });
  }, [store.payments]);

  const getLevel1Subs = (catId: string) => store.subCategories.filter(s => s.categoryId === catId && !s.parentSubCategoryId);
  const getLevel2Subs = (subId: string) => store.subCategories.filter(s => s.parentSubCategoryId === subId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage categories, suppliers, and view summaries</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit" role="tablist">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === key
                ? "bg-card text-foreground shadow-warm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Summary Tab */}
      {activeTab === "summary" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Today", value: dailyTotal },
              { label: "This Month", value: monthlyTotal },
              { label: "This Year", value: yearlyTotal },
            ].map(({ label, value }) => (
              <div key={label} className="card-editorial p-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className="text-3xl font-display mt-2">{value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card-editorial p-6">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">Monthly Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(30, 15%, 88%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(25, 8%, 45%)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(25, 8%, 45%)" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(30, 25%, 98%)",
                      border: "1px solid hsl(30, 15%, 85%)",
                      borderRadius: "8px",
                      boxShadow: "var(--shadow-warm)",
                    }}
                  />
                  <Bar dataKey="total" fill="hsl(20, 50%, 53%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card-editorial p-6">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">By Category</h3>
              {categoryBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {categoryBreakdown.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                  Add expenses to see category breakdown
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          {/* Add Category */}
          <div className="card-editorial p-4 flex gap-3">
            <Input
              placeholder="New category name..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCatName.trim()) {
                  store.addCategory({ id: generateId(), name: newCatName.trim() });
                  setNewCatName("");
                }
              }}
              aria-label="New category name"
            />
            <Button
              onClick={() => {
                if (newCatName.trim()) {
                  store.addCategory({ id: generateId(), name: newCatName.trim() });
                  setNewCatName("");
                }
              }}
              disabled={!newCatName.trim()}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          {/* Category Tree */}
          {store.categories.map(cat => {
            const expanded = expandedCats.has(cat.id);
            const subs = getLevel1Subs(cat.id);
            return (
              <div key={cat.id} className="card-editorial overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3">
                  <button
                    onClick={() => setExpandedCats(prev => {
                      const next = new Set(prev);
                      next.has(cat.id) ? next.delete(cat.id) : next.add(cat.id);
                      return next;
                    })}
                    className="flex items-center gap-2 text-left flex-1"
                  >
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {editingCat === cat.id ? (
                      <Input
                        autoFocus
                        className="h-7 w-48"
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                        onBlur={() => {
                          if (editCatName.trim()) store.updateCategory(cat.id, { name: editCatName.trim() });
                          setEditingCat(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (editCatName.trim()) store.updateCategory(cat.id, { name: editCatName.trim() });
                            setEditingCat(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="font-medium">{cat.name}</span>
                    )}
                  </button>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCat(cat.id); setEditCatName(cat.name); }} aria-label={`Edit ${cat.name}`}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => store.deleteCategory(cat.id)} aria-label={`Delete ${cat.name}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-border pl-8 pr-5 py-2 space-y-1">
                    {subs.map(sub => {
                      const level2 = getLevel2Subs(sub.id);
                      const subExpanded = expandedCats.has(sub.id);
                      return (
                        <div key={sub.id}>
                          <div className="flex items-center justify-between py-1.5">
                            <button
                              onClick={() => setExpandedCats(prev => {
                                const next = new Set(prev);
                                next.has(sub.id) ? next.delete(sub.id) : next.add(sub.id);
                                return next;
                              })}
                              className="flex items-center gap-2 text-sm"
                            >
                              {level2.length > 0 && (subExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
                              {level2.length === 0 && <span className="w-3" />}
                              {sub.name}
                            </button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => store.deleteSubCategory(sub.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>

                          {subExpanded && level2.length > 0 && (
                            <div className="pl-6 space-y-1">
                              {level2.map(ss => (
                                <div key={ss.id} className="flex items-center justify-between py-1 text-sm text-muted-foreground">
                                  <span>{ss.name}</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => store.deleteSubCategory(ss.id)}>
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                              ))}
                              {addingSubSubTo === sub.id ? (
                                <div className="flex gap-2 py-1">
                                  <Input autoFocus className="h-7 text-sm" placeholder="Sub-sub-category..." value={newSubSubName} onChange={(e) => setNewSubSubName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && newSubSubName.trim()) {
                                        store.addSubCategory({ id: generateId(), name: newSubSubName.trim(), categoryId: cat.id, parentSubCategoryId: sub.id });
                                        setNewSubSubName(""); setAddingSubSubTo(null);
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setAddingSubSubTo(sub.id)}>
                                  <Plus className="h-3 w-3 mr-1" /> Add
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {addingSubTo === cat.id ? (
                      <div className="flex gap-2 py-1">
                        <Input autoFocus className="h-7 text-sm" placeholder="Sub-category..." value={newSubName} onChange={(e) => setNewSubName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newSubName.trim()) {
                              store.addSubCategory({ id: generateId(), name: newSubName.trim(), categoryId: cat.id });
                              setNewSubName(""); setAddingSubTo(null);
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setAddingSubTo(cat.id)}>
                        <Plus className="h-3 w-3 mr-1" /> Add Sub-category
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Suppliers Tab */}
      {activeTab === "suppliers" && (
        <div className="space-y-4">
          <div className="card-editorial p-4 flex gap-3">
            <Input placeholder="Supplier name..." value={newSupName} onChange={(e) => setNewSupName(e.target.value)} className="flex-1" />
            <Input placeholder="Contact..." value={newSupContact} onChange={(e) => setNewSupContact(e.target.value)} className="w-40" />
            <Button
              onClick={() => {
                if (newSupName.trim()) {
                  store.addSupplier({ id: generateId(), name: newSupName.trim(), contact: newSupContact || undefined });
                  setNewSupName(""); setNewSupContact("");
                }
              }}
              disabled={!newSupName.trim()}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>

          <div className="card-editorial overflow-hidden">
            <table className="w-full" role="table" aria-label="Suppliers">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
                  <th className="text-left px-5 py-3 font-medium">Name</th>
                  <th className="text-left px-5 py-3 font-medium">Contact</th>
                  <th className="w-10 px-2 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {store.suppliers.map(sup => (
                  <tr key={sup.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium">{sup.name}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{sup.contact || "—"}</td>
                    <td className="px-2 py-3">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => store.deleteSupplier(sup.id)} aria-label={`Delete ${sup.name}`}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Items Tab */}
      {activeTab === "items" && (
        <div className="space-y-4">
          <div className="card-editorial p-4 space-y-3">
            <div className="flex gap-3 flex-wrap">
              <Input placeholder="Item name..." value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="flex-1 min-w-[150px]" />
              <select value={newItemCat} onChange={(e) => setNewItemCat(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Category...</option>
                {store.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={newItemSupplier} onChange={(e) => setNewItemSupplier(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Supplier...</option>
                {store.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Input type="number" placeholder="Price" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} className="w-24" />
              <Input placeholder="Unit" value={newItemUnit} onChange={(e) => setNewItemUnit(e.target.value)} className="w-20" />
              <Button
                onClick={() => {
                  if (newItemName.trim()) {
                    store.addItem({
                      id: generateId(), name: newItemName.trim(), categoryId: newItemCat,
                      subCategoryId: newItemSub || undefined, defaultSupplierId: newItemSupplier || undefined,
                      defaultUnitPrice: Number(newItemPrice) || undefined, unit: newItemUnit || "unit",
                    });
                    setNewItemName(""); setNewItemPrice("");
                  }
                }}
                disabled={!newItemName.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="card-editorial overflow-hidden">
            <table className="w-full" role="table" aria-label="Items">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
                  <th className="text-left px-5 py-3 font-medium">Name</th>
                  <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Category</th>
                  <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Supplier</th>
                  <th className="text-right px-5 py-3 font-medium">Price</th>
                  <th className="w-10 px-2 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {store.items.map(item => {
                  const cat = store.categories.find(c => c.id === item.categoryId);
                  const sup = store.suppliers.find(s => s.id === item.defaultSupplierId);
                  return (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium">{item.name}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground hidden sm:table-cell">{cat?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground hidden md:table-cell">{sup?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-sm text-right">{item.defaultUnitPrice?.toLocaleString() ?? "—"} / {item.unit}</td>
                      <td className="px-2 py-3">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => store.deleteItem(item.id)} aria-label={`Delete ${item.name}`}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
