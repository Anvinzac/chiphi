import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, Copy, Minus, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  isOrderPinUnlocked,
  markOrderPinUnlocked,
} from "@/lib/orderShare";
import { useHoldToConfirm } from "@/hooks/useHoldToConfirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MoneyLabel from "@/components/daily/MoneyLabel";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatOrderQty,
  isMoneyOrder,
  moneyAmountToDraft,
  storedQtyToDisplay,
  displayQtyToStored,
  formatQtyNumber,
} from "@/lib/formatOrderQty";
import { thousandsFromVnd, vndFromThousands } from "@/lib/vndThousands";
import { formatOrderSessionDay } from "@/lib/orderIdentity";
import { googleSumExpr } from "@/lib/googleSumExpr";
import type { ThousandsSuffixMode } from "@/lib/thousandsSuffix";
import {
  VENDOR_PRICE_STEP,
  effectiveVendorUnitPrice,
} from "@/lib/mockVendorUnitPrice";

const VENDOR_ORDER_SHOP = "Quán Chay Lá";

function VendorOrderHeading({
  orderTitle,
  whenLabel,
  size = "md",
}: {
  orderTitle?: string | null;
  whenLabel: string;
  size?: "md" | "lg";
}) {
  const subtitle = orderTitle?.trim() || "";
  const [restaurants, setRestaurantsState] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("mise.restaurants");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      /* ignore */
    }
    return [VENDOR_ORDER_SHOP];
  });
  const [current, setCurrentState] = useState<string>(() => {
    try {
      const raw = localStorage.getItem("mise.current-restaurant");
      if (raw && typeof raw === "string" && raw.trim()) return raw.trim();
    } catch {
      /* ignore */
    }
    return VENDOR_ORDER_SHOP;
  });
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [dropOpen, setDropOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      try {
        const raw = localStorage.getItem("mise.restaurants");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setRestaurantsState(parsed);
        }
        const cur = localStorage.getItem("mise.current-restaurant");
        if (cur) setCurrentState(cur);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("mise:restaurants", sync);
    window.addEventListener("mise:current-restaurant", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("mise:restaurants", sync);
      window.removeEventListener("mise:current-restaurant", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("Nhập tên quán");
      return;
    }
    const next = Array.from(new Set([...restaurants, trimmed]));
    localStorage.setItem("mise.restaurants", JSON.stringify(next));
    localStorage.setItem("mise.current-restaurant", trimmed);
    window.dispatchEvent(new Event("mise:restaurants"));
    window.dispatchEvent(new Event("mise:current-restaurant"));
    setRestaurantsState(next);
    setCurrentState(trimmed);
    setNewName("");
    setAddOpen(false);
    toast.success(`Đã thêm ${trimmed} — tạo đơn mới`);
    // Navigate to new order draft for this restaurant
    window.location.href = `/orders/new?restaurant=${encodeURIComponent(trimmed)}`;
  };

  const handleSwitch = (name: string) => {
    localStorage.setItem("mise.current-restaurant", name);
    window.dispatchEvent(new Event("mise:current-restaurant"));
    setCurrentState(name);
    setDropOpen(false);
    toast.message(`Đang xem ${name}`);
  };

  return (
    <div className="flex items-end justify-between gap-3 pl-1 pr-2">
      <div className="min-w-0 max-w-[80%]">
        <h1
          className={cn(
            "truncate font-display leading-tight text-foreground",
            size === "lg" ? "text-2xl" : "text-xl",
          )}
        >
          Đơn{" "}
          <Popover open={dropOpen} onOpenChange={setDropOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[#6aa8ad] hover:opacity-80"
                aria-label="Chọn quán"
              >
                <span className="truncate">{current}</span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-2">
              <div className="space-y-1">
                {restaurants.map(name => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleSwitch(name)}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted ${
                      name === current ? "bg-primary/10 text-primary" : "text-foreground"
                    }`}
                  >
                    <span className="truncate">{name}</span>
                    {name === current && <Check className="h-3 w-3 shrink-0" />}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="ml-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground hover:border-primary/30 hover:text-primary"
            aria-label="Thêm quán mới"
          >
            <Plus className="h-3 w-3" />
          </button>
        </h1>
        {subtitle ? (
          <p className="mt-0.5 truncate text-sm leading-tight text-foreground/80">{subtitle}</p>
        ) : null}
      </div>
      {whenLabel ? (
        <span className="shrink-0 whitespace-nowrap pb-px text-right text-[11px] leading-tight text-muted-foreground">
          {whenLabel}
        </span>
      ) : null}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-[92vw] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Thêm quán mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Tên quán, ví dụ: Quán Chay An"
              className="h-10"
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter") handleAdd();
              }}
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>
                Hủy
              </Button>
              <Button type="button" className="flex-1" onClick={handleAdd} disabled={!newName.trim()}>
                Tạo đơn
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type SharedOrder = {
  id: string;
  title: string;
  status: string;
  created_at?: string | null;
  shipping_fee?: number | null;
  deduction?: number | null;
  include_shipping?: boolean | null;
  include_deduction?: boolean | null;
  customer_name?: string | null;
  day_seq?: number | null;
  mgmt_id?: string | null;
};

type CatalogIngredient = {
  id: string;
  name: string;
  unit: string;
  reference_price?: number | null;
};

type SharedItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  retail_price: number | null;
  fulfilled_qty: number | null;
  status: string;
  notice: string | null;
  vendor_notice?: string | null;
  order_mode?: string | null;
  money_amount?: number | null;
  is_alternate?: boolean | null;
};

function asStatus(value: string): "pending" | "partial" | "done" {
  if (value === "partial" || value === "done") return value;
  return "pending";
}

function isOutOfStock(item: SharedItem) {
  return asStatus(item.status) === "partial" && Number(item.fulfilled_qty) === 0;
}

function orderedAmount(item: SharedItem): number {
  if (isMoneyOrder(item)) return Number(item.money_amount) || 0;
  return Number(item.quantity) || 0;
}

function lineAmount(item: SharedItem): number {
  if (isOutOfStock(item)) return 0;
  if (isMoneyOrder(item)) {
    return Number(item.fulfilled_qty ?? orderedAmount(item)) || 0;
  }
  const qty = Number(item.fulfilled_qty ?? item.quantity) || 0;
  return qty * effectiveVendorUnitPrice(item.name, item.retail_price);
}

function countsInTotal(item: SharedItem) {
  const status = asStatus(item.status);
  if (status === "done") return true;
  return status === "partial" && !isOutOfStock(item);
}

function lineQtyDetail(item: SharedItem): string | undefined {
  if (isMoneyOrder(item)) return undefined;
  const qty = Number(item.fulfilled_qty ?? item.quantity) || 0;
  const shown = formatOrderQty(qty, item.unit, item.quantity);
  const price = effectiveVendorUnitPrice(item.name, item.retail_price);
  return `${shown.value} ${shown.unit} × ${Math.round(price).toLocaleString("vi-VN")}₫`;
}

function VendorQty({ item, thousandsMode }: { item: SharedItem; thousandsMode?: ThousandsSuffixMode }) {
  const oos = isOutOfStock(item);
  const money = isMoneyOrder(item);
  const partial =
    asStatus(item.status) === "partial" && !oos && item.fulfilled_qty != null;

  if (oos) {
    return <span title="Hết hàng">❌</span>;
  }

  if (money) {
    const ordered = orderedAmount(item);
    if (partial) {
      return (
        <span className="inline-flex items-baseline gap-0.5">
          <MoneyLabel thousandsMode={thousandsMode}
            amount={Number(item.fulfilled_qty) || 0}
            className="text-sm text-foreground"
            smallClassName="text-[0.7em]"
          />
          <span className="text-muted-foreground/50">/</span>
          <MoneyLabel thousandsMode={thousandsMode}
            amount={ordered}
            className="text-sm text-muted-foreground/70"
            smallClassName="text-[0.7em]"
          />
        </span>
      );
    }
    return (
      <MoneyLabel thousandsMode={thousandsMode}
        amount={ordered}
        className="text-sm"
        smallClassName="text-[0.7em]"
      />
    );
  }

  const shown = formatOrderQty(item.quantity, item.unit);
  const unitTitle = shown.unit === "lạng" ? "1 lạng = 100 g" : undefined;
  if (partial) {
    const fulfilled = formatOrderQty(Number(item.fulfilled_qty), item.unit, item.quantity);
    return (
      <span title={unitTitle}>
        <span className="text-foreground">{fulfilled.value}</span>
        <span className="text-muted-foreground/50">/{shown.value}</span>
        <span className="ml-0.5 text-[11px] text-muted-foreground/70">{shown.unit}</span>
      </span>
    );
  }
  return (
    <span title={unitTitle}>
      {shown.value}
      <span className="ml-0.5 text-[11px] text-muted-foreground/70">{shown.unit}</span>
    </span>
  );
}

function VendorPriceStepper({
  name,
  price,
  readOnly,
  onStep,
  thousandsMode,
}: {
  name: string;
  price: number;
  readOnly: boolean;
  onStep: (delta: number) => void;
  thousandsMode?: ThousandsSuffixMode;
}) {
  return (
    <div className="flex items-center">
      <button
        type="button"
        disabled={readOnly || price <= 0}
        onClick={() => onStep(-VENDOR_PRICE_STEP)}
        aria-label={`Giảm giá ${name}`}
        className="inline-flex h-7 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
      >
        <Minus className="h-3 w-3" strokeWidth={2.4} />
      </button>
      <MoneyLabel thousandsMode={thousandsMode}
        amount={price}
        className="min-w-[2.75rem] text-center text-xs"
        smallClassName="text-[0.7em]"
      />
      <button
        type="button"
        disabled={readOnly}
        onClick={() => onStep(VENDOR_PRICE_STEP)}
        aria-label={`Tăng giá ${name}`}
        className="inline-flex h-7 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
      >
        <Plus className="h-3 w-3" strokeWidth={2.4} />
      </button>
    </div>
  );
}

const CHI_CON = "Chỉ còn";
const VENDOR_NOTE_PRESETS = ["Hết hàng", "Thay thế", "Giao sau", CHI_CON] as const;

function isVendorPreset(value: string): boolean {
  return (VENDOR_NOTE_PRESETS as readonly string[]).includes(value) || value === "Thiếu";
}

function remainingDraftFromItem(item: SharedItem): string {
  const notice = item.vendor_notice ?? "";
  if (notice !== CHI_CON && notice !== "Thiếu") return "";
  if (item.fulfilled_qty == null) return "";
  if (isMoneyOrder(item)) return thousandsFromVnd(Number(item.fulfilled_qty) || 0);
  return formatQtyNumber(
    storedQtyToDisplay(Number(item.fulfilled_qty), item.unit, item.quantity),
  );
}

function RemainingQtyPill({
  item,
  active,
  readOnly,
  onActivate,
  onCommit,
}: {
  item: SharedItem;
  active: boolean;
  readOnly: boolean;
  onActivate: () => void;
  onCommit: (qty: number | null) => void;
}) {
  const money = isMoneyOrder(item);
  const shown = remainingDraftFromItem(item);
  const [on, setOn] = useState(active);
  const [draft, setDraft] = useState(shown);

  useEffect(() => {
    setDraft(remainingDraftFromItem(item));
  }, [item.fulfilled_qty, item.unit, item.quantity, item.order_mode]);

  useEffect(() => {
    setOn(active);
  }, [active]);

  const commitDraft = () => {
    const raw = draft.trim();
    if (!raw) {
      onCommit(null);
      return;
    }
    const qty = money
      ? vndFromThousands(raw)
      : displayQtyToStored(Number(raw), item.unit, item.quantity);
    if (!Number.isFinite(qty) || qty < 0) return;
    onCommit(qty);
  };

  return (
    <div
      className={cn(
        "vendor-done-pill relative shrink-0 border text-slate-800",
        on ? "vendor-done-pill--partial justify-end" : "border-border bg-transparent",
      )}
    >
      {on ? (
        <Input
          disabled={readOnly}
          inputMode="decimal"
          value={draft}
          placeholder={money ? "0" : "0"}
          onChange={e => setDraft(e.target.value.replace(/[^\d.]/g, ""))}
          onBlur={commitDraft}
          onKeyDown={e => {
            if (e.key === "Enter") commitDraft();
          }}
          className="h-6 min-w-0 flex-1 border-0 bg-transparent px-0 text-right text-xs tabular-nums shadow-none focus-visible:ring-0"
          aria-label="Số lượng còn lại"
        />
      ) : (
        <button
          type="button"
          disabled={readOnly}
          onClick={() => {
            setOn(true);
            onActivate();
          }}
          aria-label="Nhập số còn lại"
          className="absolute inset-0 disabled:opacity-40"
        />
      )}
    </div>
  );
}

function VendorNoteMenu({
  item,
  readOnly,
  onSave,
  onRemove,
}: {
  item: SharedItem;
  readOnly: boolean;
  onSave: (notice: string | null, extras?: Partial<SharedItem>) => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [preset, setPreset] = useState("");
  const draftRef = useRef("");
  const presetRef = useRef("");

  const setDraftValue = (value: string) => {
    draftRef.current = value;
    setDraft(value);
  };

  const setPresetValue = (value: string) => {
    presetRef.current = value;
    setPreset(value);
  };

  useEffect(() => {
    if (!open) return;
    const notice = item.vendor_notice ?? "";
    if (notice === "Thiếu" || notice === CHI_CON) {
      setPresetValue(CHI_CON);
      setDraftValue("");
    } else if (isVendorPreset(notice)) {
      setPresetValue(notice);
      setDraftValue("");
    } else {
      setPresetValue("");
      setDraftValue(notice);
    }
    // Only reset when the menu opens, not when the saved value comes back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const commit = (value: string | null, extras?: Partial<SharedItem>) => {
    const next = value?.trim() || null;
    const sameNotice = (item.vendor_notice ?? null) === next;
    const sameQty =
      extras?.fulfilled_qty === undefined || extras.fulfilled_qty === item.fulfilled_qty;
    const sameStatus = extras?.status === undefined || extras.status === item.status;
    if (sameNotice && sameQty && sameStatus) return;
    onSave(next, extras);
  };

  const savedValue = () => draftRef.current.trim() || presetRef.current || null;

  const applyRemaining = (qty: number | null) => {
    setPresetValue(CHI_CON);
    if (qty == null) {
      commit(draftRef.current.trim() || CHI_CON, { status: "pending", fulfilled_qty: null });
      return;
    }
    const ordered = orderedAmount(item);
    if (qty <= 0) {
      commit(CHI_CON, { status: "partial", fulfilled_qty: 0 });
      return;
    }
    if (qty >= ordered) {
      commit(CHI_CON, { status: "done", fulfilled_qty: ordered });
      return;
    }
    commit(CHI_CON, { status: "partial", fulfilled_qty: qty });
  };

  const clearAll = () => {
    const extras = presetRef.current === CHI_CON ? { status: "pending" as const, fulfilled_qty: null } : undefined;
    setDraftValue("");
    setPresetValue("");
    commit(null, extras);
  };

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        if (open && !next) commit(savedValue());
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={readOnly}
          aria-label={`Tùy chọn ${item.name}`}
          aria-expanded={open}
          className={`inline-flex h-7 w-6 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-40 ${
            item.vendor_notice
              ? "text-foreground hover:bg-muted"
              : "text-muted-foreground/55 hover:bg-muted hover:text-foreground"
          }`}
        >
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.4} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={6}
        collisionPadding={{ top: 72, bottom: 104 }}
        className="w-64 p-2"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <div className="flex flex-col gap-1.5">
          {VENDOR_NOTE_PRESETS.map(option => {
            const selected = preset === option;
            if (option === CHI_CON) {
              return (
                <div key={option} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const next = selected ? "" : CHI_CON;
                      setPresetValue(next);
                      commit(
                        draftRef.current.trim() || next || null,
                        next ? undefined : { status: "pending", fulfilled_qty: null },
                      );
                    }}
                    className={`min-w-0 flex-1 rounded-full px-3 py-2 text-sm transition-colors ${
                      selected
                        ? "bg-primary/15 text-foreground"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {option}
                  </button>
                  <RemainingQtyPill
                    item={item}
                    active={selected}
                    readOnly={readOnly}
                    onActivate={() => {
                      setPresetValue(CHI_CON);
                      commit(draftRef.current.trim() || CHI_CON);
                    }}
                    onCommit={applyRemaining}
                  />
                </div>
              );
            }
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  const next = selected ? "" : option;
                  const leavingChiCon = presetRef.current === CHI_CON;
                  setPresetValue(next);
                  commit(
                    draftRef.current.trim() || next || null,
                    leavingChiCon ? { status: "pending", fulfilled_qty: null } : undefined,
                  );
                }}
                className={`w-full rounded-full px-3 py-2 text-sm transition-colors ${
                  selected
                    ? "bg-primary/15 text-foreground"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
        <div className="relative mt-2">
          <Input
            value={draft}
            disabled={readOnly}
            onChange={e => setDraftValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                commit(savedValue());
                setOpen(false);
              }
            }}
            placeholder="Ghi chú thêm…"
            className="h-8 pr-8 text-xs"
          />
          <button
            type="button"
            disabled={readOnly}
            onClick={clearAll}
            aria-label="Xóa ghi chú"
            className="absolute right-1 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.4} />
          </button>
        </div>
        {onRemove && !readOnly ? (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onRemove();
            }}
            className="mt-2 w-full rounded-md px-2 py-1 text-left text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Xóa dòng
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function VendorDonePill({
  item,
  readOnly,
  onToggle,
  thousandsMode,
}: {
  item: SharedItem;
  readOnly: boolean;
  onToggle: () => void;
  thousandsMode?: ThousandsSuffixMode;
}) {
  const notice = item.vendor_notice?.trim() || "";
  const isHetHang = notice === "Hết hàng";
  const isThayThe = notice === "Thay thế";
  const isGiaoSau = notice === "Giao sau";
  const isChiCon = notice === CHI_CON || notice === "Thiếu";

  // Preset notices go directly into the pill
  if (isHetHang) {
    return (
      <button
        type="button"
        aria-label={`Hết hàng ${item.name}`}
        disabled={readOnly}
        onClick={onToggle}
        className="vendor-done-pill vendor-done-pill--oos justify-center border text-slate-800 disabled:opacity-40"
      >
        <span className="text-[10px] font-medium leading-none">Hết hàng</span>
      </button>
    );
  }
  if (isThayThe) {
    return (
      <button
        type="button"
        aria-label={`Thay thế ${item.name}`}
        disabled={readOnly}
        onClick={onToggle}
        className="vendor-done-pill vendor-done-pill--partial justify-center border text-slate-800 disabled:opacity-40"
      >
        <span className="text-[10px] font-medium leading-none">Thay thế</span>
      </button>
    );
  }
  if (isGiaoSau) {
    return (
      <button
        type="button"
        aria-label={`Giao sau ${item.name}`}
        disabled={readOnly}
        onClick={onToggle}
        className="vendor-done-pill vendor-done-pill--done justify-center border text-slate-800 disabled:opacity-40"
      >
        <span className="text-[10px] font-medium leading-none">Giao sau</span>
      </button>
    );
  }
  if (isChiCon) {
    const amount = lineAmount(item);
    const hasQty = item.fulfilled_qty != null && Number(item.fulfilled_qty) !== 0;
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={asStatus(item.status) === "done"}
        aria-label={`Chỉ còn ${item.name}`}
        disabled={readOnly}
        onClick={onToggle}
        className="vendor-done-pill vendor-done-pill--partial justify-between border text-slate-800 disabled:opacity-40"
      >
        {hasQty ? (
          <>
            <span className="text-[10px] leading-none" aria-hidden>
              ❓
            </span>
            <MoneyLabel thousandsMode={thousandsMode}
              amount={amount}
              className="min-w-0 text-right text-xs font-medium"
              smallClassName="text-[0.72em]"
            />
          </>
        ) : (
          <span className="mx-auto text-[11px] leading-none" aria-hidden>
            ❓
          </span>
        )}
      </button>
    );
  }

  const oos = isOutOfStock(item);
  const done = asStatus(item.status) === "done";
  const partial = asStatus(item.status) === "partial" && !oos;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={
        oos ? `Hết hàng ${item.name}` : done ? `Bỏ xong ${item.name}` : `Đánh xong ${item.name}`
      }
      disabled={readOnly}
      onClick={onToggle}
      className={cn(
        "vendor-done-pill border text-slate-800 disabled:opacity-40",
        done && "vendor-done-pill--done justify-between",
        partial && "vendor-done-pill--partial justify-end",
        oos && "vendor-done-pill--oos justify-center",
        !done && !partial && !oos && "border-border bg-transparent hover:border-foreground/40",
      )}
    >
      {done ? (
        <>
          <Check className="h-2.5 w-2.5 shrink-0 opacity-80" strokeWidth={2.8} />
          <MoneyLabel thousandsMode={thousandsMode}
            amount={lineAmount(item)}
            className="min-w-0 text-right text-xs font-medium"
            smallClassName="text-[0.72em]"
          />
        </>
      ) : partial ? (
            <MoneyLabel thousandsMode={thousandsMode}
              amount={lineAmount(item)}
              className="min-w-0 text-right text-xs font-medium"
              smallClassName="text-[0.72em]"
            />
      ) : oos ? (
        <span className="text-[10px] font-medium">Hết</span>
      ) : null}
    </button>
  );
}

function VendorLine({
  item,
  striped,
  alternate,
  readOnly,
  saving,
  onToggleDone,
  onHold,
  onPriceStep,
  onVendorNotice,
  onNameChange,
  onQtyChange,
  onRemove,
  thousandsMode,
}: {
  item: SharedItem;
  striped: boolean;
  alternate?: boolean;
  readOnly: boolean;
  saving: boolean;
  onToggleDone: () => void;
  onHold: () => void;
  onPriceStep: (delta: number) => void;
  onVendorNotice: (notice: string | null, extras?: Partial<SharedItem>) => void;
  onNameChange?: (name: string) => void;
  onQtyChange?: (qty: number) => void;
  onRemove?: () => void;
  thousandsMode?: ThousandsSuffixMode;
}) {
  const { confirming, cancelConfirm, consumeClick, rootRef, holdProps } = useHoldToConfirm({
    enabled: !readOnly,
    ignoreSelector: "input, textarea, button, [data-radix-popper-content-wrapper]",
  });

  useEffect(() => {
    if (!confirming) return;
    cancelConfirm();
    onHold();
    // Hold arm is a one-shot; parent callback identity must not retrigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirming]);

  const qtyDraft = formatQtyNumber(
    storedQtyToDisplay(item.quantity, item.unit, item.quantity),
  );
  const [qtyText, setQtyText] = useState(qtyDraft);

  useEffect(() => {
    setQtyText(qtyDraft);
  }, [qtyDraft]);

  return (
    <div
      ref={rootRef}
      className={cn(
        "border-b border-border/40 last:border-b-0",
        saving && "bg-muted/20",
        !saving && alternate && (striped ? "bg-[#e0dbe8]" : "bg-[#e8e4ef]"),
        !saving && !alternate && (striped ? "bg-[#f4f4f4]" : "bg-white"),
      )}
      {...holdProps}
    >
      <div
        className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start pl-1 pr-2 py-1.5"
        onClick={() => {
          if (consumeClick()) return;
        }}
      >
        <div className="flex min-w-0 items-start">
          <div className="flex h-7 w-[2.75rem] shrink-0 items-center justify-end text-sm tabular-nums leading-none">
            {alternate && !readOnly && onQtyChange ? (
              <Input
                inputMode="decimal"
                value={qtyText}
                onChange={e => setQtyText(e.target.value.replace(/[^\d.]/g, ""))}
                onBlur={() => {
                  const next = displayQtyToStored(Number(qtyText), item.unit, item.quantity);
                  if (Number.isFinite(next) && next >= 0) onQtyChange(next);
                  else setQtyText(qtyDraft);
                }}
                className="h-7 w-[2.75rem] border-0 bg-transparent px-0 text-right text-sm tabular-nums shadow-none focus-visible:ring-0"
                aria-label={`Số lượng ${item.name || "hàng thay"}`}
              />
            ) : (
              <VendorQty item={item} thousandsMode={thousandsMode} />
            )}
          </div>
          <div className="min-w-0 flex-1 pl-2.5">
            {alternate && !readOnly && onNameChange ? (
              <Input
                value={item.name}
                onChange={e => onNameChange(e.target.value)}
                placeholder="Tên hàng thay…"
                className="h-7 border-0 bg-transparent px-0 text-sm font-medium shadow-none focus-visible:ring-0"
                aria-label="Tên hàng thay"
              />
            ) : (
              <p className="flex h-7 min-w-0 items-center truncate text-sm font-medium leading-none">
                {item.name}
              </p>
            )}
            {item.notice?.trim() ? (
              <p className="-mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
                {item.notice}
              </p>
            ) : null}
            {(() => {
              const v = item.vendor_notice?.trim() || "";
              const isCustom = v && !isVendorPreset(v) && v !== "Thiếu";
              return isCustom ? (
                <p
                  className="-mt-0.5 truncate text-[11px] leading-tight text-[#6aa8ad]"
                  title={v}
                >
                  {v}
                </p>
              ) : null;
            })()}
          </div>
        </div>
        <div className="flex h-7 items-center">
          <VendorPriceStepper
            name={item.name}
            price={effectiveVendorUnitPrice(item.name, item.retail_price)}
            readOnly={readOnly}
            onStep={onPriceStep}
            thousandsMode={thousandsMode}
          />
        </div>
        <div className="flex h-7 items-center justify-end">
          <div className="mr-2.5 flex h-7 items-center">
            <VendorNoteMenu
              item={item}
              readOnly={readOnly}
              onSave={onVendorNotice}
              onRemove={onRemove}
            />
          </div>
          <VendorDonePill item={item} readOnly={readOnly} onToggle={onToggleDone} thousandsMode={thousandsMode} />
        </div>
      </div>
    </div>
  );
}

function ExtraRow({
  emoji,
  label,
  on,
  draft,
  readOnly,
  onToggle,
  onDraft,
  onCommit,
}: {
  emoji: string;
  label: string;
  on: boolean;
  draft: string;
  readOnly: boolean;
  onToggle: () => void;
  onDraft: (value: string) => void;
  onCommit: () => void;
}) {
  return (
    <div className="flex items-center pl-1 pr-2 py-1.5">
      <span className="flex h-7 w-[2.75rem] shrink-0 items-center justify-end text-sm leading-none" aria-hidden>
        {emoji}
      </span>
      <span className="flex h-7 min-w-0 flex-1 items-center pl-2.5 text-sm">{label}</span>
      <div
        className={cn(
          "vendor-done-pill relative border text-slate-800",
          on ? "vendor-done-pill--done justify-between" : "border-border bg-transparent",
        )}
      >
        {on ? (
          <>
            <button
              type="button"
              disabled={readOnly}
              onClick={onToggle}
              aria-label={`Tắt ${label}`}
              className="inline-flex shrink-0 items-center justify-center disabled:opacity-40"
            >
              <Check className="h-2.5 w-2.5 opacity-80" strokeWidth={2.8} />
            </button>
            <Input
              disabled={readOnly}
              inputMode="numeric"
              value={draft}
              placeholder="0"
              onChange={e => onDraft(e.target.value.replace(/[^\d.]/g, ""))}
              onBlur={onCommit}
              className="h-6 min-w-0 flex-1 border-0 bg-transparent px-0 text-right text-xs tabular-nums shadow-none focus-visible:ring-0"
              aria-label={label}
            />
          </>
        ) : (
          <button
            type="button"
            disabled={readOnly}
            onClick={onToggle}
            aria-label={`Bật ${label}`}
            className="absolute inset-0 disabled:opacity-40"
          />
        )}
      </div>
    </div>
  );
}

export default function SupplierOrder() {
  const { token = "" } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const allowBypass = import.meta.env.DEV || searchParams.get("bypass") === "1";
  const fromOrderId = searchParams.get("from");

  const [order, setOrder] = useState<SharedOrder | null>(null);
  const [items, setItems] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [holdItemId, setHoldItemId] = useState<string | null>(null);
  const [holdQty, setHoldQty] = useState("");
  const [totalOpen, setTotalOpen] = useState(false);
  const [includeShipping, setIncludeShipping] = useState(false);
  const [includeDeduction, setIncludeDeduction] = useState(false);
  const [shippingDraft, setShippingDraft] = useState("");
  const [deductionDraft, setDeductionDraft] = useState("");
  const [vendorThousands, setVendorThousands] = useState<ThousandsSuffixMode>(() => {
    try {
      const raw = localStorage.getItem("mise.vendor-thousands-suffix");
      if (raw === "k" || raw === "none") return raw as ThousandsSuffixMode;
    } catch {
      /* ignore */
    }
    return "k";
  });
  const [expOpen, setExpOpen] = useState(false);
  const [expMode, setExpMode] = useState<"single" | "bulk" | "paste">("single");
  const [expSingleName, setExpSingleName] = useState("");
  const [expSingleQty, setExpSingleQty] = useState("1");
  const [expSingleUnit, setExpSingleUnit] = useState("kg");
  const [expSinglePrice, setExpSinglePrice] = useState("");
  const [expBulkSelected, setExpBulkSelected] = useState<Set<string>>(new Set());
  const [expPasteText, setExpPasteText] = useState("");
  const [expParsed, setExpParsed] = useState<import("@/lib/parseOrderText").ParsedOrderLine[]>([]);
  const [expCatalog, setExpCatalog] = useState<CatalogIngredient[]>([]);
  const itemsRef = useRef<SharedItem[]>([]);
  const saveTimersRef = useRef(new Map<string, number>());
  const extrasTimerRef = useRef<number | null>(null);
  const extrasRef = useRef({
    includeShipping: false,
    includeDeduction: false,
    shippingDraft: "",
    deductionDraft: "",
  });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);

    const { data: orders, error } = await supabase.rpc("get_shared_order", {
      p_token: token,
    });
    if (error) {
      toast.error(error.message);
      setLoadError(error.message);
    }

    let row = (Array.isArray(orders) ? orders[0] : orders) as SharedOrder | null | undefined;
    let itemRows: SharedItem[] | null = null;
    let ownerPreview = false;

    if (!row) {
      const extrasSelect =
        "id, title, status, created_at, shipping_fee, deduction, include_shipping, include_deduction, customer_name, day_seq, mgmt_id";
      let q = supabase.from("orders").select(extrasSelect);
      q = fromOrderId ? q.eq("id", fromOrderId) : q.eq("share_token", token);
      let { data: own, error: ownErr } = await q.maybeSingle();
      if (ownErr) {
        let q2 = supabase.from("orders").select("id, title, status, created_at");
        q2 = fromOrderId ? q2.eq("id", fromOrderId) : q2.eq("share_token", token);
        const fallback = await q2.maybeSingle();
        own = fallback.data as typeof own;
      }
      if (own) {
        row = own as SharedOrder;
        ownerPreview = true;
        const itemSelect =
          "id, name, quantity, unit, retail_price, fulfilled_qty, status, notice, vendor_notice, order_mode, money_amount, is_alternate";
        let { data: rows, error: itemsOwnErr } = await supabase
          .from("order_items")
          .select(itemSelect)
          .eq("order_id", own.id)
          .order("sort_order", { ascending: true });
        if (itemsOwnErr) {
          const fallback = await supabase
            .from("order_items")
            .select("id, name, quantity, unit, retail_price, fulfilled_qty, status, notice, vendor_notice, order_mode, money_amount")
            .eq("order_id", own.id)
            .order("sort_order", { ascending: true });
          rows = fallback.data as typeof rows;
        }
        itemRows = (rows as SharedItem[]) || [];
      }
    }

    if (!row) {
      setOrder(null);
      setItems([]);
      setLoading(false);
      return;
    }
    setOrder(row);
    setIncludeShipping(!!row.include_shipping);
    setIncludeDeduction(!!row.include_deduction);
    setShippingDraft(thousandsFromVnd(Number(row.shipping_fee) || 0));
    setDeductionDraft(thousandsFromVnd(Number(row.deduction) || 0));

    if (!itemRows) {
      const { data: rows, error: itemsErr } = await supabase.rpc("get_shared_order_items", {
        p_token: token,
      });
      if (itemsErr) toast.error(itemsErr.message);
      itemRows = (rows as SharedItem[]) || [];
    }
    setItems(itemRows);
    itemsRef.current = itemRows;
    setUnlocked(ownerPreview || isOrderPinUnlocked(token));
    setLoading(false);
  }, [token, fromOrderId]);

  useEffect(() => {
    load();
  }, [load]);

  const unlockWithPin = async () => {
    if (!order) return;
    const { data: ok, error } = await supabase.rpc("verify_order_pin", {
      p_token: token,
      p_pin: pinInput,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!ok) {
      toast.error("PIN không đúng");
      return;
    }
    markOrderPinUnlocked(token);
    setUnlocked(true);
    toast.success("Đã mở khóa");
  };

  const bypassPin = () => {
    markOrderPinUnlocked(token);
    setUnlocked(true);
    toast.message("Đã bỏ qua PIN (test)");
  };

  const updateLocal = (id: string, patch: Partial<SharedItem>) => {
    const next = itemsRef.current.map(item => (item.id === id ? { ...item, ...patch } : item));
    itemsRef.current = next;
    setItems(next);
  };

  const persistItem = useCallback(async (id: string) => {
    const item = itemsRef.current.find(row => row.id === id);
    if (!item) return;
    setSavingId(id);
    try {
      const { error } = item.is_alternate
        ? await supabase.rpc("update_shared_order_alternate", {
            p_token: token,
            p_item_id: item.id,
            p_name: item.name,
            p_quantity: item.quantity,
            p_unit: item.unit || "kg",
            p_retail_price: item.retail_price ?? 0,
            p_fulfilled_qty: item.fulfilled_qty ?? orderedAmount(item),
            p_status: item.status,
            p_notice: item.vendor_notice ?? "",
          })
        : await supabase.rpc("update_shared_order_item", {
            p_token: token,
            p_item_id: item.id,
            p_retail_price: item.retail_price ?? 0,
            p_fulfilled_qty: item.fulfilled_qty ?? orderedAmount(item),
            p_status: item.status,
            p_notice: item.vendor_notice ?? "",
          });
      if (error) {
        const isMissingFn =
          (error as { code?: string })?.code === "PGRST202" ||
          String((error as { message?: string })?.message || "").includes("Could not find the function");
        if (isMissingFn && item.is_alternate) {
          throw new Error(
            "Chưa bật cập nhật hàng thay trên DB — chạy supabase/migrations/20260821170000_order_item_alternate.sql rồi thử lại.",
          );
        }
        const patch: {
          retail_price: number;
          fulfilled_qty: number;
          status: string;
          vendor_notice: string | null;
          name?: string;
          quantity?: number;
          unit?: string;
        } = {
          retail_price: item.retail_price ?? 0,
          fulfilled_qty: item.fulfilled_qty ?? orderedAmount(item),
          status: item.status,
          vendor_notice: item.vendor_notice ?? null,
        };
        if (item.is_alternate) {
          patch.name = item.name;
          patch.quantity = item.quantity;
          patch.unit = item.unit;
        }
        const { error: directErr } = await supabase
          .from("order_items")
          .update(patch)
          .eq("id", item.id);
        if (directErr) throw error;
      }
    } catch (err: any) {
      toast.error(err.message || "Không lưu được");
    } finally {
      setSavingId(prev => (prev === id ? null : prev));
    }
  }, [token]);

  const persistNow = (id: string, patch: Partial<SharedItem>) => {
    const existing = saveTimersRef.current.get(id);
    if (existing) {
      window.clearTimeout(existing);
      saveTimersRef.current.delete(id);
    }
    updateLocal(id, patch);
    void persistItem(id);
  };

  const persistSoon = (id: string, patch: Partial<SharedItem>) => {
    updateLocal(id, patch);
    const existing = saveTimersRef.current.get(id);
    if (existing) window.clearTimeout(existing);
    saveTimersRef.current.set(
      id,
      window.setTimeout(() => {
        saveTimersRef.current.delete(id);
        void persistItem(id);
      }, 450),
    );
  };

  const addAlternate = async () => {
    if (order?.status === "closed") return;
    try {
      const { data, error } = await supabase.rpc("add_shared_order_alternate", {
        p_token: token,
        p_name: "",
        p_quantity: 1,
        p_unit: "kg",
      });
      let row = (Array.isArray(data) ? data[0] : data) as SharedItem | null;
      if (error || !row) {
        // Missing RPC on remote DB → PGRST202 schema cache miss (migration not deployed)
        const isMissingFn =
          (error as { code?: string; message?: string })?.code === "PGRST202" ||
          String((error as { message?: string })?.message || "").includes("Could not find the function");
        if (isMissingFn) {
          throw new Error(
            "Chưa bật hàng thay trên DB — chạy supabase/migrations/20260821170000_order_item_alternate.sql trong Supabase Dashboard > SQL Editor rồi thử lại.",
          );
        }
        const oid = fromOrderId || order?.id;
        if (!oid) throw error || new Error("Không thêm được hàng thay");
        const { data: inserted, error: insertErr } = await supabase
          .from("order_items")
          .insert({
            order_id: oid,
            name: "",
            quantity: 1,
            unit: "kg",
            status: "pending",
            order_mode: "measure",
            is_alternate: true,
          })
          .select("id, name, quantity, unit, retail_price, fulfilled_qty, status, notice, vendor_notice, order_mode, money_amount, is_alternate")
          .single();
        if (insertErr) throw error || insertErr;
        row = inserted as SharedItem;
      }
      const next = [...itemsRef.current, { ...row, is_alternate: true }];
      itemsRef.current = next;
      setItems(next);
    } catch (err: any) {
      toast.error(err.message || "Không thêm được hàng thay");
    }
  };

  const removeAlternate = async (id: string) => {
    try {
      const { error } = await supabase.rpc("delete_shared_order_alternate", {
        p_token: token,
        p_item_id: id,
      });
      if (error) {
        const isMissingFn =
          (error as { code?: string })?.code === "PGRST202" ||
          String((error as { message?: string })?.message || "").includes("Could not find the function");
        if (isMissingFn) {
          throw new Error(
            "Chưa bật xóa hàng thay trên DB — chạy supabase/migrations/20260821170000_order_item_alternate.sql rồi thử lại.",
          );
        }
        const { error: directErr } = await supabase.from("order_items").delete().eq("id", id);
        if (directErr) throw error;
      }
      const next = itemsRef.current.filter(item => item.id !== id);
      itemsRef.current = next;
      setItems(next);
    } catch (err: any) {
      toast.error(err.message || "Không xóa được hàng thay");
    }
  };

  extrasRef.current = {
    includeShipping,
    includeDeduction,
    shippingDraft,
    deductionDraft,
  };

  const persistExtras = useCallback(async () => {
    const extras = extrasRef.current;
    const payload = {
      shipping_fee: vndFromThousands(extras.shippingDraft),
      deduction: vndFromThousands(extras.deductionDraft),
      include_shipping: extras.includeShipping,
      include_deduction: extras.includeDeduction,
    };
    const { error } = await supabase.rpc("update_shared_order_extras", {
      p_token: token,
      p_shipping_fee: payload.shipping_fee,
      p_deduction: payload.deduction,
      p_include_shipping: payload.include_shipping,
      p_include_deduction: payload.include_deduction,
    });
    if (error) {
      const oid = fromOrderId || order?.id;
      if (!oid) return;
      await supabase.from("orders").update(payload).eq("id", oid);
    }
  }, [token, fromOrderId, order?.id]);

  const persistExtrasSoon = () => {
    if (extrasTimerRef.current) window.clearTimeout(extrasTimerRef.current);
    extrasTimerRef.current = window.setTimeout(() => {
      extrasTimerRef.current = null;
      void persistExtras();
    }, 450);
  };

  const persistExtrasNow = () => {
    if (extrasTimerRef.current) {
      window.clearTimeout(extrasTimerRef.current);
      extrasTimerRef.current = null;
    }
    void persistExtras();
  };

  useEffect(() => {
    return () => {
      saveTimersRef.current.forEach(timer => window.clearTimeout(timer));
      if (extrasTimerRef.current) window.clearTimeout(extrasTimerRef.current);
    };
  }, []);

  const holdItem = holdItemId ? items.find(row => row.id === holdItemId) ?? null : null;
  const holdMoney = holdItem ? isMoneyOrder(holdItem) : false;
  const holdShown = holdItem && !holdMoney ? formatOrderQty(holdItem.quantity, holdItem.unit) : null;

  const openHold = (id: string) => {
    const row = itemsRef.current.find(item => item.id === id);
    if (!row) return;
    setHoldItemId(id);
    setHoldQty(
      isMoneyOrder(row)
        ? moneyAmountToDraft(Number(row.fulfilled_qty ?? orderedAmount(row)) || 0)
        : formatQtyNumber(
            storedQtyToDisplay(Number(row.fulfilled_qty ?? row.quantity), row.unit, row.quantity),
          ),
    );
  };

  const applyCustomQty = () => {
    if (!holdItem) return;
    const ordered = orderedAmount(holdItem);
    const qty = isMoneyOrder(holdItem)
      ? vndFromThousands(holdQty)
      : displayQtyToStored(Number(holdQty), holdItem.unit, holdItem.quantity);
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error(isMoneyOrder(holdItem) ? "Số tiền không hợp lệ" : "Số lượng không hợp lệ");
      return;
    }
    if (qty === 0) {
      persistNow(holdItem.id, { status: "partial", fulfilled_qty: 0 });
    } else if (qty >= ordered) {
      persistNow(holdItem.id, { status: "done", fulfilled_qty: ordered });
    } else {
      persistNow(holdItem.id, { status: "partial", fulfilled_qty: qty });
    }
    setHoldItemId(null);
  };

  const applyOutOfStock = () => {
    if (!holdItem) return;
    persistNow(holdItem.id, { status: "partial", fulfilled_qty: 0 });
    setHoldItemId(null);
  };

  const itemsSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + (countsInTotal(item) ? lineAmount(item) : 0), 0),
    [items],
  );
  const shippingVnd = includeShipping ? vndFromThousands(shippingDraft) : 0;
  const deductionVnd = includeDeduction ? vndFromThousands(deductionDraft) : 0;
  const grandTotal = Math.max(0, itemsSubtotal + shippingVnd - deductionVnd);
  const totalLines = useMemo(() => {
    const lines: {
      key: string;
      name: string;
      detail?: string;
      amount: number;
      sign: 1 | -1;
    }[] = [];
    for (const item of items) {
      if (!countsInTotal(item)) continue;
      lines.push({
        key: item.id,
        name: item.name.trim() || "Hàng thay",
        detail: lineQtyDetail(item),
        amount: lineAmount(item),
        sign: 1,
      });
    }
    if (includeShipping && shippingVnd > 0) {
      lines.push({ key: "ship", name: "Phí ship", amount: shippingVnd, sign: 1 });
    }
    if (includeDeduction && deductionVnd > 0) {
      lines.push({ key: "deduct", name: "Khấu trừ", amount: deductionVnd, sign: -1 });
    }
    return lines;
  }, [items, includeShipping, shippingVnd, includeDeduction, deductionVnd]);
  const googleExpr = googleSumExpr(totalLines);

  const copyGrandTotal = async () => {
    try {
      await navigator.clipboard.writeText(String(grandTotal));
      toast.success("Đã sao chép tổng");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Không copy được");
    }
  };

  const searchTotalOnGoogle = () => {
    const q = googleExpr || String(grandTotal);
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(q)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Đang tải đơn…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div className="space-y-3">
          {fromOrderId && (
            <Link
              to={`/orders/${fromOrderId}`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Quay lại đơn
            </Link>
          )}
          <p className="font-display text-xl text-foreground">Không tìm thấy đơn</p>
          <p className="text-sm text-muted-foreground">Link có thể sai hoặc đơn đã đóng.</p>
          {loadError && (
            <p className="text-[11px] text-destructive/80 break-all">{loadError}</p>
          )}
        </div>
      </div>
    );
  }

  const whenLabel = formatOrderSessionDay(order.created_at);

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          {fromOrderId && (
            <Link
              to={`/orders/${fromOrderId}`}
              className="-mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Quay lại đơn
            </Link>
          )}
          <div className="text-center">
            <VendorOrderHeading
              orderTitle={order.title}
              whenLabel={whenLabel}
              size="lg"
            />
            <p className="text-xs text-muted-foreground mt-2">Nhập PIN để cập nhật đơn</p>
          </div>
          <Input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={e => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="PIN"
            className="h-11 text-center text-lg tracking-[0.3em]"
            onKeyDown={e => e.key === "Enter" && unlockWithPin()}
          />
          <Button type="button" className="w-full" onClick={unlockWithPin}>
            Mở khóa
          </Button>
          {allowBypass && (
            <button
              type="button"
              onClick={bypassPin}
              className="w-full text-center text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            >
              Bỏ qua PIN (test)
            </button>
          )}
        </div>
      </div>
    );
  }

  const readOnly = order.status === "closed";

  const renderLine = (item: SharedItem, index: number) => {
    const alternate = !!item.is_alternate;
    return (
      <VendorLine
        key={item.id}
        item={item}
        striped={index % 2 === 1}
        alternate={alternate}
        readOnly={readOnly}
        saving={savingId === item.id}
        thousandsMode={vendorThousands}
        onToggleDone={() =>
          persistNow(
            item.id,
            asStatus(item.status) === "done"
              ? { status: "pending", fulfilled_qty: null }
              : { status: "done", fulfilled_qty: orderedAmount(item) },
          )
        }
        onHold={() => openHold(item.id)}
        onPriceStep={delta => {
          const base = effectiveVendorUnitPrice(item.name, item.retail_price);
          persistSoon(item.id, { retail_price: Math.max(0, base + delta) });
        }}
        onVendorNotice={(notice, extras) => persistNow(item.id, { vendor_notice: notice, ...extras })}
        onNameChange={alternate ? name => persistSoon(item.id, { name }) : undefined}
        onQtyChange={alternate ? qty => persistSoon(item.id, { quantity: qty }) : undefined}
        onRemove={alternate && !readOnly ? () => void removeAlternate(item.id) : undefined}
      />
    );
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 py-3 backdrop-blur-sm">
        <div className="relative mx-auto max-w-lg px-4">
          {fromOrderId && (
            <Link
              to={`/orders/${fromOrderId}`}
              className="absolute left-4 top-0 z-10 inline-flex h-9 w-9 -translate-x-full items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Quay lại đơn"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <div className="mx-px">
            <VendorOrderHeading
              orderTitle={order.title}
              whenLabel={whenLabel}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-4">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <div className="grid h-7 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-border/50 pl-1 pr-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <div className="flex min-w-0 items-center">
              <span className="w-[2.75rem] shrink-0 text-right">SL</span>
              <span className="pl-2.5">Hàng</span>
            </div>
            <span className="text-center">Giá</span>
            <span className="block w-full text-right">Xong</span>
          </div>
          {items.map((item, index) => renderLine(item, index))}
          {!readOnly && (
            <button
              type="button"
              onClick={() => void addAlternate()}
              className="flex w-full items-center pl-1 pr-2 py-1.5 text-left text-sm text-slate-700 bg-[#e8e4ef] hover:bg-[#ddd6e8]"
            >
              <span className="inline-flex h-7 w-[2.75rem] items-center justify-end">
                <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
              </span>
              <span className="pl-2.5">Thêm hàng thay</span>
            </button>
          )}
        </div>
        <div className="mt-2 overflow-hidden rounded-xl border border-border/60 bg-card">
          <ExtraRow
            emoji="🛵"
            label="Phí ship"
            on={includeShipping}
            draft={shippingDraft}
            readOnly={readOnly}
            onToggle={() => {
              const next = !includeShipping;
              extrasRef.current = { ...extrasRef.current, includeShipping: next };
              setIncludeShipping(next);
              persistExtrasNow();
            }}
            onDraft={value => {
              extrasRef.current = { ...extrasRef.current, shippingDraft: value };
              setShippingDraft(value);
              persistExtrasSoon();
            }}
            onCommit={persistExtrasNow}
          />
          <ExtraRow
            emoji="✂️"
            label="Khấu trừ"
            on={includeDeduction}
            draft={deductionDraft}
            readOnly={readOnly}
            onToggle={() => {
              const next = !includeDeduction;
              extrasRef.current = { ...extrasRef.current, includeDeduction: next };
              setIncludeDeduction(next);
              persistExtrasNow();
            }}
            onDraft={value => {
              extrasRef.current = { ...extrasRef.current, deductionDraft: value };
              setDeductionDraft(value);
              persistExtrasSoon();
            }}
            onCommit={persistExtrasNow}
          />
          <div className="flex items-center justify-between gap-2 border-t border-border/50 px-2 py-2">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Tổng</span>
            <button
              type="button"
              onClick={() => setTotalOpen(true)}
              className="total-amount-hit hover:bg-muted/50"
              aria-label="Xem chi tiết tổng"
            >
              <MoneyLabel thousandsMode={vendorThousands} amount={grandTotal} className="text-base font-display" smallClassName="text-[0.7em]" />
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3">
          <p className="mb-2 text-xs font-medium text-primary">🧪 Thử nghiệm: Tạo đơn từ đầu</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setExpMode("single");
                setExpOpen(true);
              }}
              className="rounded-lg border border-border/60 bg-card px-2 py-2 text-center text-xs hover:border-primary/30"
            >
              Từng món
            </button>
            <button
              type="button"
              onClick={() => {
                setExpMode("bulk");
                setExpOpen(true);
                // Load catalog for bulk
                void (async () => {
                  try {
                    const { data } = await supabase.from("order_ingredients").select("id, name, unit, reference_price").limit(100);
                    if (data) setExpCatalog(data as any);
                  } catch {
                    /* ignore */
                  }
                })();
              }}
              className="rounded-lg border border-border/60 bg-card px-2 py-2 text-center text-xs hover:border-primary/30"
            >
              Chọn sỉ
            </button>
            <button
              type="button"
              onClick={() => {
                setExpMode("paste");
                setExpOpen(true);
                setExpPasteText("");
                setExpParsed([]);
              }}
              className="rounded-lg border border-border/60 bg-card px-2 py-2 text-center text-xs hover:border-primary/30"
            >
              Dán tin
            </button>
          </div>
        </div>
      </div>

      <Dialog open={!!holdItem} onOpenChange={open => !open && setHoldItemId(null)}>
        <DialogContent className="max-w-[92vw] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{holdItem?.name}</DialogTitle>
          </DialogHeader>
          {holdItem && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {holdMoney ? (
                  <>
                    Đặt{" "}
                    <MoneyLabel thousandsMode={vendorThousands}
                      amount={orderedAmount(holdItem)}
                      className="text-xs"
                      smallClassName="text-[0.7em]"
                    />
                  </>
                ) : (
                  `Đặt ${holdShown?.value} ${holdShown?.unit}`
                )}
              </p>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                  {holdMoney ? "Số tiền giao" : "Số lượng giao"}
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    inputMode={holdMoney ? "numeric" : "decimal"}
                    value={holdQty}
                    onChange={e => setHoldQty(e.target.value.replace(/[^\d.]/g, ""))}
                    className="h-10 text-center text-base tabular-nums"
                    onKeyDown={e => e.key === "Enter" && applyCustomQty()}
                  />
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {holdMoney ? "₫" : holdShown?.unit}
                  </span>
                </div>
              </div>
              <Button type="button" className="w-full" onClick={applyCustomQty}>
                Giao số này
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={applyOutOfStock}>
                ❌ Hết hàng
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={totalOpen} onOpenChange={setTotalOpen}>
        <DialogContent className="max-w-[92vw] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Chi tiết tổng</DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-0.5">
            {totalLines.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">Chưa có khoản nào trong tổng</p>
            ) : (
              totalLines.map(line => (
                <div key={line.key} className="flex items-start justify-between gap-3 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{line.name}</p>
                    {line.detail ? (
                      <p className="truncate text-[11px] text-muted-foreground">{line.detail}</p>
                    ) : null}
                  </div>
                  <span className="flex shrink-0 items-baseline text-sm">
                    {line.sign < 0 ? <span className="text-[#8a6a72]">−</span> : null}
                    <MoneyLabel thousandsMode={vendorThousands}
                      amount={line.amount}
                      className={cn("text-sm", line.sign < 0 && "text-[#8a6a72]")}
                      smallClassName="text-[0.7em]"
                    />
                  </span>
                </div>
              ))
            )}
          </div>
          {googleExpr ? (
            <p className="break-all font-mono text-[11px] leading-snug text-muted-foreground">{googleExpr}</p>
          ) : null}
          <div className="flex items-end justify-between gap-2 border-t border-border/50 pt-3">
            <button
              type="button"
              onClick={() => void copyGrandTotal()}
              className="min-w-0 rounded-lg px-1 py-0.5 text-left hover:bg-muted/50"
              aria-label="Sao chép tổng"
            >
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Tổng
                <Copy className="h-3 w-3" strokeWidth={2.4} />
              </span>
              <MoneyLabel thousandsMode={vendorThousands}
                amount={grandTotal}
                className="text-xl font-display"
                smallClassName="text-[0.65em]"
              />
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={!googleExpr && grandTotal <= 0}
              onClick={searchTotalOnGoogle}
            >
              <Search className="h-3.5 w-3.5" strokeWidth={2.4} />
              Google
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent className="max-w-[92vw] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Tạo đơn từ đầu (thử nghiệm)</DialogTitle>
          </DialogHeader>
          <div className="mb-3 flex gap-1 rounded-full bg-muted/40 p-1">
            {(["single", "bulk", "paste"] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setExpMode(m)}
                className={`flex-1 rounded-full px-2 py-1.5 text-xs font-medium ${expMode === m ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
              >
                {m === "single" ? "Từng món" : m === "bulk" ? "Chọn sỉ" : "Dán tin"}
              </button>
            ))}
          </div>

          {expMode === "single" && (
            <div className="space-y-3">
              <Input value={expSingleName} onChange={e => setExpSingleName(e.target.value)} placeholder="Tên nguyên liệu" className="h-9" />
              <div className="grid grid-cols-3 gap-2">
                <Input value={expSingleQty} onChange={e => setExpSingleQty(e.target.value.replace(/[^\d.]/g, ""))} placeholder="SL" inputMode="decimal" className="h-9 text-center" />
                <Input value={expSingleUnit} onChange={e => setExpSingleUnit(e.target.value)} placeholder="đv" className="h-9 text-center" />
                <Input value={expSinglePrice} onChange={e => setExpSinglePrice(e.target.value.replace(/[^\d]/g, ""))} placeholder="Đơn giá" inputMode="numeric" className="h-9 text-right" />
              </div>
              <Button
                type="button"
                className="w-full"
                disabled={!expSingleName.trim()}
                onClick={async () => {
                  const qty = Number(expSingleQty) || 1;
                  const price = Number(expSinglePrice) || 0;
                  try {
                    const { data, error } = await supabase.rpc("add_shared_order_alternate", {
                      p_token: token,
                      p_name: expSingleName.trim(),
                      p_quantity: qty,
                      p_unit: expSingleUnit.trim() || "kg",
                    });
                    if (error) throw error;
                    void price;
                    const row = (Array.isArray(data) ? data[0] : data) as SharedItem | null;
                    if (row) {
                      const next = [...itemsRef.current, { ...row, is_alternate: true }];
                      itemsRef.current = next;
                      setItems(next);
                    }
                    setExpSingleName("");
                    setExpSingleQty("1");
                    setExpSinglePrice("");
                    toast.success("Đã thêm");
                  } catch (err: any) {
                    toast.error(err.message || "Không thêm được");
                  }
                }}
              >
                Thêm món
              </Button>
            </div>
          )}

          {expMode === "bulk" && (
            <div className="space-y-3">
              <div className="max-h-[40vh] space-y-2 overflow-auto pr-1">
                {expCatalog.slice(0, 50).map(ing => {
                  const selected = expBulkSelected.has(ing.id);
                  return (
                    <label key={ing.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm ${selected ? "border-primary bg-primary/10" : "border-border/60 bg-card"}`}>
                      <input type="checkbox" checked={selected} onChange={() => setExpBulkSelected(prev => { const n = new Set(prev); if (n.has(ing.id)) n.delete(ing.id); else n.add(ing.id); return n; })} className="h-4 w-4" />
                      <span className="flex-1 truncate">{ing.name}</span>
                      <span className="text-[11px] text-muted-foreground">{ing.unit}</span>
                    </label>
                  );
                })}
              </div>
              <Button
                type="button"
                className="w-full"
                disabled={expBulkSelected.size === 0}
                onClick={async () => {
                  for (const id of expBulkSelected) {
                    const ing = expCatalog.find(c => c.id === id);
                    if (!ing) continue;
                    try {
                      await supabase.rpc("add_shared_order_alternate", {
                        p_token: token,
                        p_name: ing.name,
                        p_quantity: 1,
                        p_unit: ing.unit,
                      });
                    } catch {
                      /* ignore */
                    }
                  }
                  toast.success(`Đã thêm ${expBulkSelected.size} món`);
                  setExpBulkSelected(new Set());
                  // reload
                  const { data: rows } = await supabase.rpc("get_shared_order_items", { p_token: token });
                  if (rows) {
                    const next = rows as SharedItem[];
                    itemsRef.current = next;
                    setItems(next);
                  }
                }}
              >
                Thêm {expBulkSelected.size} món
              </Button>
            </div>
          )}

          {expMode === "paste" && (
            <div className="space-y-3">
              <textarea
                value={expPasteText}
                onChange={e => setExpPasteText(e.target.value)}
                placeholder={"2kg cà chua\n1.5kg rau muống\n3 gói đậu hũ"}
                className="min-h-[100px] w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary/40"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    import("@/lib/parseOrderText").then(({ parseOrderText }) => {
                      const parsed = parseOrderText(expPasteText, expCatalog as any);
                      setExpParsed(parsed);
                    });
                  }}
                >
                  Phân tích
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={expParsed.length === 0}
                  onClick={async () => {
                    for (const line of expParsed) {
                      try {
                        await supabase.rpc("add_shared_order_alternate", {
                          p_token: token,
                          p_name: line.name,
                          p_quantity: Number(line.quantity) || 1,
                          p_unit: line.unit || "kg",
                        });
                        if (!line.matched) {
                          // try to add to catalog for future matching
                          try {
                            await supabase.from("order_ingredients").insert({
                              name: line.name,
                              unit: line.unit || "kg",
                              category_id: expCatalog[0]?.id || catalogCats[0]?.id || "",
                              user_id: user?.id,
                            } as any);
                          } catch {
                            /* ignore */
                          }
                        }
                      } catch {
                        /* ignore */
                      }
                    }
                    toast.success(`Đã thêm ${expParsed.length} dòng`);
                    const { data: rows } = await supabase.rpc("get_shared_order_items", { p_token: token });
                    if (rows) {
                      const next = rows as SharedItem[];
                      itemsRef.current = next;
                      setItems(next);
                    }
                    setExpParsed([]);
                    setExpPasteText("");
                  }}
                >
                  Thêm tất cả
                </Button>
              </div>
              {expParsed.length > 0 && (
                <div className="max-h-[35vh] overflow-auto rounded-xl border border-border/60">
                  <div className="grid grid-cols-[auto_1fr_auto] gap-px bg-border/60">
                    <div className="bg-muted/40 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">SL</div>
                    <div className="bg-muted/40 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tên</div>
                    <div className="bg-muted/40 px-2 py-1 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Đơn giá</div>
                    {expParsed.map((line, idx) => (
                      <div key={idx} className={`contents ${!line.matched ? "bg-amber-50" : ""}`}>
                        <div className={`bg-card px-2 py-1.5 text-center text-xs tabular-nums ${!line.matched ? "bg-amber-50 text-amber-700" : ""}`}>
                          {line.quantity} {line.unit}
                        </div>
                        <div className={`bg-card px-2 py-1.5 text-xs ${!line.matched ? "bg-amber-50 text-amber-700 font-medium" : "text-foreground"}`}>
                          {line.name}
                          {!line.matched && <span className="ml-1 text-[10px] text-amber-600">• chưa có</span>}
                        </div>
                        <div className={`bg-card px-2 py-1.5 text-right text-xs tabular-nums ${!line.matched ? "bg-amber-50" : ""}`}>
                          {line.matched?.reference_price ? (
                            <MoneyLabel thousandsMode={vendorThousands} amount={line.matched.reference_price} className="text-xs" smallClassName="text-[0.7em]" />
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">Chưa khớp sẽ tô vàng — bấm “Thêm tất cả” sẽ tạo món và lưu tên vào DB để lần sau nhớ giá.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-sm safe-area-bottom">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Tổng đơn</span>
          <button
            type="button"
            onClick={() => setTotalOpen(true)}
            className="total-amount-hit hover:bg-muted/50"
            aria-label="Xem chi tiết tổng"
          >
            <MoneyLabel thousandsMode={vendorThousands}
              amount={grandTotal}
              className="text-xl font-display"
              smallClassName="text-[0.65em]"
            />
          </button>
          <button
            type="button"
            onClick={() => {
              const next = vendorThousands === "k" ? "none" : "k";
              setVendorThousands(next);
              try {
                localStorage.setItem("mise.vendor-thousands-suffix", next);
              } catch {
                /* ignore */
              }
            }}
            className="ml-auto shrink-0 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[10px] font-medium tabular-nums text-muted-foreground hover:border-primary/30 hover:text-foreground"
            aria-pressed={vendorThousands === "k"}
            aria-label={vendorThousands === "k" ? "Đang hiện k, bấm để ẩn" : "Đang ẩn, bấm để hiện k"}
          >
            {vendorThousands === "k" ? "k" : "Ẩn"}
          </button>
        </div>
      </div>
    </div>
  );
}
