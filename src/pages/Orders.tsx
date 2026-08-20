import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { endOfWeek, format, isToday, isYesterday, parseISO, startOfWeek } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLaggedSnapshot } from "@/hooks/useLaggedSnapshot";
import SnapshotBanner from "@/components/SnapshotBanner";
import {
  importOrderCatalogFromSeed,
  ORDER_HUB_CATEGORIES,
} from "@/lib/importOrderCatalog";
import { ensureMockOrders } from "@/lib/mockOrders";
import { isThrowawayAccount } from "@/lib/throwawayAccount";
import { formatDayMonth } from "@/lib/formatDateVi";
import { orderIdentityLine } from "@/lib/orderIdentity";
import DaySection from "@/components/daily/DaySection";
import OrdersPager, { type OrdersPage } from "@/components/orders/OrdersPager";

type OrderRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  itemCount: number;
  customer_name?: string | null;
  day_seq?: number | null;
  mgmt_id?: string | null;
};

type OrderCategory = {
  id: string;
  name: string;
  source_key: string | null;
  sort_order: number;
};

type DayBucket = {
  date: string;
  orders: OrderRow[];
};

type ViewMode = "daily" | "weekly";

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

function orderDateKey(iso: string): string {
  return format(parseISO(iso), "yyyy-MM-dd");
}

function formatDayHeading(dateStr: string) {
  try {
    const d = parseISO(dateStr);
    if (isToday(d)) return "Hôm nay";
    if (isYesterday(d)) return "Hôm qua";
    return format(d, "EEEE, d MMMM", { locale: vi });
  } catch {
    return dateStr;
  }
}

