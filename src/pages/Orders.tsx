import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, CalendarDays, ChevronRight, Plus, Utensils } from "lucide-react";
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
import { isKitchenAccount, resolveCatalogOwnerId } from "@/lib/kitchenAccount";
import { formatDayMonth, formatDayMonthRange } from "@/lib/formatDateVi";
import { orderIdentityLine } from "@/lib/orderIdentity";
import {
  filledDayCount,
  listMonthlyOrdersLocal,
  mergeMonthlyLists,
  monthlyCategoryName,
  type MonthlyOrderListItem,
} from "@/lib/monthlyOrderPersist";
import { listMonthlyOrdersRemote } from "@/lib/monthlyOrderDb";
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
  monthly: MonthlyOrderListItem[];
};

type ListEntry =
  | { kind: "monthly"; row: MonthlyOrderListItem }
  | { kind: "daily"; row: OrderRow };

type ViewMode = "daily" | "weekly";
type HubKind = "daily" | "monthly";

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  shared: "Đã gửi",
  closed: "Đóng",
  pending: "Chờ duyệt",
  rejected: "Bị từ chối",
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

function monthlyRangeLabel(row: MonthlyOrderListItem): string {
  try {
    const start = parseISO(row.startInput);
    const end = parseISO(row.endInput);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return formatDayMonthRange(start, end);
    }
  } catch {
    /* keep empty */
  }
  return "";
}

function MonthlyOrderCard({ row }: { row: MonthlyOrderListItem }) {
  const filled = filledDayCount(row.cells);
  const range = monthlyRangeLabel(row);
  return (
    <Link
      to={`/orders/monthly?cat=${encodeURIComponent(row.categoryKey)}`}
      className="order-card-monthly"
    >
      <span className="order-card-monthly__icon" aria-hidden>
        <CalendarDays className="h-4 w-4" strokeWidth={2.1} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="order-card-monthly__mark">{row.shareToken ? "Đã gửi" : "Đang soạn"}</p>
        <p className="truncate text-sm font-medium">{row.title || `Đơn tháng ${monthlyCategoryName(row.categoryKey)}`}</p>
        <p className="text-[11px] text-[#5a6b58]">
          Đơn tháng · {monthlyCategoryName(row.categoryKey)}
          {range ? (
            <>
              <span className="mx-1.5 opacity-40">·</span>
              {range}
            </>
          ) : null}
          <span className="mx-1.5 opacity-40">·</span>
          {filled} ngày
          {row.updatedAt ? (
            <>
              <span className="mx-1.5 opacity-40">·</span>
              {format(parseISO(row.updatedAt), "HH:mm")}
            </>
          ) : null}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
    </Link>
  );
}

function renderListEntry(entry: ListEntry) {
  return entry.kind === "monthly" ? (
    <MonthlyOrderCard key={`m-${entry.row.categoryKey}`} row={entry.row} />
  ) : (
    <OrderCard key={entry.row.id} order={entry.row} />
  );
}

