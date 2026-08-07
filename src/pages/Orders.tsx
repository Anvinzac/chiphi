import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { generateShareToken, hashPin } from "@/lib/orderShare";
import { Button } from "@/components/ui/button";

type OrderRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  shared: "Đã gửi",
  closed: "Đóng",
};

export default function Orders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id, title, status, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    else setOrders((data as OrderRow[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const createOrder = async () => {
    if (!user || creating) return;
    setCreating(true);
    try {
      const pin = "1234"; // default PIN; staff can change on detail
      const { data, error } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          title: `Đơn ${format(new Date(), "d/M HH:mm")}`,
          status: "draft",
          share_token: generateShareToken(),
          supplier_pin_hash: await hashPin(pin),
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Đã tạo đơn (PIN mặc định: 1234)");
      navigate(`/orders/${data.id}`);
    } catch (err: any) {
      toast.error(err.message || "Không tạo được đơn");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
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
            <p className="text-[11px] text-muted-foreground">Tạo đơn gửi nhà cung cấp</p>
          </div>
          <Button size="sm" onClick={createOrder} disabled={creating} className="gap-1">
            <Plus className="h-4 w-4" />
            Mới
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-4 space-y-2">
        {loading && (
          <p className="py-8 text-center text-sm text-muted-foreground">Đang tải…</p>
        )}
        {!loading && orders.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground mb-3">Chưa có đơn nào</p>
            <Button onClick={createOrder} disabled={creating}>
              Tạo đơn đầu tiên
            </Button>
          </div>
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
      </div>
    </div>
  );
}