function OrderCard({ order }: { order: OrderRow }) {
  return (
    <Link
      to={`/orders/${order.id}`}
      className="mb-2 flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 transition-colors hover:bg-muted/40"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{order.customer_name?.trim() || order.title}</p>
        <p className="text-[11px] text-muted-foreground">
          {orderIdentityLine(order) || STATUS_LABEL[order.status] || order.status}
          <span className="mx-1.5 text-border">·</span>
          {format(parseISO(order.created_at), "HH:mm")}
          <span className="mx-1.5 text-border">·</span>
          {order.itemCount} món
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

export default function Orders() {
  const { user } = useAuth();
  const { snapshot } = useLaggedSnapshot();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [categories, setCategories] = useState<OrderCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [ensuring, setEnsuring] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("daily");

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isThrowawayAccount(user.email)) await ensureMockOrders(user.id);
    } catch (err: any) {
      if (!snapshot) toast.error(err.message || "Không tạo được đơn mẫu");
    }
    const [ordersRes, catsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, title, status, created_at, updated_at, customer_name, day_seq, mgmt_id, order_items(id)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("order_categories")
        .select("id, name, source_key, sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true }),
    ]);
    if (ordersRes.error) {
      const lagged = snapshot;
      if (lagged) {
        const countByOrder = new Map<string, number>();
        for (const item of lagged.order_items) {
          countByOrder.set(item.order_id, (countByOrder.get(item.order_id) || 0) + 1);
        }
        setOrders(
          lagged.orders
            .filter(o => (countByOrder.get(o.id) || 0) > 0)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map(order => ({
              id: order.id,
              title: order.title,
              status: order.status,
              created_at: order.created_at,
              updated_at: order.updated_at,
              itemCount: countByOrder.get(order.id) || 0,
            })),
        );
      } else {
        toast.error(ordersRes.error.message);
      }
    } else {
      const raw = (ordersRes.data as (Omit<OrderRow, "itemCount"> & { order_items?: { id: string }[] })[]) || [];
      const emptyIds = raw.filter(o => !(o.order_items && o.order_items.length > 0)).map(o => o.id);
      if (emptyIds.length > 0) {
        await supabase.from("orders").delete().in("id", emptyIds).eq("user_id", user.id);
      }
      setOrders(
        raw
          .filter(o => o.order_items && o.order_items.length > 0)
          .map(({ order_items, ...order }) => ({
            ...order,
            itemCount: order_items?.length ?? 0,
          })),
      );
    }
    if (catsRes.error) {
      if (snapshot?.order_categories.length) {
        setCategories(
          snapshot.order_categories.map(c => ({
            id: c.id,
            name: c.name,
            source_key: c.source_key,
            sort_order: c.sort_order,
          })),
        );
      } else {
        toast.error(catsRes.error.message);
      }
    } else setCategories((catsRes.data as OrderCategory[]) || []);
    setLoading(false);
  }, [user, snapshot]);

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

  const startOrderForCategory = async (catKey: string, _catName: string) => {
    if (!user || creatingKey) return;
    setCreatingKey(catKey);
    try {
      await ensureCatalog();
      navigate(`/orders/new?cat=${encodeURIComponent(catKey)}`);
    } catch (err: any) {
      toast.error(err.message || "Không mở được đơn");
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

  const dayBuckets = useMemo<DayBucket[]>(() => {
    const map = new Map<string, OrderRow[]>();
    for (const order of orders) {
      const key = orderDateKey(order.created_at);
      const list = map.get(key);
      if (list) list.push(order);
      else map.set(key, [order]);
    }
    const days = Array.from(map.entries())
      .map(([date, list]) => ({
        date,
        orders: list.sort((a, b) => b.created_at.localeCompare(a.created_at)),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
    if (!map.has(todayStr)) {
      days.unshift({ date: todayStr, orders: [] });
    }
    return days;
  }, [orders, todayStr]);

  const dailyPages = useMemo<OrdersPage<OrderRow>[]>(
    () =>
      dayBuckets.map(day => ({
        key: day.date,
        title: formatDayHeading(day.date),
        count: day.orders.length,
        sections: day.orders,
      })),
    [dayBuckets],
  );

  const weeklyPages = useMemo<OrdersPage<DayBucket>[]>(() => {
    const map = new Map<string, OrdersPage<DayBucket> & { weekStart: Date }>();
    for (const day of dayBuckets) {
      if (day.orders.length === 0 && day.date !== todayStr) continue;
      const d = parseISO(day.date);
      const weekStart = startOfWeek(d, { weekStartsOn: 1 });
      const key = format(weekStart, "yyyy-MM-dd");
      let page = map.get(key);
      if (!page) {
        const weekEnd = endOfWeek(d, { weekStartsOn: 1 });
        page = {
          key,
          weekStart,
          title: `Tuần ${formatDayMonth(weekStart)} – ${formatDayMonth(weekEnd)}`,
          count: 0,
          sections: [],
        };
        map.set(key, page);
      }
      page.count += day.orders.length;
      page.sections.push(day);
    }
    return Array.from(map.values())
      .sort((a, b) => b.key.localeCompare(a.key))
      .map(page => ({
        ...page,
        sections: page.sections.sort((a, b) => b.date.localeCompare(a.date)),
      }));
  }, [dayBuckets, todayStr]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur-sm">
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
          <div className="inline-flex shrink-0 rounded-full border border-border/60 bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("daily")}
              aria-pressed={viewMode === "daily"}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                viewMode === "daily"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ngày
            </button>
            <button
              type="button"
              onClick={() => setViewMode("weekly")}
              aria-pressed={viewMode === "weekly"}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                viewMode === "weekly"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tuần
            </button>
          </div>
        </div>
      </div>

      <SnapshotBanner />

      <div className="mx-auto w-full max-w-lg flex-1 space-y-6 overflow-auto px-4 py-4 pb-10">
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
                    <p className="mt-2 text-[10px] text-primary">Đang mở…</p>
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
            <h2 className="text-sm font-semibold">Đơn</h2>
            <span className="text-[11px] text-muted-foreground">{orders.length}</span>
          </div>

          {loading && orders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Đang tải đơn…</p>
          ) : viewMode === "daily" ? (
            <OrdersPager
              pages={dailyPages}
              emptyLabel="Chưa có đơn ngày này"
              renderSection={order => <OrderCard key={order.id} order={order} />}
            />
          ) : (
            <OrdersPager
              pages={weeklyPages}
              emptyLabel="Chưa có đơn tuần này"
              renderSection={day => (
                <DaySection
                  key={day.date}
                  title={formatDayHeading(day.date)}
                  meta={`${day.orders.length} đơn`}
                >
                  {day.orders.length === 0 ? (
                    <p className="py-2 text-[11px] text-muted-foreground">Chưa có đơn</p>
                  ) : (
                    day.orders.map(order => <OrderCard key={order.id} order={order} />)
                  )}
                </DaySection>
              )}
            />
          )}
        </section>
      </div>
    </div>
  );
}
