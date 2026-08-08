import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { generateShareToken, hashPin } from "@/lib/orderShare";
import {
  importOrderCatalogFromSeed,
  ORDER_HUB_CATEGORIES,
} from "@/lib/importOrderCatalog";

type OrderRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type OrderCategory = {
  id: string;
  name: string;
  source_key: string | null;
  sort_order: number;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  shared: "Đã gửi",
  closed: "Đóng",
};

const CAT_HINT: Record<string, string> = {
  rau: "Admin: Rau",
  "dau-hu": "Admin: Đậu hũ",
  "gia-vi": "Admin: Nguyên vật liệu",
  "nuoc-tuong": "Admin: Nước tương",
  khac: "Admin: Khác",
};

export default function Orders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [categories, setCategories] = useState<OrderCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [ensuring, setEnsuring] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [ordersRes, catsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, title, status, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("order_categories")
        .select("id, name, source_key, sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true }),
    ]);
    if (ordersRes.error) toast.error(ordersRes.error.message);
    else setOrders((ordersRes.data as OrderRow[]) || []);
    if (catsRes.error) toast.error(catsRes.error.message);
    else setCategories((catsRes.data as OrderCategory[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const ensureCatalog = async () => {
    if (!user || ensuring) return categories;
    const hasCanonical = ORDER_HUB_CATEGORIES.every(h =>
      categories.some(c => c.source_key === h.key),
    );
    if (hasCanonical && categories.length === ORDER_HUB_CATEGORIES.length) {
      return categories;
    }
    setEnsuring(true);
    try {
      await importOrderCatalogFromSeed(user.id);
      const { data } = await supabase
        .from("order_categories")
        .select("id, name, source_key, sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });
      const next = (data as OrderCategory[]) || [];
      setCategories(next);
      return next;
    } catch (err: any) {
      toast.error(err.message || "Không tải được danh mục — chạy migration chưa?");
      return categories;
    } finally {
      setEnsuring(false);
    }
  };

  const startOrderForCategory = async (catKey: string, catName: string) => {
    if (!user || creatingKey) return;
    setCreatingKey(catKey);
    try {
      await ensureCatalog();
      const pin = "1234";
      const { data, error } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          title: `Đơn ${catName} · ${format(new Date(), "d/M HH:mm")}`,
          status: "draft",
          share_token: generateShareToken(),
          supplier_pin_hash: await hashPin(pin),
        })
        .select("id")
        .single();
      if (error) throw error;
      navigate(`/orders/${data.id}?cat=${encodeURIComponent(catKey)}`);
    } catch (err: any) {
      toast.error(err.message || "Không tạo được đơn");
    } finally {
      setCreatingKey(null);
    }
  };

  const hubCats = ORDER_HUB_CATEGORIES.map(h => {
    const live = categories.find(c => c.source_key === h.key);
    return {
      key: h.key,
      name: live?.name || h.name,
      hint: CAT_HINT[h.key] || h.adminMatch,
    };
  });

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link
            to="/"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Quay lại"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl text-foreground">Đặt hàng</h1>
            <p className="text-[11px] text-muted-foreground">Chọn danh mục để soạn đơn</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-6 px-4 py-4">
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Danh mục</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Rau · Đậu hũ · Gia vị · Nước tương · Khác
            </p>
          </div>

          {loading && categories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Đang tải danh mục…</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {hubCats.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  disabled={!!creatingKey || ensuring}
                  onClick={() => startOrderForCategory(cat.key, cat.name)}
                  className="rounded-2xl border border-border/60 bg-card px-3 py-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 active:scale-[0.99] disabled:opacity-60"
                >
                  <p className="font-display text-lg text-foreground leading-tight">{cat.name}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{cat.hint}</p>
                  {creatingKey === cat.key && (
                    <p className="mt-2 text-[10px] text-primary">Đang tạo đơn…</p>
                  )}
                </button>
              ))}
            </div>
          )}

          {categories.length === 0 && !loading && (
            <button
              type="button"
              onClick={() => ensureCatalog()}
              disabled={ensuring}
              className="w-full rounded-xl border border-dashed border-border px-3 py-3 text-xs text-muted-foreground hover:text-foreground"
            >
              {ensuring ? "Đang nhập danh mục…" : "Nhập danh mục từ pantry"}
            </button>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Đơn gần đây</h2>
            <span className="text-[11px] text-muted-foreground">{orders.length}</span>
          </div>

          {!loading && orders.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
              Chưa có đơn — chọn danh mục phía trên để bắt đầu
            </p>
          )}

          {orders.map(order => (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{order.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {STATUS_LABEL[order.status] || order.status}
                  <span className="mx-1.5 text-border">·</span>
                  {format(parseISO(order.created_at), "d/M/yyyy HH:mm")}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