export default function Orders() {
  const { user } = useAuth();
  const { snapshot } = useLaggedSnapshot();
  const navigate = useNavigate();
  const location = useLocation() as ReturnType<typeof useLocation> & { state?: { fromMain?: boolean } | null };
  useEffect(() => {
    if ((location.state as { fromMain?: boolean } | null)?.fromMain) {
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }
  }, []);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [monthlyOrders, setMonthlyOrders] = useState<MonthlyOrderListItem[]>(() => listMonthlyOrdersLocal());
  const [categories, setCategories] = useState<OrderCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [ensuring, setEnsuring] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [sheetOpen, setSheetOpen] = useState(() => {
    const s = (location.state as { fromMain?: boolean } | null)?.fromMain;
    return s === true;
  });
  const [sheetClosing, setSheetClosing] = useState(false);
  const [hubKind, setHubKind] = useState<HubKind>("daily");

  const kitchen = isKitchenAccount(user?.email);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isThrowawayAccount(user.email)) await ensureMockOrders(user.id);
    } catch (err: any) {
      if (!snapshot) toast.error(err.message || "Không tạo được đơn mẫu");
    }
    const catalogOwnerId = await resolveCatalogOwnerId(user.id, user.email);
    const [ordersRes, catsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, title, status, created_at, updated_at, customer_name, day_seq, mgmt_id, order_items(id)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("order_categories")
        .select("id, name, source_key, sort_order")
        .eq("user_id", catalogOwnerId)
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
      // Only drafts get swept — a submitted order stays even if it has no lines.
      const emptyIds = raw
        .filter(o => o.status === "draft" && !(o.order_items && o.order_items.length > 0))
        .map(o => o.id);
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
    try {
      const remoteMonthly = user ? await listMonthlyOrdersRemote(user.id) : [];
      setMonthlyOrders(mergeMonthlyLists(listMonthlyOrdersLocal(), remoteMonthly));
    } catch (err: unknown) {
      setMonthlyOrders(listMonthlyOrdersLocal());
      const message = err instanceof Error ? err.message : "Không tải được đơn tháng";
      toast.error(message);
    }
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
      // Kitchen reads the admin's catalog and has no write access to seed one.
      if (isKitchenAccount(user.email)) {
        const { data } = await supabase
          .from("order_categories")
          .select("id, name, source_key, sort_order")
          .eq("user_id", await resolveCatalogOwnerId(user.id, user.email))
          .order("sort_order", { ascending: true });
        const shared = (data as OrderCategory[]) || [];
        setCategories(shared);
        return shared;
      }
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

  const closeSheet = useCallback(() => {
    if (!sheetOpen || sheetClosing) return;
    setSheetClosing(true);
    window.setTimeout(() => {
      setSheetOpen(false);
      setSheetClosing(false);
    }, 300);
  }, [sheetOpen, sheetClosing]);

  const openSheet = useCallback(() => {
    if (sheetOpen) return;
    setHubKind("daily");
    setSheetClosing(false);
    setSheetOpen(true);
  }, [sheetOpen]);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen, closeSheet]);

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
        monthly: [] as MonthlyOrderListItem[],
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
    if (!map.has(todayStr)) {
      days.unshift({ date: todayStr, orders: [], monthly: monthlyOrders });
    } else {
      const today = days.find(d => d.date === todayStr);
      if (today) today.monthly = monthlyOrders;
    }
    return days;
  }, [orders, monthlyOrders, todayStr]);

  const dailyPages = useMemo<OrdersPage<ListEntry>[]>(
    () =>
      dayBuckets.map(day => ({
        key: day.date,
        title: formatDayHeading(day.date),
        count: day.monthly.length + day.orders.length,
        sections: [
          ...day.monthly.map(row => ({ kind: "monthly" as const, row })),
          ...day.orders.map(row => ({ kind: "daily" as const, row })),
        ],
      })),
    [dayBuckets],
  );

  const weeklyPages = useMemo<OrdersPage<DayBucket>[]>(() => {
    const map = new Map<string, OrdersPage<DayBucket> & { weekStart: Date }>();
    for (const day of dayBuckets) {
      if (day.orders.length === 0 && day.monthly.length === 0 && day.date !== todayStr) continue;
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
      page.count += day.orders.length + day.monthly.length;
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
          {kitchen ? (
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 text-muted-foreground" aria-hidden>
              <Utensils className="h-4 w-4" />
            </div>
          ) : (
            <Link
              to="/"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Quay lại"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl text-foreground">Đặt hàng</h1>
            <p className="text-[11px] text-muted-foreground">
              {monthlyOrders.length > 0
                ? `${orders.length} đơn ngày · ${monthlyOrders.length} đơn tháng`
                : `${orders.length} đơn đã đặt`}
            </p>
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

      <div className="mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col overflow-auto px-4 py-4 pb-28">
        {loading && orders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Đang tải đơn…</p>
        ) : viewMode === "daily" ? (
          <OrdersPager
            pages={dailyPages}
            emptyLabel="Chưa có đơn ngày này"
            renderSection={renderListEntry}
          />
        ) : (
          <OrdersPager
            pages={weeklyPages}
            emptyLabel="Chưa có đơn tuần này"
            renderSection={day => (
              <DaySection
                key={day.date}
                title={formatDayHeading(day.date)}
                meta={`${day.monthly.length + day.orders.length} đơn`}
              >
                {day.monthly.length === 0 && day.orders.length === 0 ? (
                  <p className="py-2 text-[11px] text-muted-foreground">Chưa có đơn</p>
                ) : (
                  <>
                    {day.monthly.map(row => (
                      <MonthlyOrderCard key={`m-${row.categoryKey}`} row={row} />
                    ))}
                    {day.orders.map(order => (
                      <OrderCard key={order.id} order={order} />
                    ))}
                  </>
                )}
              </DaySection>
            )}
          />
        )}
      </div>

      <button
        type="button"
        onClick={openSheet}
        disabled={sheetOpen}
        tabIndex={sheetOpen ? -1 : 0}
        aria-hidden={sheetOpen}
        aria-label="Đơn mới"
        className={`order-new-fab ${sheetOpen ? "order-new-fab--hidden" : ""}`}
      >
        <Plus className="h-6 w-6" strokeWidth={2.4} />
      </button>

      {sheetOpen && (
        <>
          <button
            type="button"
            className={`expense-add-scrim fixed inset-0 z-40 ${
              sheetClosing ? "expense-scrim-exit" : "expense-scrim-enter"
            }`}
            aria-label="Đóng đơn mới"
            onClick={closeSheet}
          />
          <div
            className={`order-new-sheet ${sheetClosing ? "expense-card-exit" : "expense-card-enter"}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-new-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="order-new-sheet__panel">
              <div className="order-new-sheet__handle" aria-hidden />
              <div className="mb-3 flex items-start gap-2">
                {hubKind === "monthly" ? (
                  <button
                    type="button"
                    onClick={() => setHubKind("daily")}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Về đơn ngày"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                ) : null}
                <div className="min-w-0 flex-1">
                  <h2 id="order-new-title" className="text-sm font-semibold">
                    {hubKind === "monthly" ? "Đơn tháng" : "Đơn mới"}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {hubKind === "monthly" ? "Chọn loại nguyên liệu cho lưới tháng" : "Chọn loại đơn để soạn"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {hubKind === "daily" ? (
                  <>
                    {hubCats.map(cat => (
                      <button
                        key={cat.key}
                        type="button"
                        disabled={!!creatingKey || ensuring}
                        onClick={() => startOrderForCategory(cat.key, cat.name)}
                        className="order-hub-tile"
                      >
                        <p className="font-display text-lg leading-tight text-foreground">{cat.name}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{cat.hint}</p>
                        {creatingKey === cat.key && (
                          <p className="mt-2 text-[10px] text-primary">Đang mở…</p>
                        )}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setHubKind("monthly")}
                      className="order-hub-tile order-hub-tile--monthly"
                      aria-label="Đơn tháng"
                    >
                      <Calendar className="order-hub-tile__cal" strokeWidth={2.1} aria-hidden />
                      <p className="font-display text-lg leading-tight">Đơn tháng</p>
                      <p className="order-hub-tile__hint mt-1 text-[10px]">Lưới theo ngày · nhiều loại</p>
                    </button>
                  </>
                ) : (
                  hubCats.map(cat => {
                    const inProgress = monthlyOrders.find(row => row.categoryKey === cat.key);
                    const filled = inProgress ? filledDayCount(inProgress.cells) : 0;
                    return (
                      <Link
                        key={cat.key}
                        to={`/orders/monthly?cat=${encodeURIComponent(cat.key)}`}
                        className="order-hub-tile order-hub-tile--monthly"
                      >
                        <Calendar className="order-hub-tile__cal" strokeWidth={2.1} aria-hidden />
                        <p className="font-display text-lg leading-tight">{cat.name}</p>
                        <p className="order-hub-tile__hint mt-1 text-[10px]">
                          {inProgress
                            ? `Đang soạn · ${filled} ngày`
                            : "Lưới theo ngày"}
                        </p>
                      </Link>
                    );
                  })
                )}
              </div>
              {categories.length === 0 && !loading && (
                <button
                  type="button"
                  onClick={() => ensureCatalog()}
                  disabled={ensuring}
                  className="mt-3 w-full rounded-xl border border-dashed border-border px-3 py-3 text-xs text-muted-foreground hover:text-foreground"
                >
                  {ensuring ? "Đang nhập danh mục…" : "Nhập danh mục từ pantry"}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
