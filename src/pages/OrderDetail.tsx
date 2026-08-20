import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Copy, QrCode, Store } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  generateShareToken,
  hashPin,
  markOrderPinUnlocked,
  orderShareUrl,
} from "@/lib/orderShare";
import { importOrderCatalogFromSeed } from "@/lib/importOrderCatalog";
import {
  frequentIngredientDotClass,
  topFrequentNamesForCategory,
} from "@/lib/frequentOrderIngredients";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MoneyLabel from "@/components/daily/MoneyLabel";
import { useHoldToConfirm } from "@/hooks/useHoldToConfirm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  draftHasAmount,
  draftMoneyVnd,
  moneyAmountToDraft,
  type OrderMode,
} from "@/lib/formatOrderQty";
import { customerNameFromUser, formatOrderDay, orderIdentityLine } from "@/lib/orderIdentity";

type OrderItemDraft = {
  id?: string;
  name: string;
  quantity: string;
  unit: string;
  sort_order: number;
  catalog_id?: string;
  reference_price?: number | null;
  order_mode?: OrderMode;
  money_amount?: string;
  notice?: string;
};

type CatalogIngredient = {
  id: string;
  name: string;
  unit: string;
  category_id: string;
  subcategory: string | null;
  reference_price: number | null;
  quick_quantities: number[];
  order_count?: number;
};

type CatalogCategory = {
  id: string;
  name: string;
  sort_order: number;
  source_key?: string | null;
};

const PLACEHOLDER_SLOTS = 4;
const CHIP_PAGE_SIZE = 12;

function defaultQty(ing: CatalogIngredient): string {
  if (Array.isArray(ing.quick_quantities) && ing.quick_quantities.length > 0) {
    return String(ing.quick_quantities[0]);
  }
  return "1";
}

function OrderFilledRow({
  row,
  expanded,
  estimate,
  chipCloud,
  onExpand,
  onUpdate,
  onCommitNotice,
  onRemove,
}: {
  row: OrderItemDraft;
  expanded: boolean;
  estimate: number | null;
  chipCloud: ReactNode;
  onExpand: () => void;
  onUpdate: (patch: Partial<OrderItemDraft>) => void;
  onCommitNotice: (notice: string) => void;
  onRemove: () => void;
}) {
  const { confirming, cancelConfirm, consumeClick, rootRef, holdProps } = useHoldToConfirm({
    ignoreSelector: "input, textarea, button",
  });

  const handleRowActivate = () => {
    if (consumeClick()) return;
    if (confirming) {
      cancelConfirm();
      return;
    }
    onExpand();
  };

  return (
    <>
      <div
        ref={rootRef}
        className={`select-none [-webkit-touch-callout:none] ${confirming ? "bg-destructive/5" : ""}`}
        {...holdProps}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={handleRowActivate}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleRowActivate();
            }
          }}
          className={`grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-1.5 text-left ${
            expanded ? "bg-primary/5" : "hover:bg-muted/30"
          }`}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight">{row.name}</p>
            {expanded ? (
              <input
                value={row.notice ?? ""}
                onChange={e => onUpdate({ notice: e.target.value })}
                onBlur={e => onCommitNotice(e.target.value)}
                onClick={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                placeholder="Ghi chú cho chợ…"
                className="mt-0.5 h-5 w-full bg-transparent text-[11px] leading-tight text-muted-foreground outline-none placeholder:text-muted-foreground/35"
                aria-label={`Ghi chú ${row.name}`}
              />
            ) : row.notice?.trim() ? (
              <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
                {row.notice}
              </p>
            ) : null}
          </div>
          <div
            className="flex shrink-0 items-baseline"
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
          >
            {row.order_mode === "money" ? (
              <Input
                value={row.money_amount ?? ""}
                onFocus={() => onUpdate({ money_amount: "" })}
                onChange={e => onUpdate({ money_amount: e.target.value.replace(/[^\d.]/g, "") })}
                placeholder="0"
                inputMode="numeric"
                className="h-7 w-8 border-0 bg-transparent px-0 text-right text-sm tabular-nums shadow-none focus-visible:ring-1"
                aria-label={`Số tiền ${row.name}`}
              />
            ) : (
              <Input
                value={row.quantity}
                onFocus={() => onUpdate({ quantity: "" })}
                onChange={e => onUpdate({ quantity: e.target.value.replace(/[^\d.]/g, "") })}
                placeholder="0"
                inputMode="decimal"
                className="h-7 w-8 border-0 bg-transparent px-0 text-right text-sm tabular-nums shadow-none focus-visible:ring-1"
                aria-label={`Số lượng ${row.name}`}
              />
            )}
            <button
              type="button"
              className="ml-0.5 text-xs text-muted-foreground/45 hover:text-foreground"
              title={row.order_mode === "money" ? "Đổi sang đơn vị đo" : "Đặt theo số tiền"}
              aria-label={row.order_mode === "money" ? "Đơn vị: đồng. Bấm để đổi sang đo lường" : `Đơn vị: ${row.unit}. Bấm để đặt theo tiền`}
              onClick={() => {
                if (row.order_mode === "money") {
                  onUpdate({ order_mode: "measure" });
                  return;
                }
                const qty = Number(row.quantity) || 0;
                const price = Number(row.reference_price) || 0;
                const seeded = qty > 0 && price > 0 ? qty * price : draftMoneyVnd(row);
                onUpdate({
                  order_mode: "money",
                  money_amount: seeded ? moneyAmountToDraft(seeded) : row.money_amount || "",
                });
              }}
            >
              {row.order_mode === "money" ? "₫" : row.unit}
            </button>
          </div>
          <div className="w-[4.5rem] shrink-0 text-right">
            {confirming ? (
              <button
                type="button"
                className="text-xs font-semibold px-3 py-1 rounded-full bg-destructive text-destructive-foreground active:brightness-90"
                aria-label={`Xóa ${row.name}`}
                onClick={e => {
                  e.stopPropagation();
                  onRemove();
                  cancelConfirm();
                }}
              >
                Xóa
              </button>
            ) : estimate != null ? (
              <MoneyLabel
                amount={estimate}
                className="text-sm font-display text-foreground/90"
                smallClassName="text-[0.7em]"
              />
            ) : (
              <span className="text-[11px] text-muted-foreground/40">—</span>
            )}
          </div>
        </div>
      </div>
      {expanded && chipCloud}
    </>
  );
}

