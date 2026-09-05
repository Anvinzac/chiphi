import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ClipboardPaste, Copy, QrCode, Send, Store } from "lucide-react";
import DatSiStall from "@/components/orders/DatSiStall";
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
import { Textarea } from "@/components/ui/textarea";
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
import { isKitchenAccount, resolveCatalogOwnerId } from "@/lib/kitchenAccount";
import { foldCategoryName } from "@/lib/categoryVisuals";
import { parseOrderText } from "@/lib/parseOrderText";

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

function draftLine(draft: OrderItemDraft): string {
  return draft.order_mode === "money"
    ? `${draft.money_amount}k ${draft.name}`.trim()
    : `${draft.quantity}${draft.unit} ${draft.name}`.trim();
}


export default function OrderDetail() {
  const { id: routeId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const preferredCatKey = searchParams.get("cat") || "";
  const { user } = useAuth();
  const navigate = useNavigate();
  const kitchen = isKitchenAccount(user?.email);
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
  const [pasteText, setPasteText] = useState("");
  const [pasteApplying, setPasteApplying] = useState(false);
  const pasteFieldRef = useRef<HTMLTextAreaElement>(null);
  const [numpadIng, setNumpadIng] = useState<CatalogIngredient | null>(null);
  const [numpadValue, setNumpadValue] = useState("");
  const [numpadMode, setNumpadMode] = useState<OrderMode>("measure");
  const [numpadUnit, setNumpadUnit] = useState("kg");
  const numpadTypingRef = useRef(false);
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
    let order: any = null;
    let error: any = null;
    // Try with customer_name etc., fallback if columns missing (migration not yet applied)
    const trySelect = async (cols: string) => {
      const res = await supabase.from("orders").select(cols).eq("id", existingId).eq("user_id", user.id).maybeSingle();
      return res;
    };
    const resAll = await trySelect("*");
    if (resAll.error && String(resAll.error.message).includes("customer_name")) {
      const fallback = await trySelect("id, title, status, share_token, created_at");
      order = fallback.data;
      error = fallback.error;
    } else {
      order = resAll.data;
      error = resAll.error;
    }
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
      customer_name: order.customer_name ?? null,
      created_at: order.created_at,
      day_seq: order.day_seq ?? null,
      mgmt_id: order.mgmt_id ?? null,
    });
    const { data: rows } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", existingId)
      .order("sort_order", { ascending: true });
    const nextItems: OrderItemDraft[] = (rows || [])
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
      });
    setItems(nextItems);
    setPasteText(nextItems.map(draftLine).filter(Boolean).join("\n"));
    setPasteFromStall(true);
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
    const catalogOwnerId = await resolveCatalogOwnerId(user.id, user.email);
    const [cats, ings] = await Promise.all([
      supabase
        .from("order_categories")
        .select("id, name, sort_order, source_key")
        .eq("user_id", catalogOwnerId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("order_ingredients")
        .select(
          "id, name, unit, category_id, subcategory, reference_price, quick_quantities, order_count",
        )
        .eq("user_id", catalogOwnerId)
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

  const parsedPaste = useMemo(
    () => parseOrderText(pasteText, catalog),
    [pasteText, catalog],
  );
  const pasteNewCount = parsedPaste.filter(l => !l.matched).length;

  const activeIngredients = useMemo(() => {
    if (!lockedCatId) return [];
    const q = ingSearch.trim().toLowerCase();
    return catalog.filter(ing => {
      if (ing.category_id !== lockedCatId) return false;
      if (q && !ing.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [catalog, lockedCatId, ingSearch]);

  const pickedLabel = useCallback(
    (name: string) => {
      const idx = addedByName.get(name.trim().toLowerCase());
      if (idx == null) return null;
      const row = items[idx];
      if (!row) return null;
      return row.order_mode === "money" ? `${row.money_amount}k` : `${row.quantity}${row.unit}`;
    },
    [addedByName, items],
  );

  const openNumpadFor = useCallback((ing: CatalogIngredient) => {
    const existing = items.find(r => r.name.trim().toLowerCase() === ing.name.trim().toLowerCase());
    if (existing) {
      setNumpadIng(ing);
      setNumpadMode(existing.order_mode || "measure");
      if (existing.order_mode === "money") {
        setNumpadUnit("k");
        setNumpadValue(existing.money_amount ?? "");
      } else {
        setNumpadUnit(existing.unit || ing.unit || "kg");
        setNumpadValue(existing.quantity ?? "");
      }
    } else {
      setNumpadIng(ing);
      setNumpadMode("measure");
      setNumpadUnit(ing.unit || "kg");
      setNumpadValue("");
    }
    numpadTypingRef.current = false;
  }, [items]);

  const closeNumpad = useCallback(() => {
    setNumpadIng(null);
    setNumpadValue("");
    numpadTypingRef.current = false;
  }, []);

  const numpadDigit = (d: string) => {
    const fresh = !numpadTypingRef.current;
    numpadTypingRef.current = true;
    setNumpadValue(prev => {
      if (fresh) return d;
      if (prev.length >= 6) return prev;
      if (prev === "0") return d;
      return prev + d;
    });
  };

  const numpadBackspace = () => {
    setNumpadValue(prev => {
      const next = prev.slice(0, -1);
      if (next === "") numpadTypingRef.current = false;
      return next;
    });
  };

  const numpadClear = () => {
    setNumpadValue("");
    numpadTypingRef.current = false;
  };

  const numpadUnitChoices = useMemo(() => {
    if (!numpadIng) return [] as string[];
    const base = numpadIng.unit || "kg";
    const extras = base === "kg" ? ["k"] : ["kg", "k"];
    return [base, ...extras.filter(u => u !== base)];
  }, [numpadIng]);

  const cycleNumpadUnit = () => {
    if (numpadUnit === "k") {
      setNumpadUnit(numpadIng?.unit || "kg");
      setNumpadMode("measure");
      return;
    }
    const idx = numpadUnitChoices.indexOf(numpadUnit);
    const next = idx >= 0 && idx + 1 < numpadUnitChoices.length ? numpadUnitChoices[idx + 1] : "k";
    setNumpadUnit(next);
    setNumpadMode(next === "k" ? "money" : "measure");
  };

  const appendPastedLine = (draft: OrderItemDraft) => {
    const line = draftLine(draft);
    setPasteFromStall(true);
    setPasteText(prev => (prev.trim() ? `${prev.trimEnd()}\n${line}` : line));
  };

  const confirmNumpad = () => {
    if (!numpadIng) return;
    const raw = numpadValue.trim();
    if (!raw || Number(raw) <= 0) {
      const idx = items.findIndex(r => r.name.trim().toLowerCase() === numpadIng.name.trim().toLowerCase());
      if (idx >= 0) {
        setItems(prev => {
          const next = prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, sort_order: i }));
          queueMicrotask(() => syncItemsSideEffects(next));
          return next;
        });
      }
      closeNumpad();
      return;
    }
    const draft: OrderItemDraft = {
      name: numpadIng.name,
      quantity: numpadMode === "measure" ? raw : "",
      unit: numpadMode === "measure" ? numpadUnit : numpadIng.unit || "kg",
      sort_order: 0,
      catalog_id: numpadIng.id,
      reference_price: numpadIng.reference_price,
      order_mode: numpadMode,
      money_amount: numpadMode === "money" ? raw : "",
      notice: "",
    };
    const key = numpadIng.name.trim().toLowerCase();
    const existsIdx = items.findIndex(r => r.name.trim().toLowerCase() === key);
    if (existsIdx >= 0) {
      setItems(prev => {
        const next = prev.map((r, i) => i === existsIdx ? { ...r, ...draft, id: r.id, sort_order: i } : r);
        queueMicrotask(() => syncItemsSideEffects(next));
        return next;
      });
    } else {
      setItems(prev => {
        const next = [...prev, { ...draft, sort_order: prev.length }];
        queueMicrotask(() => syncItemsSideEffects(next));
        return next;
      });
    }
    appendPastedLine(draft);
    closeNumpad();
  };

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
        let data: any = null;
        let error: any = null;
        // Try with customer_name etc., fallback if columns missing (migration not applied)
        const tryInsert = async (withCustomer: boolean) => {
          const payload: Record<string, unknown> = {
            user_id: user.id,
            title: title.trim() || `Đơn ${lockedCatName} · ${format(new Date(), "d/M HH:mm")}`,
            status: "draft",
            share_token: token,
            supplier_pin_hash: await hashPin(pin || "1234"),
          };
          if (withCustomer) payload.customer_name = customerNameFromUser(user);
          const cols = withCustomer
            ? "id, share_token, customer_name, created_at, day_seq, mgmt_id"
            : "id, share_token, created_at";
          return await supabase.from("orders").insert(payload as any).select(cols).single();
        };
        const res1 = await tryInsert(true);
        if (res1.error && String(res1.error.message).includes("customer_name")) {
          const res2 = await tryInsert(false);
          data = res2.data;
          error = res2.error;
        } else {
          data = res1.data;
          error = res1.error;
        }
        if (error) throw error;
        await persistDraftRows(data.id, rows);
        orderIdRef.current = data.id;
        setOrderId(data.id);
        setShareToken(data.share_token || token);
        setIdentity({
          customer_name: data.customer_name ?? customerNameFromUser(user),
          created_at: data.created_at,
          day_seq: data.day_seq ?? null,
          mgmt_id: data.mgmt_id ?? null,
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

  const applyPastedLines = async () => {
    if (!user || parsedPaste.length === 0) return;
    if (!lockedCatId) {
      toast.error("Chưa có danh mục để thêm nguyên liệu mới");
      return;
    }
    setPasteApplying(true);
    try {
      type PasteIng = {
        id: string;
        name: string;
        unit: string;
        reference_price: number | null;
      };
      const byFold = new Map<string, PasteIng>();
      for (const ing of catalog) {
        const key = foldCategoryName(ing.name);
        if (!byFold.has(key)) {
          byFold.set(key, {
            id: ing.id,
            name: ing.name,
            unit: ing.unit,
            reference_price: ing.reference_price,
          });
        }
      }

      let createdCount = 0;
      const pending: { fold: string; name: string; unit: string }[] = [];
      const seenNew = new Set<string>();
      for (const line of parsedPaste) {
        if (line.matched) {
          byFold.set(foldCategoryName(line.name), line.matched);
          continue;
        }
        const fold = foldCategoryName(line.name);
        if (byFold.has(fold) || seenNew.has(fold)) continue;
        seenNew.add(fold);
        pending.push({
          fold,
          name: line.name,
          unit: line.mode === "measure" && line.unit ? line.unit : "kg",
        });
      }
      if (pending.length) {
        const { data, error } = await supabase
          .from("order_ingredients")
          .insert(
            pending.map(p => ({
              user_id: user.id,
              category_id: lockedCatId,
              name: p.name,
              unit: p.unit,
            })),
          )
          .select("id, name, unit, reference_price");
        if (error) throw error;
        createdCount = data?.length ?? 0;
        for (const row of data || []) {
          byFold.set(foldCategoryName(row.name), row as PasteIng);
        }
      }

      const next = [...items];
      const indexByFold = new Map<string, number>();
      next.forEach((row, i) => {
        const key = foldCategoryName(row.name);
        if (key && !indexByFold.has(key)) indexByFold.set(key, i);
      });

      for (const line of parsedPaste) {
        const fold = foldCategoryName(line.name);
        const ing = byFold.get(fold);
        const existingIdx = indexByFold.get(fold);
        const draft: OrderItemDraft = {
          name: ing?.name ?? line.name,
          quantity: line.mode === "measure" ? line.quantity : "",
          unit: line.mode === "measure" ? (line.unit || ing?.unit || "kg") : (ing?.unit || "kg"),
          sort_order: existingIdx != null ? next[existingIdx].sort_order : next.length,
          catalog_id: ing?.id,
          reference_price: ing?.reference_price ?? null,
          order_mode: line.mode,
          money_amount: line.mode === "money" ? line.moneyThousands : "",
        };
        if (existingIdx != null) {
          next[existingIdx] = { ...next[existingIdx], ...draft };
        } else {
          indexByFold.set(fold, next.length);
          next.push(draft);
        }
      }

      setItems(next);
      setPasteFromStall(true);
      syncItemsSideEffects(next);
      if (createdCount) await loadCatalog();
      toast.success(`Đã thêm ${parsedPaste.length} dòng`, {
        description: createdCount
          ? `${createdCount} nguyên liệu mới vào danh mục`
          : undefined,
      });
    } catch (e) {
      toast.error("Không dán được đơn", {
        description: e instanceof Error ? e.message : "Thử lại sau.",
      });
    } finally {
      setPasteApplying(false);
    }
  };

  const pastedLines = useMemo(
    () => pasteText.split("\n").filter(l => l.trim()),
    [pasteText],
  );
  const hasPastedLines = pastedLines.length > 0;
  const [editingPasted, setEditingPasted] = useState(false);
  const [pasteFromStall, setPasteFromStall] = useState(false);
  const pastableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingPasted) return;
    const el = pastableRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight - el.clientHeight;
      el.scrollLeft = el.scrollWidth - el.clientWidth;
    });
  }, [pasteText, editingPasted]);

  useEffect(() => {
    if (editingPasted) pasteFieldRef.current?.focus();
  }, [editingPasted]);

  const handleCopyPasted = async () => {
    const text = pasteText.trim();
    if (!text) {
      toast.error("Chưa có gì để copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Đã copy đơn");
    } catch {
      toast.error("Không copy được");
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.error("Clipboard trống");
        return;
      }
      setPasteFromStall(false);
      setPasteText(prev => (prev.trim() ? `${prev.trimEnd()}\n${text}` : text));
    } catch (err: unknown) {
      // Chrome blocks clipboard reads on the insecure contexts used for LAN
      // testing, so fall back to focusing the field for a manual paste.
      const message = err instanceof Error ? err.message : "Không đọc được clipboard";
      toast.error(message, { description: "Nhấn giữ ô dưới và chọn Paste." });
      pasteFieldRef.current?.focus();
    }
  };

  const numpadTitle = useMemo(() => {
    if (!numpadIng) return "";
    return numpadIng.name;
  }, [numpadIng]);

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

  const submitForApproval = async () => {
    const cleaned = items.filter(draftHasAmount);
    if (cleaned.length === 0) {
      toast.error("Chọn ít nhất một nguyên liệu");
      return;
    }

    setSaving(true);
    try {
      let oid = orderIdRef.current;
      const ok = await save();
      if (!ok) return;
      oid = orderIdRef.current;
      if (!oid) return;

      const { data, error } = await supabase.rpc("submit_order_for_approval", { p_order_id: oid });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data) {
        toast.error("Tài khoản bếp chưa được gán cho admin");
        return;
      }
      setStatus("pending");
      toast.success("Đã gửi duyệt");
      navigate("/orders");
    } catch (err: any) {
      toast.error(err.message || "Gửi duyệt thất bại");
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
    <div className="dat-si-page">
      <header className="dat-si-page__head">
        <div className="flex items-center gap-3">
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
                [formatOrderDay(new Date().toISOString()), lockedCatName && `Đặt sỉ · ${lockedCatName}`]
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
      </header>

      {catalogCats.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-xs text-muted-foreground">
            Chưa có danh mục / nguyên liệu. Nhập từ pantry để bắt đầu.
          </p>
          <Button type="button" size="sm" disabled={importing} onClick={runImport}>
            {importing ? "Đang nhập…" : "Nhập từ pantry"}
          </Button>
        </div>
      ) : (
        <>
          <section className="dat-si-phieu" aria-label="Phiếu đặt sỉ">
            <div className="dat-si-phieu__bar">
              <div className="min-w-0">
                <p className="dat-si-phieu__title">Phiếu {lockedCatName}</p>
                <p className="dat-si-phieu__hint">
                  {hasPastedLines
                    ? `${pastedLines.length} dòng · chạm để sửa`
                    : "10k = 10.000₫ · 10kg = khối lượng"}
                </p>
              </div>
              {hasPastedLines ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 text-xs"
                  onClick={() => void handleCopyPasted()}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 text-xs"
                  onClick={() => void pasteFromClipboard()}
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  Paste
                </Button>
              )}
            </div>
            {hasPastedLines && !editingPasted ? (
              <div
                ref={pastableRef}
                onClick={() => setEditingPasted(true)}
                className="dat-si-phieu__sheet"
                aria-live="polite"
                role="button"
                tabIndex={0}
                aria-label="Chạm để chỉnh sửa phiếu"
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setEditingPasted(true);
                  }
                }}
              >
                {pastedLines.map((line, idx) => (
                  <div key={idx} className="dat-si-phieu__line">
                    {line}
                  </div>
                ))}
              </div>
            ) : null}
            {!hasPastedLines && !editingPasted ? (
              <button
                type="button"
                className="dat-si-phieu__wake"
                onClick={() => setEditingPasted(true)}
              >
                Chạm để viết phiếu…
              </button>
            ) : null}
            {editingPasted && (
              <Textarea
                ref={pasteFieldRef}
                value={pasteText}
                onChange={e => {
                  setPasteFromStall(false);
                  setPasteText(e.target.value);
                }}
                onBlur={() => setEditingPasted(false)}
                placeholder={"Dán tin nhắn…\n10kg cà rốt\n10k lá quế"}
                className="dat-si-phieu__field focus-visible:ring-0 focus-visible:ring-offset-0"
                autoFocus
              />
            )}
            {parsedPaste.length > 0 && !pasteFromStall && (
              <Button
                type="button"
                size="sm"
                className="dat-si-phieu__apply"
                disabled={pasteApplying}
                onClick={() => void applyPastedLines()}
              >
                {pasteApplying
                  ? "Đang thêm…"
                  : pasteNewCount
                    ? `Thêm ${parsedPaste.length} dòng · ${pasteNewCount} mới`
                    : `Thêm ${parsedPaste.length} dòng`}
              </Button>
            )}
          </section>

          <DatSiStall
            ingredients={activeIngredients}
            searching={Boolean(ingSearch.trim())}
            search={ingSearch}
            onSearch={setIngSearch}
            pickedLabel={pickedLabel}
            frequentDot={name => frequentIngredientDotClass(name, topFrequentNames)}
            onPick={openNumpadFor}
          />
        </>
      )}

      <div className="dat-si-page__foot">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={saving}
            onClick={() => save()}
          >
            Lưu nháp
          </Button>
          {kitchen ? (
            <Button
              type="button"
              className="flex-1 gap-1.5"
              disabled={saving || status === "pending"}
              onClick={() => void submitForApproval()}
            >
              <Send className="h-4 w-4" />
              {status === "pending" ? "Đang chờ duyệt" : "Gửi duyệt"}
            </Button>
          ) : (
            <Button
              type="button"
              className="flex-1 gap-1.5"
              disabled={saving}
              onClick={openShareFlow}
            >
              <QrCode className="h-4 w-4" />
              Link & QR
            </Button>
          )}
        </div>
      </div>

      <Dialog open={numpadIng != null} onOpenChange={open => { if (!open) closeNumpad(); }}>
        <DialogContent className="max-w-[92vw] rounded-xl sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="font-display">{numpadTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
              <span className="text-sm tabular-nums font-medium">{numpadValue || "—"}</span>
              <button
                type="button"
                onClick={cycleNumpadUnit}
                className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/15"
              >
                {numpadUnit === "k" ? "k · 000₫" : numpadUnit}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["1","2","3","4","5","6","7","8","9"].map(d => (
                <button key={d} type="button" onClick={() => numpadDigit(d)} className="h-12 rounded-xl border border-border/60 bg-card text-lg font-medium shadow-sm active:scale-95">{d}</button>
              ))}
              <button type="button" onClick={numpadClear} className="h-12 rounded-xl border border-border/60 bg-muted/40 text-sm font-medium active:scale-95">C</button>
              <button type="button" onClick={() => numpadDigit("0")} className="h-12 rounded-xl border border-border/60 bg-card text-lg font-medium shadow-sm active:scale-95">0</button>
              <button type="button" onClick={numpadBackspace} className="h-12 rounded-xl border border-border/60 bg-muted/40 text-sm font-medium active:scale-95">⌫</button>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={closeNumpad}>Hủy</Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => { if (!numpadIng) return; const idx = items.findIndex(r => r.name.trim().toLowerCase() === numpadIng.name.trim().toLowerCase()); if (idx >= 0) { setItems(prev => { const next = prev.filter((_, i) => i !== idx).map((r,i)=>({...r, sort_order:i})); queueMicrotask(()=>syncItemsSideEffects(next)); return next; }); } closeNumpad(); }}>Xóa</Button>
              <Button type="button" className="flex-1" onClick={confirmNumpad}>Lưu</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
