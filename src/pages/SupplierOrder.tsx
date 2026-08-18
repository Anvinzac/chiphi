import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  isOrderPinUnlocked,
  markOrderPinUnlocked,
} from "@/lib/orderShare";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MoneyLabel from "@/components/daily/MoneyLabel";

type SharedOrder = {
  id: string;
  title: string;
  status: string;
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
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Chờ" },
  { value: "partial", label: "Một phần" },
  { value: "done", label: "Xong" },
] as const;

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

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const { data: orders, error } = await supabase.rpc("get_shared_order", {
      p_token: token,
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const row = Array.isArray(orders) ? orders[0] : orders;
    if (!row) {
      setOrder(null);
      setItems([]);
      setLoading(false);
      return;
    }
    setOrder(row as SharedOrder);

    const { data: rows, error: itemsErr } = await supabase.rpc("get_shared_order_items", {
      p_token: token,
    });
    if (itemsErr) toast.error(itemsErr.message);
    setItems((rows as SharedItem[]) || []);
    setUnlocked(isOrderPinUnlocked(token));
    setLoading(false);
  }, [token]);

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
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  };

  const saveItem = async (item: SharedItem) => {
    setSavingId(item.id);
    try {
      const { error } = await supabase.rpc("update_shared_order_item", {
        p_token: token,
        p_item_id: item.id,
        p_retail_price: item.retail_price ?? 0,
        p_fulfilled_qty: item.fulfilled_qty ?? item.quantity,
        p_status: item.status,
        p_notice: item.notice ?? "",
      });
      if (error) throw error;
      toast.success(`Đã lưu ${item.name}`);
    } catch (err: any) {
      toast.error(err.message || "Lưu thất bại");
    } finally {
      setSavingId(null);
    }
  };

  const lineTotal = (item: SharedItem) => {
    const qty = Number(item.fulfilled_qty ?? item.quantity) || 0;
    const price = Number(item.retail_price) || 0;
    return qty * price;
  };

  const grandTotal = useMemo(
    () => items.reduce((sum, item) => sum + lineTotal(item), 0),
    [items],
  );

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
        <div>
          <p className="font-display text-xl text-foreground mb-2">Không tìm thấy đơn</p>
          <p className="text-sm text-muted-foreground">Link có thể sai hoặc đơn đã đóng.</p>
        </div>
      </div>
    );
  }

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
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Mìsè đặt hàng</p>
            <h1 className="font-display text-2xl text-foreground mt-1">{order.title}</h1>
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

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-start gap-3">
          {fromOrderId && (
            <Link
              to={`/orders/${fromOrderId}`}
              className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Quay lại đơn"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Đơn nhà cung cấp</p>
            <h1 className="font-display text-xl text-foreground">{order.title}</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-3 px-4 py-4">
        {items.map(item => {
          const total = lineTotal(item);
          return (
            <div key={item.id} className="rounded-2xl border border-border/60 bg-card p-3 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Đặt: {item.quantity} {item.unit}
                  </p>
                </div>
                <MoneyLabel
                  amount={total}
                  className="text-sm font-display"
                  smallClassName="text-[0.7em]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                    Giá bán (₫)
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    disabled={readOnly}
                    value={item.retail_price ?? ""}
                    onChange={e =>
                      updateLocal(item.id, {
                        retail_price: e.target.value === "" ? null : Number(e.target.value.replace(/\D/g, "")) || 0,
                      })
                    }
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                    SL giao
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    disabled={readOnly}
                    value={item.fulfilled_qty ?? item.quantity}
                    onChange={e =>
                      updateLocal(item.id, {
                        fulfilled_qty: Number(e.target.value.replace(/[^\d.]/g, "")) || 0,
                      })
                    }
                    className="h-9"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                  Trạng thái
                </label>
                <div className="flex gap-1.5">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={readOnly}
                      onClick={() => updateLocal(item.id, { status: opt.value })}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                        item.status === opt.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                  Ghi chú
                </label>
                <Input
                  disabled={readOnly}
                  value={item.notice ?? ""}
                  onChange={e => updateLocal(item.id, { notice: e.target.value })}
                  placeholder="Ghi chú thêm…"
                  className="h-9"
                />
              </div>

              {!readOnly && (
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={savingId === item.id}
                  onClick={() => saveItem(item)}
                >
                  {savingId === item.id ? "Đang lưu…" : "Lưu dòng này"}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-sm safe-area-bottom">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Tổng đơn</span>
          <MoneyLabel
            amount={grandTotal}
            className="text-xl font-display"
            smallClassName="text-[0.65em]"
          />
        </div>
      </div>
    </div>
  );
}
