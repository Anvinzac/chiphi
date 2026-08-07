import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Copy, QrCode, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  generateShareToken,
  hashPin,
  orderShareUrl,
} from "@/lib/orderShare";
import { importOrderCatalogFromSeed } from "@/lib/importOrderCatalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type OrderItemDraft = {
  id?: string;
  name: string;
  quantity: string;
  unit: string;
  sort_order: number;
  catalog_id?: string;
};

type CatalogIngredient = {
  id: string;
  name: string;
  unit: string;
  category_id: string;
  subcategory: string | null;
  reference_price: number | null;
  quick_quantities: number[];
};

type CatalogCategory = {
  id: string;
  name: string;
  sort_order: number;
};

const UNITS = ["kg", "g", "lít", "ml", "bó", "hộp", "chai", "cái", "bao", "gói", "bịch", "lon", "cuộn", "bình", "tá"];

function defaultQty(ing: CatalogIngredient): string {
  if (Array.isArray(ing.quick_quantities) && ing.quick_quantities.length > 0) {
    return String(ing.quick_quantities[0]);
  }
  return "1";
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("draft");
  const [shareToken, setShareToken] = useState("");
  const [pin, setPin] = useState("1234");
  const [items, setItems] = useState<OrderItemDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogIngredient[]>([]);
  const [catalogCats, setCatalogCats] = useState<CatalogCategory[]>([]);
  const [activeCatId, setActiveCatId] = useState<string>("");
  const [ingSearch, setIngSearch] = useState("");
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    if (!user || !id) return;
    setLoading(true);
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !order) {
      toast.error(error?.message || "Không tìm thấy đơn");
      navigate("/orders");
      return;
    }
    setTitle(order.title);
    setStatus(order.status);
    setShareToken(order.share_token);
    const { data: rows } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", id)
      .order("sort_order", { ascending: true });
    setItems(
      (rows || []).map((r, i) => ({
        id: r.id,
        name: r.name,
        quantity: String(r.quantity),
        unit: r.unit,
        sort_order: r.sort_order ?? i,
      })),
    );
    setLoading(false);
  }, [user, id, navigate]);

  const loadCatalog = useCallback(async () => {
    if (!user) return;
    const [cats, ings] = await Promise.all([
      supabase
        .from("order_categories")
        .select("id, name, sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("order_ingredients")
        .select("id, name, unit, category_id, subcategory, reference_price, quick_quantities")
        .eq("user_id", user.id)
        .order("name", { ascending: true }),
    ]);
    const nextCats = (cats.data as CatalogCategory[]) || [];
    setCatalogCats(nextCats);
    if (ings.data) {
      setCatalog(
        (ings.data as any[]).map(r => ({
          ...r,
          quick_quantities: Array.isArray(r.quick_quantities) ? r.quick_quantities : [],
        })),
      );
    } else {
      setCatalog([]);
    }
    setActiveCatId(prev => {
      if (prev && nextCats.some(c => c.id === prev)) return prev;
      return nextCats[0]?.id || "";
    });
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const shareUrl = useMemo(
    () => (shareToken ? orderShareUrl(shareToken) : ""),
    [shareToken],
  );

  const addedByName = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((row, i) => map.set(row.name.trim().toLowerCase(), i));
    return map;
  }, [items]);

  const countsByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const ing of catalog) {
      map.set(ing.category_id, (map.get(ing.category_id) || 0) + 1);
    }
    return map;
  }, [catalog]);

  const activeIngredients = useMemo(() => {
    if (!activeCatId) return [];
    const q = ingSearch.trim().toLowerCase();
    return catalog.filter(ing => {
      if (ing.category_id !== activeCatId) return false;
      if (q && !ing.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [catalog, activeCatId, ingSearch]);

  const groupedIngredients = useMemo(() => {
    const groups = new Map<string, CatalogIngredient[]>();
    for (const ing of activeIngredients) {
      const key = ing.subcategory || "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ing);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b, "vi"));
  }, [activeIngredients]);

  const unitOptions = useMemo(() => {
    const set = new Set(UNITS);
    for (const ing of catalog) if (ing.unit) set.add(ing.unit);
    for (const row of items) if (row.unit) set.add(row.unit);
    return Array.from(set);
  }, [catalog, items]);

  const toggleIngredient = (ing: CatalogIngredient) => {
    const key = ing.name.trim().toLowerCase();
    const existingIdx = addedByName.get(key);
    if (existingIdx != null) {
      setItems(prev =>
        prev.filter((_, i) => i !== existingIdx).map((row, i) => ({ ...row, sort_order: i })),
      );
      return;
    }
    setItems(prev => [
      ...prev,
      {
        name: ing.name,
        quantity: defaultQty(ing),
        unit: ing.unit || "kg",
        sort_order: prev.length,
        catalog_id: ing.id,
      },
    ]);
  };

  const updateRow = (index: number, patch: Partial<OrderItemDraft>) => {
    setItems(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index).map((row, i) => ({ ...row, sort_order: i })));
  };

  const runImport = async () => {
    if (!user || importing) return;
    setImporting(true);
    try {
      const result = await importOrderCatalogFromSeed(user.id);
      toast.success(`Đã nhập ${result.ingredients} nguyên liệu`);
      await loadCatalog();
    } catch (err: any) {
      toast.error(err.message || "Nhập thất bại — chạy migration chưa?");
    } finally {
      setImporting(false);
    }
  };

  const save = async (nextStatus?: string) => {
    if (!user || !id) return;
    const cleaned = items
      .map((row, i) => ({
        ...row,
        name: row.name.trim(),
        quantity: Number(row.quantity) || 0,
        sort_order: i,
      }))
      .filter(row => row.name && row.quantity > 0);

    if (cleaned.length === 0) {
      toast.error("Chọn ít nhất một nguyên liệu");
      return false;
    }

    setSaving(true);
    try {
      const pinHash = await hashPin(pin || "1234");
      const { error: orderErr } = await supabase
        .from("orders")
        .update({
          title: title.trim() || "Đơn hàng",
          status: nextStatus || status,
          supplier_pin_hash: pinHash,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id);
      if (orderErr) throw orderErr;

      await supabase.from("order_items").delete().eq("order_id", id);

      const { error: itemsErr } = await supabase.from("order_items").insert(
        cleaned.map(row => ({
          order_id: id,
          name: row.name,
          quantity: row.quantity,
          unit: row.unit || "kg",
          sort_order: row.sort_order,
          status: "pending",
        })),
      );
      if (itemsErr) throw itemsErr;

      if (nextStatus) setStatus(nextStatus);
      toast.success("Đã lưu");
      await load();
      return true;
    } catch (err: any) {
      toast.error(err.message || "Lưu thất bại");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    const ok = await save("shared");
    if (!ok) return;
    if (!shareToken) {
      const token = generateShareToken();
      await supabase.from("orders").update({ share_token: token }).eq("id", id!);
      setShareToken(token);
    }
    setShareOpen(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Đã copy link");
    } catch {
      toast.error("Không copy được");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Đang tải…
      </div>
    );
  }

  const activeCatName = catalogCats.find(c => c.id === activeCatId)?.name;

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link
            to="/orders"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Quay lại"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="h-9 border-0 bg-transparent px-0 font-display text-lg shadow-none focus-visible:ring-0"
            aria-label="Tiêu đề đơn"
          />
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-5 px-4 py-4">
        <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
          <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            PIN nhà cung cấp
          </label>
          <Input
            type="text"
            inputMode="numeric"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="1234"
            className="h-10"
            maxLength={8}
          />
        </div>

        {/* Category-first catalog picker */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Chọn theo danh mục</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Bấm danh mục → chọn nguyên liệu. Đổi danh mục bằng cách bấm ô khác.
              Sửa tên danh mục trong Admin → Danh mục ĐH.
            </p>
          </div>

          {catalogCats.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center space-y-3">
              <p className="text-xs text-muted-foreground">
                Chưa có danh mục / nguyên liệu. Nhập từ pantry để bắt đầu.
              </p>
              <Button type="button" size="sm" disabled={importing} onClick={runImport}>
                {importing ? "Đang nhập…" : "Nhập từ pantry"}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {catalogCats.map(cat => {
                  const active = cat.id === activeCatId;
                  const count = countsByCat.get(cat.id) || 0;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setActiveCatId(cat.id);
                        setIngSearch("");
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cat.name}
                      <span className={`ml-1 opacity-70 ${active ? "opacity-80" : ""}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeCatId && (
                <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                  <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
                    <p className="text-xs font-semibold text-foreground">{activeCatName}</p>
                    <Input
                      value={ingSearch}
                      onChange={e => setIngSearch(e.target.value)}
                      placeholder="Lọc nhanh…"
                      className="h-8 max-w-[9rem] text-xs"
                    />
                  </div>

                  <div className="max-h-64 overflow-y-auto p-2 space-y-3">
                    {groupedIngredients.length === 0 && (
                      <p className="py-6 text-center text-xs text-muted-foreground">
                        Không có nguyên liệu trong danh mục này
                      </p>
                    )}
                    {groupedIngredients.map(([sub, ings]) => (
                      <div key={sub || "_"} className="space-y-1">
                        {sub ? (
                          <p className="px-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                            {sub}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-1.5">
                          {ings.map(ing => {
                            const selected = addedByName.has(ing.name.trim().toLowerCase());
                            return (
                              <button
                                key={ing.id}
                                type="button"
                                onClick={() => toggleIngredient(ing)}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                                  selected
                                    ? "border-primary bg-primary/10 text-foreground"
                                    : "border-border/70 bg-background text-foreground hover:border-primary/40"
                                }`}
                              >
                                {selected && <Check className="h-3 w-3 text-primary shrink-0" />}
                                <span>{ing.name}</span>
                                <span className="text-[10px] text-muted-foreground">{ing.unit}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Current order lines */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Đơn đang soạn</h2>
            <span className="text-[11px] text-muted-foreground">{items.length} dòng</span>
          </div>

          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              Chưa chọn gì — bấm nguyên liệu ở danh mục phía trên
            </p>
          ) : (
            items.map((row, index) => (
              <div
                key={row.id || `${row.name}-${index}`}
                className="grid grid-cols-[1fr_4.5rem_5rem_auto] gap-1.5 rounded-xl border border-border/50 bg-card p-2"
              >
                <div className="flex h-9 items-center px-1 text-sm font-medium truncate" title={row.name}>
                  {row.name}
                </div>
                <Input
                  value={row.quantity}
                  onChange={e => updateRow(index, { quantity: e.target.value.replace(/[^\d.]/g, "") })}
                  placeholder="SL"
                  inputMode="decimal"
                  className="h-9 text-sm"
                />
                <select
                  value={row.unit}
                  onChange={e => updateRow(index, { unit: e.target.value })}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                  aria-label="Đơn vị"
                >
                  {!unitOptions.includes(row.unit) && row.unit && (
                    <option value={row.unit}>{row.unit}</option>
                  )}
                  {unitOptions.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Xóa dòng"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-sm safe-area-bottom">
        <div className="mx-auto flex max-w-lg gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={saving}
            onClick={() => save()}
          >
            Lưu nháp
          </Button>
          <Button
            type="button"
            className="flex-1 gap-1.5"
            disabled={saving}
            onClick={share}
          >
            <QrCode className="h-4 w-4" />
            Link & QR
          </Button>
        </div>
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-[92vw] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Gửi nhà cung cấp</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {shareUrl && (
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <QRCodeSVG value={shareUrl} size={180} level="M" />
              </div>
            )}
            <p className="w-full break-all rounded-lg bg-muted/50 px-3 py-2 text-center text-[11px] text-muted-foreground">
              {shareUrl}
            </p>
            <p className="text-center text-xs text-muted-foreground">
              PIN: <span className="font-semibold text-foreground">{pin || "1234"}</span>
            </p>
            <Button type="button" onClick={copyLink} className="w-full gap-2">
              <Copy className="h-4 w-4" />
              Copy link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
