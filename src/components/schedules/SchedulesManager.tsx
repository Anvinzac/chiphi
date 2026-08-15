import { useCallback, useEffect, useMemo, useState } from "react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { Check, Pause, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MoneyLabel from "@/components/daily/MoneyLabel";
import { formatDayMonth } from "@/lib/formatDateVi";
import { thousandsFromVnd, vndFromThousands } from "@/lib/vndThousands";
import { readLaggedSnapshot } from "@/lib/laggedSnapshot";
import {
  REPEAT_OPTIONS,
  scheduleAnchorFromDate,
  scheduleRepeatLabel,
  type ExpenseScheduleRow,
  type ScheduleRepeat,
} from "@/lib/expenseSchedule";

type RepeatId = Exclude<ScheduleRepeat, "none">;

interface SchedulesManagerProps {
  userId: string;
}

function dueLabel(nextDue: string) {
  try {
    const d = parseISO(nextDue);
    if (isToday(d)) return "Hôm nay";
    if (isYesterday(d)) return "Hôm qua";
    return format(d, "EEEE, d MMMM", { locale: vi });
  } catch {
    return formatDayMonth(parseISO(nextDue));
  }
}

export default function SchedulesManager({ userId }: SchedulesManagerProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [rows, setRows] = useState<ExpenseScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [repeat, setRepeat] = useState<RepeatId>("monthly");
  const [nextDue, setNextDue] = useState(today);
  const [amountK, setAmountK] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRepeat, setEditRepeat] = useState<RepeatId>("monthly");
  const [editNextDue, setEditNextDue] = useState(today);
  const [editAmountK, setEditAmountK] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("expense_schedules")
        .select("*")
        .eq("user_id", userId)
        .order("next_due", { ascending: true });
      if (error) throw error;
      setRows((data ?? []) as ExpenseScheduleRow[]);
    } catch (err: any) {
      const lagged = await readLaggedSnapshot(userId);
      if (lagged?.data.expense_schedules?.length) {
        setRows(lagged.data.expense_schedules as ExpenseScheduleRow[]);
      } else {
        toast.error(err?.message || "Không tải được lịch nhắc");
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const { active, paused } = useMemo(() => {
    const on: ExpenseScheduleRow[] = [];
    const off: ExpenseScheduleRow[] = [];
    for (const row of rows) (row.active ? on : off).push(row);
    const sortDue = (a: ExpenseScheduleRow, b: ExpenseScheduleRow) =>
      a.next_due.localeCompare(b.next_due) || a.item_name.localeCompare(b.item_name, "vi");
    return { active: on.sort(sortDue), paused: off.sort(sortDue) };
  }, [rows]);

  const addSchedule = async () => {
    const trimmed = name.trim();
    if (!trimmed || !nextDue || saving) return;
    setSaving(true);
    try {
      const meta = scheduleAnchorFromDate(nextDue);
      const { data, error } = await supabase
        .from("expense_schedules")
        .insert({
          user_id: userId,
          item_name: trimmed,
          last_amount: vndFromThousands(amountK),
          payment_method: "cash",
          repeat,
          next_due: nextDue,
          weekday: meta.weekday,
          month_day: meta.month_day,
          active: true,
        })
        .select("*")
        .single();
      if (error) throw error;
      if (data) {
        setRows(prev => [...prev, data as ExpenseScheduleRow]);
        setName("");
        setAmountK("");
        setNextDue(today);
        setRepeat("monthly");
        toast.success("Đã tạo lịch nhắc");
      }
    } catch (err: any) {
      toast.error(err?.message || "Không tạo được lịch nhắc");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: ExpenseScheduleRow) => {
    setEditingId(row.id);
    setEditName(row.item_name);
    setEditRepeat(row.repeat);
    setEditNextDue(row.next_due);
    setEditAmountK(thousandsFromVnd(Number(row.last_amount) || 0));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditAmountK("");
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim() || !editNextDue || saving) return;
    setSaving(true);
    try {
      const meta = scheduleAnchorFromDate(editNextDue);
      const { data, error } = await supabase
        .from("expense_schedules")
        .update({
          item_name: editName.trim(),
          last_amount: vndFromThousands(editAmountK),
          repeat: editRepeat,
          next_due: editNextDue,
          weekday: meta.weekday,
          month_day: meta.month_day,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId)
        .select("*")
        .single();
      if (error) throw error;
      if (data) {
        setRows(prev => prev.map(r => (r.id === editingId ? (data as ExpenseScheduleRow) : r)));
        cancelEdit();
        toast.success("Đã cập nhật");
      }
    } catch (err: any) {
      toast.error(err?.message || "Không lưu được");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: ExpenseScheduleRow) => {
    try {
      const { data, error } = await supabase
        .from("expense_schedules")
        .update({ active: !row.active, updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .select("*")
        .single();
      if (error) throw error;
      if (data) setRows(prev => prev.map(r => (r.id === row.id ? (data as ExpenseScheduleRow) : r)));
    } catch (err: any) {
      toast.error(err?.message || "Không đổi được trạng thái");
    }
  };

  const deleteRow = async (id: string) => {
    try {
      const { error } = await supabase.from("expense_schedules").delete().eq("id", id);
      if (error) throw error;
      setRows(prev => prev.filter(r => r.id !== id));
      if (editingId === id) cancelEdit();
      toast.success("Đã xóa lịch nhắc");
    } catch (err: any) {
      toast.error(err?.message || "Không xóa được");
    }
  };

  const RepeatChips = ({
    value,
    onChange,
  }: {
    value: RepeatId;
    onChange: (v: RepeatId) => void;
  }) => (
    <div className="flex flex-wrap gap-1.5">
      {REPEAT_OPTIONS.map(opt => {
        const on = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              on
                ? "border-primary/50 bg-primary/15 font-medium text-primary"
                : "border-border/60 bg-muted/70 text-foreground hover:border-primary/30"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  const renderRow = (row: ExpenseScheduleRow) => {
    const overdue = row.active && row.next_due < today;
    if (editingId === row.id) {
      return (
        <li key={row.id} className="p-3 space-y-2 bg-muted/30">
          <Input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder="Tên chi tiêu"
            className="text-sm"
          />
          <RepeatChips value={editRepeat} onChange={setEditRepeat} />
          <div className="flex gap-2">
            <Input
              type="date"
              value={editNextDue}
              onChange={e => setEditNextDue(e.target.value)}
              className="text-sm"
              aria-label="Ngày nhắc tiếp"
            />
            <div className="relative min-w-0 flex-1">
              <Input
                inputMode="decimal"
                value={editAmountK}
                onChange={e => setEditAmountK(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="Số tiền (nghìn)"
                className="text-sm pr-10"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                .000
              </span>
            </div>
          </div>
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelEdit}>
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="h-8 w-8"
              onClick={saveEdit}
              disabled={!editName.trim() || !editNextDue || saving}
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </li>
      );
    }

    return (
      <li key={row.id} className="flex items-start gap-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-foreground truncate">{row.item_name}</p>
            {Number(row.last_amount) > 0 && (
              <MoneyLabel
                amount={Number(row.last_amount)}
                className="text-xs font-display text-muted-foreground shrink-0"
                smallClassName="text-[0.7em]"
              />
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {scheduleRepeatLabel(row.repeat)}
            {" · "}
            <span className={overdue ? "font-medium text-destructive" : "text-foreground/80"}>
              {overdue ? "Quá hạn · " : "Tiếp theo · "}
              {dueLabel(row.next_due)}
            </span>
          </p>
          <p className="text-[10px] tabular-nums text-muted-foreground/80 mt-0.5">
            {row.next_due}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => toggleActive(row)}
          aria-label={row.active ? `Tạm dừng ${row.item_name}` : `Bật lại ${row.item_name}`}
        >
          {row.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => startEdit(row)}
          aria-label={`Sửa ${row.item_name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-destructive"
          onClick={() => deleteRow(row.id)}
          aria-label={`Xóa ${row.item_name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground px-0.5">
          Tạo lịch nhắc
        </p>
        <Input
          placeholder="Tên chi tiêu, ví dụ Thuê nhà…"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              addSchedule();
            }
          }}
        />
        <RepeatChips value={repeat} onChange={setRepeat} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Ngày nhắc tiếp
            </span>
            <Input
              type="date"
              value={nextDue}
              onChange={e => setNextDue(e.target.value)}
            />
          </label>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Số tiền gần nhất
            </span>
            <div className="relative">
              <Input
                inputMode="decimal"
                value={amountK}
                onChange={e => setAmountK(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="Tuỳ chọn"
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                .000 ₫
              </span>
            </div>
          </label>
        </div>
        <Button onClick={addSchedule} disabled={!name.trim() || !nextDue || saving} size="sm" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1" />
          Thêm nhắc
        </Button>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Đang tải...</p>
        ) : active.length === 0 && paused.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Chưa có lịch nhắc. Tạo một lịch, hoặc bật nhắc khi lưu chi tiêu.
          </p>
        ) : (
          <>
            {active.length > 0 && (
              <ul className="divide-y divide-border/50">{active.map(renderRow)}</ul>
            )}
            {paused.length > 0 && (
              <div className={active.length > 0 ? "border-t border-border/60" : ""}>
                <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Đã tạm dừng
                </p>
                <ul className="divide-y divide-border/50 opacity-70">{paused.map(renderRow)}</ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
