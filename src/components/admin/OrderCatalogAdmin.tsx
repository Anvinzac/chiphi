import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { importOrderCatalogFromSeed } from "@/lib/importOrderCatalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type OrderCatalogMode = "categories" | "ingredients";

type OrderCategory = {
  id: string;
  name: string;
  sort_order: number;
  source_key: string | null;
};

type OrderIngredient = {
  id: string;
  name: string;
  unit: string;
  subcategory: string | null;
  reference_price: number | null;
  category_id: string;
  source_key: string | null;
};

interface Props {
  userId: string;
  mode: OrderCatalogMode;
}

export default function OrderCatalogAdmin({ userId, mode }: Props) {
  const [categories, setCategories] = useState<OrderCategory[]>([]);
  const [ingredients, setIngredients] = useState<OrderIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [filterCat, setFilterCat] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [newIngName, setNewIngName] = useState("");
  const [newIngUnit, setNewIngUnit] = useState("kg");
  const [newIngCat, setNewIngCat] = useState("");
  const [newIngPrice, setNewIngPrice] = useState("");
  const [newIngSub, setNewIngSub] = useState("");
  const [editingIngId, setEditingIngId] = useState<string | null>(null);
  const [editIng, setEditIng] = useState({
    name: "",
    unit: "",
    subcategory: "",
    reference_price: "",
    category_id: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [c, i] = await Promise.all([
      supabase
        .from("order_categories")
        .select("id, name, sort_order, source_key")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("order_ingredients")
        .select("id, name, unit, subcategory, reference_price, category_id, source_key")
        .eq("user_id", userId)
        .order("name", { ascending: true }),
    ]);
    if (c.error) toast.error(c.error.message);
    else setCategories((c.data as OrderCategory[]) || []);
    if (i.error) toast.error(i.error.message);
    else setIngredients((i.data as OrderIngredient[]) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredIngredients = useMemo(() => {
    if (!filterCat) return ingredients;
    return ingredients.filter(ing => ing.category_id === filterCat);
  }, [ingredients, filterCat]);

  const catName = (id: string) => categories.find(c => c.id === id)?.name ?? "—";

  const runImport = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const result = await importOrderCatalogFromSeed(userId);
      toast.success(`Đã nhập ${result.ingredients} nguyên liệu / ${result.categories} danh mục`);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Nhập thất bại");
    } finally {
      setImporting(false);
    }
  };

  const addCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("order_categories")
      .insert({
        user_id: userId,
        name,
        sort_order: categories.length,
      })
      .select("id, name, sort_order, source_key")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setCategories(prev => [...prev, data as OrderCategory]);
    setNewCatName("");
  };

  const renameCategory = async (id: string) => {
    const name = editingCatName.trim();
    setEditingCatId(null);
    if (!name) return;
    const { error } = await supabase
      .from("order_categories")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCategories(prev => prev.map(c => (c.id === id ? { ...c, name } : c)));
  };

  const deleteCategory = async (id: string) => {
    const inUse = ingredients.some(ing => ing.category_id === id);
    if (inUse) {
      toast.error("Còn nguyên liệu trong danh mục — xóa hoặc chuyển chúng trước");
      return;
    }
    const { error } = await supabase.from("order_categories").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  const addIngredient = async () => {
    const name = newIngName.trim();
    const category_id = newIngCat || categories[0]?.id;
    if (!name || !category_id) {
      toast.error("Cần tên và danh mục");
      return;
    }
    const { data, error } = await supabase
      .from("order_ingredients")
      .insert({
        user_id: userId,
        category_id,
        name,
        unit: newIngUnit || "kg",
        subcategory: newIngSub.trim() || null,
        reference_price: newIngPrice === "" ? null : Number(newIngPrice) || 0,
      })
      .select("id, name, unit, subcategory, reference_price, category_id, source_key")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setIngredients(prev => [...prev, data as OrderIngredient].sort((a, b) => a.name.localeCompare(b.name, "vi")));
    setNewIngName("");
    setNewIngPrice("");
    setNewIngSub("");
  };

  const startEditIngredient = (ing: OrderIngredient) => {
    setEditingIngId(ing.id);
    setEditIng({
      name: ing.name,
      unit: ing.unit,
      subcategory: ing.subcategory || "",
      reference_price: ing.reference_price == null ? "" : String(ing.reference_price),
      category_id: ing.category_id,
    });
  };

  const saveIngredient = async (id: string) => {
    const payload = {
      name: editIng.name.trim(),
      unit: editIng.unit.trim() || "kg",
      subcategory: editIng.subcategory.trim() || null,
      reference_price: editIng.reference_price === "" ? null : Number(editIng.reference_price) || 0,
      category_id: editIng.category_id,
      updated_at: new Date().toISOString(),
    };
    if (!payload.name || !payload.category_id) {
      toast.error("Thiếu tên hoặc danh mục");
      return;
    }
    const { error } = await supabase.from("order_ingredients").update(payload).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setIngredients(prev =>
      prev
        .map(ing => (ing.id === id ? { ...ing, ...payload } : ing))
        .sort((a, b) => a.name.localeCompare(b.name, "vi")),
    );
    setEditingIngId(null);
  };

  const deleteIngredient = async (id: string) => {
    const { error } = await supabase.from("order_ingredients").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setIngredients(prev => prev.filter(ing => ing.id !== id));
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Đang tải…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {categories.length} danh mục · {ingredients.length} nguyên liệu
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={importing}
          onClick={runImport}
        >
          <Download className="h-3.5 w-3.5" />
          {importing ? "Đang nhập…" : "Nhập từ pantry"}
        </Button>
      </div>

      {mode === "categories" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="Tên danh mục mới"
              className="h-9"
              onKeyDown={e => e.key === "Enter" && addCategory()}
            />
            <Button type="button" size="sm" onClick={addCategory} className="gap-1 shrink-0">
              <Plus className="h-3.5 w-3.5" />
              Thêm
            </Button>
          </div>
          <ul className="space-y-1.5">
            {categories.map(cat => (
              <li
                key={cat.id}
                className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-2"
              >
                {editingCatId === cat.id ? (
                  <Input
                    autoFocus
                    value={editingCatName}
                    onChange={e => setEditingCatName(e.target.value)}
                    onBlur={() => renameCategory(cat.id)}
                    onKeyDown={e => {
                      if (e.key === "Enter") renameCategory(cat.id);
                      if (e.key === "Escape") setEditingCatId(null);
                    }}
                    className="h-8"
                  />
                ) : (
                  <button
                    type="button"
                    className="flex-1 text-left text-sm font-medium"
                    onClick={() => {
                      setEditingCatId(cat.id);
                      setEditingCatName(cat.name);
                    }}
                  >
                    {cat.name}
                    <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                      {ingredients.filter(i => i.category_id === cat.id).length} món
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteCategory(cat.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Xóa danh mục"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mode === "ingredients" && (
        <div className="space-y-3">
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Tất cả danh mục</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <div className="grid grid-cols-[1fr_4.5rem_1fr] gap-1.5 sm:grid-cols-[1fr_4.5rem_7rem_1fr_auto]">
            <Input
              value={newIngName}
              onChange={e => setNewIngName(e.target.value)}
              placeholder="Tên"
              className="h-9"
            />
            <Input
              value={newIngUnit}
              onChange={e => setNewIngUnit(e.target.value)}
              placeholder="ĐV"
              className="h-9"
            />
            <select
              value={newIngCat || categories[0]?.id || ""}
              onChange={e => setNewIngCat(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs col-span-2 sm:col-span-1"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Input
              value={newIngPrice}
              onChange={e => setNewIngPrice(e.target.value.replace(/\D/g, ""))}
              placeholder="Giá ₫"
              inputMode="numeric"
              className="h-9 hidden sm:block"
            />
            <Button type="button" size="sm" onClick={addIngredient} className="gap-1 col-span-3 sm:col-span-1">
              <Plus className="h-3.5 w-3.5" />
              Thêm
            </Button>
          </div>
          <Input
            value={newIngSub}
            onChange={e => setNewIngSub(e.target.value)}
            placeholder="Phân nhóm (tuỳ chọn)"
            className="h-8 text-xs"
          />

          <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto">
            {filteredIngredients.map(ing => (
              <li
                key={ing.id}
                className="rounded-lg border border-border/50 bg-card px-2.5 py-2"
              >
                {editingIngId === ing.id ? (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-[1fr_4rem] gap-1.5">
                      <Input
                        value={editIng.name}
                        onChange={e => setEditIng(p => ({ ...p, name: e.target.value }))}
                        className="h-8"
                      />
                      <Input
                        value={editIng.unit}
                        onChange={e => setEditIng(p => ({ ...p, unit: e.target.value }))}
                        className="h-8"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={editIng.category_id}
                        onChange={e => setEditIng(p => ({ ...p, category_id: e.target.value }))}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <Input
                        value={editIng.reference_price}
                        onChange={e =>
                          setEditIng(p => ({ ...p, reference_price: e.target.value.replace(/\D/g, "") }))
                        }
                        placeholder="Giá ₫"
                        className="h-8"
                      />
                    </div>
                    <Input
                      value={editIng.subcategory}
                      onChange={e => setEditIng(p => ({ ...p, subcategory: e.target.value }))}
                      placeholder="Phân nhóm"
                      className="h-8 text-xs"
                    />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={() => saveIngredient(ing.id)}>
                        Lưu
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditingIngId(null)}>
                        Huỷ
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => startEditIngredient(ing)}
                    >
                      <p className="text-sm font-medium truncate">{ing.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {catName(ing.category_id)}
                        {ing.subcategory ? ` · ${ing.subcategory}` : ""}
                        {" · "}
                        {ing.unit}
                        {ing.reference_price != null
                          ? ` · ${Number(ing.reference_price).toLocaleString("vi-VN")}₫`
                          : ""}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteIngredient(ing.id)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Xóa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