export default function OrderDetail() {
  const { id: routeId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const preferredCatKey = searchParams.get("cat") || "";
  const { user } = useAuth();
  const navigate = useNavigate();
  const isNewSession = routeId === "new";
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("draft");
  const [shareToken, setShareToken] = useState("");
  const [pin, setPin] = useState("1234");
  const [items, setItems] = useState<OrderItemDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareStep, setShareStep] = useState<"pin" | "qr">("pin");
  const [catalog, setCatalog] = useState<CatalogIngredient[]>([]);
  const [catalogCats, setCatalogCats] = useState<CatalogCategory[]>([]);
  const [lockedCatId, setLockedCatId] = useState<string>("");
  const [ingSearch, setIngSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [chipPage, setChipPage] = useState(0);
  /** Which list slot shows the ingredient cloud: item index, or `ph-${n}` for empty slots. */
  const [expandedKey, setExpandedKey] = useState<string>("ph-0");
  const chipPagerRef = useRef<HTMLDivElement>(null);
  /** Real DB id once the first ingredient was saved; null while UI-only draft. */
  const [orderId, setOrderId] = useState<string | null>(isNewSession ? null : routeId || null);
  const orderIdRef = useRef<string | null>(orderId);
  const persistingRef = useRef(false);
  const justCreatedIdRef = useRef<string | null>(null);
  const draftTitleReadyRef = useRef(false);
  const [identity, setIdentity] = useState<{
    customer_name?: string | null;
    created_at?: string | null;
    day_seq?: number | null;
    mgmt_id?: string | null;
  }>({});

  useEffect(() => {
    orderIdRef.current = orderId;
  }, [orderId]);

  const loadExisting = useCallback(async (existingId: string) => {
    if (!user) return;
    setLoading(true);
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", existingId)
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
    setOrderId(order.id);
    setIdentity({
      customer_name: order.customer_name,
      created_at: order.created_at,
      day_seq: order.day_seq,
      mgmt_id: order.mgmt_id,
    });
    const { data: rows } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", existingId)
      .order("sort_order", { ascending: true });
    setItems(
      (rows || [])
        .filter(r => !r.is_alternate)
        .map((r, i) => {
        const money = r.order_mode === "money";
        return {
          id: r.id,
          name: r.name,
          quantity: String(r.quantity),
          unit: r.unit,
          sort_order: r.sort_order ?? i,
          order_mode: money ? "money" : "measure",
          money_amount: money ? moneyAmountToDraft(Number(r.money_amount) || 0) : "",
          notice: r.notice ?? "",
        };
      }),
    );
    setLoading(false);
  }, [user, navigate]);

  useEffect(() => {
    if (!user || !routeId) return;
    if (routeId === "new") {
      draftTitleReadyRef.current = false;
      setOrderId(null);
      orderIdRef.current = null;
      setItems([]);
      setShareToken("");
      setStatus("draft");
      setTitle("");
      setIdentity({});
      setExpandedKey("ph-0");
      setLoading(false);
      return;
    }
    if (justCreatedIdRef.current === routeId) {
      justCreatedIdRef.current = null;
      setOrderId(routeId);
      orderIdRef.current = routeId;
      setLoading(false);
      return;
    }
    void loadExisting(routeId);
  }, [user, routeId, loadExisting]);

  const loadCatalog = useCallback(async () => {
    if (!user) return;
    const [cats, ings] = await Promise.all([
      supabase
        .from("order_categories")
        .select("id, name, sort_order, source_key")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("order_ingredients")
        .select(
          "id, name, unit, category_id, subcategory, reference_price, quick_quantities, order_count",
        )
        .eq("user_id", user.id)
        .order("name", { ascending: true }),
    ]);
    const nextCats = (cats.data as CatalogCategory[]) || [];
    setCatalogCats(nextCats);
    if (ings.data) {
      setCatalog(
        (ings.data as any[]).map(r => ({
          ...r,
          order_count: typeof r.order_count === "number" ? r.order_count : 0,
          quick_quantities: Array.isArray(r.quick_quantities) ? r.quick_quantities : [],
        })),
      );
    } else {
      setCatalog([]);
    }

    const preferred = preferredCatKey
      ? nextCats.find(c => c.source_key === preferredCatKey)
      : null;
    setLockedCatId(preferred?.id || nextCats[0]?.id || "");
  }, [user, preferredCatKey]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const shareUrl = useMemo(
    () => (shareToken ? orderShareUrl(shareToken) : ""),
    [shareToken],
  );

  const lockedCat = catalogCats.find(c => c.id === lockedCatId);
  const lockedCatName = lockedCat?.name || "Danh mục";

  const topFrequentNames = useMemo(
    () => topFrequentNamesForCategory(catalog, lockedCatId),
    [catalog, lockedCatId],
  );

  useEffect(() => {
    if (routeId !== "new" || draftTitleReadyRef.current) return;
    if (!lockedCat?.name) return;
    draftTitleReadyRef.current = true;
    setTitle(`Đơn ${lockedCat.name} · ${format(new Date(), "d/M HH:mm")}`);
  }, [routeId, lockedCat?.name]);

  const addedByName = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((row, i) => map.set(row.name.trim().toLowerCase(), i));
    return map;
  }, [items]);

  const activeIngredients = useMemo(() => {
    if (!lockedCatId) return [];
    const q = ingSearch.trim().toLowerCase();
    return catalog.filter(ing => {
      if (ing.category_id !== lockedCatId) return false;
      if (q && !ing.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [catalog, lockedCatId, ingSearch]);

  const groupedIngredients = useMemo(() => {
    const groups = new Map<string, CatalogIngredient[]>();
    for (const ing of activeIngredients) {
      const key = ing.subcategory || "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ing);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b, "vi"));
  }, [activeIngredients]);

  const ingredientPages = useMemo(() => {
    const hasSubs =
      groupedIngredients.length > 1 ||
      groupedIngredients.some(([sub]) => Boolean(sub));

    const chunk = (title: string, ings: CatalogIngredient[]) => {
      const pages: { title: string; ings: CatalogIngredient[] }[] = [];
      for (let i = 0; i < ings.length; i += CHIP_PAGE_SIZE) {
        pages.push({ title, ings: ings.slice(i, i + CHIP_PAGE_SIZE) });
      }
      return pages;
    };

    if (hasSubs) {
      return groupedIngredients.flatMap(([sub, ings]) => chunk(sub, ings));
    }

    const pages = chunk("", activeIngredients);
    return pages.length > 0 ? pages : [{ title: "", ings: [] }];
  }, [groupedIngredients, activeIngredients]);

  useEffect(() => {
    setChipPage(0);
    chipPagerRef.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [lockedCatId, ingSearch]);

  const settleChipPage = useCallback(() => {
    const el = chipPagerRef.current;
    if (!el || el.clientWidth <= 0) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    setChipPage(Math.max(0, Math.min(next, ingredientPages.length - 1)));
  }, [ingredientPages.length]);

  const priceByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const ing of catalog) {
      if (ing.reference_price != null && Number(ing.reference_price) > 0) {
        map.set(ing.name.trim().toLowerCase(), Number(ing.reference_price));
      }
    }
    return map;
  }, [catalog]);

  const lineEstimate = (row: OrderItemDraft) => {
    if (row.order_mode === "money") {
      const vnd = draftMoneyVnd(row);
      return vnd > 0 ? vnd : null;
    }
    const qty = Number(row.quantity) || 0;
    const price =
      row.reference_price != null && Number(row.reference_price) > 0
        ? Number(row.reference_price)
        : priceByName.get(row.name.trim().toLowerCase());
    if (!price || qty <= 0) return null;
    return qty * price;
  };

  // Keep spare empty rows under the list; always at least one so you can add more
  const emptyPlaceholderCount = Math.max(1, PLACEHOLDER_SLOTS - items.length);

  useEffect(() => {
    // Keep expansion on a valid slot after items / placeholder count change
    if (expandedKey.startsWith("item-")) {
      const idx = Number(expandedKey.slice(5));
      if (!Number.isFinite(idx) || idx < 0 || idx >= items.length) {
        setExpandedKey(items.length === 0 ? "ph-0" : `item-${Math.max(0, items.length - 1)}`);
      }
      return;
    }
    if (expandedKey.startsWith("ph-")) {
      const idx = Number(expandedKey.slice(3));
      if (!Number.isFinite(idx) || idx < 0 || idx >= emptyPlaceholderCount) {
        setExpandedKey("ph-0");
      }
    }
  }, [items.length, expandedKey, emptyPlaceholderCount]);

  const expandSlot = useCallback((key: string) => {
    setExpandedKey(key);
    setIngSearch("");
    setChipPage(0);
    requestAnimationFrame(() => {
      chipPagerRef.current?.scrollTo({ left: 0, behavior: "auto" });
    });
  }, []);

  const persistDraftRows = async (oid: string, rows: OrderItemDraft[]) => {
    const cleaned = rows
      .map((row, i) => {
        const money = row.order_mode === "money";
        return {
          name: row.name.trim(),
          order_mode: money ? "money" : "measure",
          money_amount: money ? draftMoneyVnd(row) : null,
          quantity: money ? 1 : Number(row.quantity) || 0,
          unit: row.unit || "kg",
          notice: row.notice?.trim() || null,
          sort_order: i,
        };
      })
      .filter(row =>
        row.name && (row.order_mode === "money" ? (row.money_amount ?? 0) > 0 : row.quantity > 0),
      );
    await supabase.from("order_items").delete().eq("order_id", oid).eq("is_alternate", false);
    if (cleaned.length === 0) return;
    const { error } = await supabase.from("order_items").insert(
      cleaned.map(row => ({
        order_id: oid,
        name: row.name,
        quantity: row.quantity,
        unit: row.unit,
        sort_order: row.sort_order,
        status: "pending",
        order_mode: row.order_mode,
        money_amount: row.money_amount,
        notice: row.notice,
      })),
    );
    if (error) throw error;
  };

  /** Create the order in DB on first real line; no-op if already persisted. */
  const ensurePersisted = useCallback(
    async (rows: OrderItemDraft[]) => {
      if (!user) return null;
      if (orderIdRef.current) return orderIdRef.current;
      const cleaned = rows.filter(draftHasAmount);
      if (cleaned.length === 0) return null;
      if (persistingRef.current) return orderIdRef.current;
      persistingRef.current = true;
      try {
        const token = generateShareToken();
        const { data, error } = await supabase
          .from("orders")
          .insert({
            user_id: user.id,
            title: title.trim() || `Đơn ${lockedCatName} · ${format(new Date(), "d/M HH:mm")}`,
            customer_name: customerNameFromUser(user),
            status: "draft",
            share_token: token,
            supplier_pin_hash: await hashPin(pin || "1234"),
          })
          .select("id, share_token, customer_name, created_at, day_seq, mgmt_id")
          .single();
        if (error) throw error;
        await persistDraftRows(data.id, rows);
        orderIdRef.current = data.id;
        setOrderId(data.id);
        setShareToken(data.share_token || token);
        setIdentity({
          customer_name: data.customer_name,
          created_at: data.created_at,
          day_seq: data.day_seq,
          mgmt_id: data.mgmt_id,
        });
        justCreatedIdRef.current = data.id;
        const catQ = preferredCatKey ? `?cat=${encodeURIComponent(preferredCatKey)}` : "";
        navigate(`/orders/${data.id}${catQ}`, { replace: true });
        void loadCatalog();
        return data.id;
      } catch (err: any) {
        toast.error(err.message || "Không lưu được đơn");
        return null;
      } finally {
        persistingRef.current = false;
      }
    },
    [user, title, lockedCatName, pin, preferredCatKey, navigate, loadCatalog],
  );

  /** If every line is gone, drop the DB row and return to a UI-only draft. */
  const abandonEmptyOrder = useCallback(async () => {
    const oid = orderIdRef.current;
    if (!user || !oid) return;
    try {
      await supabase.from("order_items").delete().eq("order_id", oid);
      await supabase.from("orders").delete().eq("id", oid).eq("user_id", user.id);
    } catch {
      /* best-effort */
    }
    orderIdRef.current = null;
    setOrderId(null);
    setShareToken("");
    setStatus("draft");
    const catQ = preferredCatKey ? `?cat=${encodeURIComponent(preferredCatKey)}` : "";
    navigate(`/orders/new${catQ}`, { replace: true });
  }, [user, preferredCatKey, navigate]);

  const syncItemsSideEffects = useCallback(
    (next: OrderItemDraft[]) => {
      const hasLines = next.some(r => r.name.trim());
      if (hasLines) {
        const alreadyPersisted = !!orderIdRef.current;
        void ensurePersisted(next).then(oid => {
          if (oid && alreadyPersisted) {
            void persistDraftRows(oid, next)
              .then(() => loadCatalog())
              .catch(() => {
                /* silent — explicit Lưu still available */
              });
          }
        });
      } else if (orderIdRef.current) {
        void abandonEmptyOrder();
      }
    },
    [ensurePersisted, abandonEmptyOrder, loadCatalog],
  );

  const pickIngredientForExpanded = (ing: CatalogIngredient) => {
    const key = ing.name.trim().toLowerCase();
    const entry: OrderItemDraft = {
      name: ing.name,
      quantity: defaultQty(ing),
      unit: ing.unit || "kg",
      sort_order: 0,
      catalog_id: ing.id,
      reference_price: ing.reference_price,
      order_mode: "measure",
      money_amount: "",
      notice: "",
    };

    if (expandedKey.startsWith("item-")) {
      const idx = Number(expandedKey.slice(5));
      setItems(prev => {
        if (idx < 0 || idx >= prev.length) return prev;
        let next: OrderItemDraft[];
        if (prev[idx].name.trim().toLowerCase() === key) {
          next = prev.filter((_, i) => i !== idx).map((row, i) => ({ ...row, sort_order: i }));
        } else {
          const withoutOtherDup = prev.filter(
            (row, i) => i === idx || row.name.trim().toLowerCase() !== key,
          );
          const at = Math.min(idx, withoutOtherDup.length - 1);
          next = withoutOtherDup.map((row, i) =>
            i === at
              ? { ...entry, id: prev[idx].id, sort_order: i }
              : { ...row, sort_order: i },
          );
        }
        queueMicrotask(() => syncItemsSideEffects(next));
        return next;
      });
      return;
    }

    setItems(prev => {
      const withoutDup = prev.filter(row => row.name.trim().toLowerCase() !== key);
      const next = [...withoutDup, { ...entry, sort_order: withoutDup.length }];
      queueMicrotask(() => {
        syncItemsSideEffects(next);
        expandSlot("ph-0");
      });
      return next;
    });
  };

  const renderChipCloud = () => (
    <div className="bg-muted/20 px-3 py-2">
      <div className="mb-2 flex items-center gap-2">
        <Input
          value={ingSearch}
          onChange={e => setIngSearch(e.target.value)}
          placeholder="Lọc…"
          className="h-8 flex-1 text-xs"
          onClick={e => e.stopPropagation()}
        />
      </div>
      {ingredientPages.every(p => p.ings.length === 0) ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Không có nguyên liệu trong danh mục này
        </p>
      ) : (
        <>
          {ingredientPages.length > 1 && (
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[10px] text-muted-foreground">
                {ingredientPages[chipPage]?.title
                  ? ingredientPages[chipPage].title
                  : `Trang ${chipPage + 1}/${ingredientPages.length}`}
              </p>
              <div className="flex items-center gap-1" aria-hidden="true">
                {ingredientPages.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 rounded-full transition-all ${
                      i === chipPage ? "w-3.5 bg-primary/70" : "w-1 bg-border"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
          <div
            ref={chipPagerRef}
            className="ingredient-chip-pager"
            onScroll={settleChipPage}
            onTouchEnd={settleChipPage}
            aria-label="Danh sách nguyên liệu"
          >
            {ingredientPages.map((page, pageIdx) => (
              <div key={page.title || `page-${pageIdx}`} className="ingredient-chip-page">
                <div className="ingredient-chip-track">
                  {page.ings.map(ing => {
                    const selected = addedByName.has(ing.name.trim().toLowerCase());
                    const isActiveRow =
                      expandedKey.startsWith("item-") &&
                      items[Number(expandedKey.slice(5))]?.name.trim().toLowerCase() ===
                        ing.name.trim().toLowerCase();
                    const dotClass = frequentIngredientDotClass(ing.name, topFrequentNames);
                    return (
                      <button
                        key={ing.id}
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          pickIngredientForExpanded(ing);
                        }}
                        className={`inline-flex w-full min-w-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                          isActiveRow || selected
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border/70 bg-background text-foreground hover:border-primary/40"
                        }`}
                      >
                        {(isActiveRow || selected) && (
                          <Check className="h-3 w-3 text-primary shrink-0" />
                        )}
                        {dotClass && (
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`}
                            aria-hidden="true"
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate">{ing.name}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground/55">
                          {ing.unit}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {ingredientPages.length > 1 && (
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground/70">
              Vuốt ngang để xem thêm
            </p>
          )}
        </>
      )}
    </div>
  );

  const updateRow = (index: number, patch: Partial<OrderItemDraft>) => {
    setItems(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    setItems(prev => {
      const next = prev.filter((_, i) => i !== index).map((row, i) => ({ ...row, sort_order: i }));
      queueMicrotask(() => syncItemsSideEffects(next));
      return next;
    });
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

  const save = async (nextStatus?: string, pinOverride?: string) => {
    if (!user) return false;
    const cleaned = items.filter(draftHasAmount);

    if (cleaned.length === 0) {
      toast.error("Chọn ít nhất một nguyên liệu");
      return false;
    }

    setSaving(true);
    try {
      let oid = orderIdRef.current;
      if (!oid) {
        oid = await ensurePersisted(items);
        if (!oid) return false;
      }

      const pinHash = await hashPin((pinOverride ?? pin) || "1234");
      const { error: orderErr } = await supabase
        .from("orders")
        .update({
          title: title.trim() || "Đơn hàng",
          status: nextStatus || status,
          supplier_pin_hash: pinHash,
          updated_at: new Date().toISOString(),
        })
        .eq("id", oid)
        .eq("user_id", user.id);
      if (orderErr) throw orderErr;

      await persistDraftRows(oid, items);

      if (nextStatus) setStatus(nextStatus);
      toast.success("Đã lưu");
      return true;
    } catch (err: any) {
      toast.error(err.message || "Lưu thất bại");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openShareFlow = () => {
    if (items.filter(draftHasAmount).length === 0) {
      toast.error("Chọn ít nhất một nguyên liệu");
      return;
    }
    setShareStep("pin");
    setShareOpen(true);
  };

  const confirmPinAndShare = async () => {
    const trimmed = (pin || "").trim();
    if (trimmed.length < 4) {
      toast.error("PIN cần ít nhất 4 số");
      return;
    }
    const ok = await save("shared", trimmed);
    if (!ok) return;
    const oid = orderIdRef.current;
    if (!shareToken && oid) {
      const token = generateShareToken();
      await supabase.from("orders").update({ share_token: token }).eq("id", oid);
      setShareToken(token);
    }
    setShareStep("qr");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Đã copy link");
    } catch {
      toast.error("Không copy được");
    }
  };

  const openVendorPreview = async () => {
    const oid = orderIdRef.current;
    if (!oid) {
      toast.error("Lưu đơn trước đã");
      return;
    }
    if (status !== "shared" && status !== "closed") {
      const ok = await save("shared");
      if (!ok) return;
    }
    let token = shareToken;
    if (!token) {
      token = generateShareToken();
      const { error } = await supabase.from("orders").update({ share_token: token }).eq("id", oid);
      if (error) {
        toast.error(error.message);
        return;
      }
      setShareToken(token);
    }
    markOrderPinUnlocked(token);
    setShareOpen(false);
    navigate(`/o/${token}?from=${oid}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Đang tải…
      </div>
    );
  }

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
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg text-foreground">
              {identity.customer_name?.trim() || customerNameFromUser(user)}
            </h1>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {orderIdentityLine(identity) ||
                [formatOrderDay(new Date().toISOString()), lockedCatName && `Danh mục: ${lockedCatName}`]
                  .filter(Boolean)
                  .join(" · ")}
            </p>
          </div>
          {orderId && (
            <button
              type="button"
              onClick={() => void openVendorPreview()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Xem như nhà cung cấp"
            >
              <Store className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-4">
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
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 border-b border-border/50 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>Nguyên liệu</span>
              <span className="w-[3.25rem] text-right">SL</span>
              <span className="w-[4.5rem] text-right">Ước tính</span>
            </div>
            {items.map((row, index) => {
              const key = `item-${index}`;
              const expanded = expandedKey === key;
              return (
                <div key={row.id || key} className="border-b border-border/40 last:border-b-0">
                  <OrderFilledRow
                    row={row}
                    expanded={expanded}
                    estimate={lineEstimate(row)}
                    chipCloud={expanded ? renderChipCloud() : null}
                    onExpand={() => expandSlot(key)}
                    onUpdate={patch => updateRow(index, patch)}
                    onCommitNotice={notice => {
                      setItems(prev => {
                        const next = prev.map((row, i) =>
                          i === index ? { ...row, notice } : row,
                        );
                        queueMicrotask(() => syncItemsSideEffects(next));
                        return next;
                      });
                    }}
                    onRemove={() => removeRow(index)}
                  />
                </div>
              );
            })}
            {Array.from({ length: emptyPlaceholderCount }).map((_, i) => {
              const key = `ph-${i}`;
              const expanded = expandedKey === key;
              return (
                <div key={key} className="border-b border-border/40 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => expandSlot(key)}
                    className={`grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-1.5 text-left ${
                      expanded ? "bg-primary/5" : "hover:bg-muted/30"
                    }`}
                  >
                    <p className="min-w-0 truncate text-sm text-muted-foreground/35">
                      Tên nguyên liệu
                    </p>
                    <div className="flex shrink-0 items-baseline">
                      <span className="inline-flex h-7 w-8 items-center justify-end text-sm tabular-nums text-muted-foreground/30">
                        0
                      </span>
                      <span className="ml-0.5 text-xs text-muted-foreground/25">đv</span>
                    </div>
                    <span className="w-[4.5rem] shrink-0 text-right text-[11px] text-muted-foreground/25">
                      —
                    </span>
                  </button>
                  {expanded && renderChipCloud()}
                </div>
              );
            })}
          </div>
        )}
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
            onClick={openShareFlow}
          >
            <QrCode className="h-4 w-4" />
            Link & QR
          </Button>
        </div>
      </div>

      <Dialog
        open={shareOpen}
        onOpenChange={open => {
          setShareOpen(open);
          if (!open) setShareStep("pin");
        }}
      >
        <DialogContent className="max-w-[92vw] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">
              {shareStep === "pin" ? "Đặt PIN nhà cung cấp" : "Gửi nhà cung cấp"}
            </DialogTitle>
          </DialogHeader>

          {shareStep === "pin" ? (
            <div className="space-y-4 py-1">
              <p className="text-xs text-muted-foreground">
                Người nhận cần PIN này để mở và cập nhật đơn. Mặc định 1234.
              </p>
              <Input
                type="text"
                inputMode="numeric"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="1234"
                className="h-11 text-center text-lg tracking-[0.35em]"
                maxLength={8}
                autoFocus
              />
              <Button
                type="button"
                className="w-full"
                disabled={saving}
                onClick={confirmPinAndShare}
              >
                {saving ? "Đang tạo…" : "Tạo link & QR"}
              </Button>
            </div>
          ) : (
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
              <Button type="button" variant="outline" onClick={() => void openVendorPreview()} className="w-full gap-2">
                <Store className="h-4 w-4" />
                Xem như nhà cung cấp
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
