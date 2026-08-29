import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ClipboardList, Pencil, Plus, Trash2, Users, Check, X } from "lucide-react";
import { toast } from "sonner";
import SnapshotBanner from "@/components/SnapshotBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MoneyLabel from "@/components/daily/MoneyLabel";
import { useSalaryEmployees } from "@/hooks/useSalaryEmployees";
import { parseSalaryJson, type SalaryImportMeta } from "@/lib/salaryEmployees";
import { thousandsFromVnd, vndFromThousands } from "@/lib/vndThousands";

const JSON_EXAMPLE = `{
  "schema": {
    "version": "1.0",
    "description": "Payroll export",
    "employee_fields": {
      "account": "Login username",
      "name": "Display name",
      "amount": "Published gross salary (VND)",
      "deposit": "Optional advance held back",
      "transfer_amount": "Optional net = amount - deposit"
    }
  },
  "period": { "id": "2026-08", "start_date": "2026-08-01", "end_date": "2026-08-31", "label": "Tháng 8/2026" },
  "exported_at": "2026-08-29T05:00:00.000Z",
  "employees": [
    { "account": "tphi", "name": "T. Phi", "amount": 5000000 }
  ],
  "summary": {
    "employee_count": 1,
    "total_amount": 5000000,
    "total_deposit": 0,
    "total_transfer": 5000000
  }
}`;

function periodCaption(meta?: SalaryImportMeta) {
  const period = meta?.period;
  if (!period) return null;
  if (period.label) return period.label;
  if (period.start_date && period.end_date) return `${period.start_date} → ${period.end_date}`;
  return period.id ?? null;
}

export default function SalaryStaff() {
  const { employees, meta, addEmployee, replaceAll, updateEmployee, removeEmployee } = useSalaryEmployees();
  const [mode, setMode] = useState<"one" | "json">("one");
  const [name, setName] = useState("");
  const [thousands, setThousands] = useState("");
  const [paste, setPaste] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editThousands, setEditThousands] = useState("");
  const period = periodCaption(meta);

  const addOne = async () => {
    const row = await addEmployee(name, vndFromThousands(thousands));
    if (!row) {
      toast.error("Nhập tên nhân viên");
      return;
    }
    setName("");
    setThousands("");
    toast.success(`Đã thêm ${row.name}`);
  };

  const importJson = async () => {
    const result = parseSalaryJson(paste);
    if (result.ok === false) {
      toast.error(result.error);
      return;
    }
    await replaceAll(result.employees, result.meta);
    setPaste("");
    const label = periodCaption(result.meta);
    toast.success(label ? `Đã map ${result.employees.length} NV · ${label}` : `Đã map ${result.employees.length} nhân viên từ JSON`);
  };

  const startEdit = (id: string, currentName: string, amount: number) => {
    setEditingId(id);
    setEditName(currentName);
    setEditThousands(thousandsFromVnd(amount));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const nextName = editName.trim();
    if (!nextName) {
      toast.error("Tên không được trống");
      return;
    }
    await updateEmployee(editingId, { name: nextName, amount: vndFromThousands(editThousands) });
    setEditingId(null);
  };

  return (
    <div className="min-h-screen bg-background">
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
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0 text-primary" />
              <h1 className="font-display text-xl text-foreground">Nhân viên</h1>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Bảng lương Lương NV — nhập từng người hoặc dán JSON xuất lương
            </p>
          </div>
        </div>
      </div>

      <SnapshotBanner />

      <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <div className="grid grid-cols-2 gap-1.5">
          {(["one", "json"] as const).map(id => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                mode === id
                  ? "border-primary/45 bg-primary/10 text-foreground"
                  : "border-border/60 bg-muted/40 text-muted-foreground hover:border-primary/25 hover:text-foreground"
              }`}
            >
              {id === "one" ? (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Từng người
                </>
              ) : (
                <>
                  <ClipboardList className="h-3.5 w-3.5" />
                  Dán JSON
                </>
              )}
            </button>
          ))}
        </div>

        {mode === "one" ? (
          <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Tên nhân viên"
              className="h-9 text-sm"
              onKeyDown={e => {
                if (e.key === "Enter") addOne();
              }}
            />
            <div className="flex gap-2">
              <Input
                value={thousands}
                onChange={e => setThousands(e.target.value)}
                placeholder="Lương (nghìn đồng)"
                inputMode="decimal"
                className="h-9 flex-1 text-sm tabular-nums"
                onKeyDown={e => {
                  if (e.key === "Enter") addOne();
                }}
              />
              <Button type="button" size="sm" className="h-9 shrink-0" onClick={addOne}>
                Thêm
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Ví dụ 2800 = 2.800.000₫ · map vào amount (VND)</p>
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3">
            <textarea
              value={paste}
              onChange={e => setPaste(e.target.value)}
              placeholder={JSON_EXAMPLE}
              className="min-h-[160px] w-full rounded-xl border border-border bg-background p-3 font-mono text-xs outline-none focus:border-primary/40"
              spellCheck={false}
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Schema v1: <span className="font-mono">employees[]</span> với{" "}
              <span className="font-medium text-foreground">account</span>,{" "}
              <span className="font-medium text-foreground">name</span>,{" "}
              <span className="font-medium text-foreground">amount</span> (lương gộp, VND). Tùy chọn{" "}
              <span className="font-medium text-foreground">deposit</span> và{" "}
              <span className="font-medium text-foreground">transfer_amount</span>. Cũng nhận mảng employees thuần. Dán sẽ thay toàn bộ danh sách.
            </p>
            <Button type="button" className="w-full" disabled={!paste.trim()} onClick={importJson}>
              Map JSON vào danh sách
            </Button>
          </div>
        )}

        {employees.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Chưa có nhân viên — thêm hoặc dán JSON.</p>
        ) : (
          <>
            {period ? (
              <p className="px-1 text-[11px] text-muted-foreground">
                Kỳ lương: <span className="font-medium text-foreground">{period}</span>
                {meta?.summary?.employee_count != null ? ` · ${meta.summary.employee_count} NV trong file` : ""}
              </p>
            ) : null}
            <ul className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card">
              {employees.map(row => (
                <li key={row.id} className="px-3 py-2.5">
                  {editingId === row.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="h-8 text-sm"
                      />
                      <div className="flex gap-2">
                        <Input
                          value={editThousands}
                          onChange={e => setEditThousands(e.target.value)}
                          inputMode="decimal"
                          className="h-8 flex-1 text-sm tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                          aria-label="Lưu"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                          aria-label="Hủy"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{row.name}</span>
                        {row.account ? (
                          <span className="block truncate text-[11px] text-muted-foreground">{row.account}</span>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <MoneyLabel
                          amount={row.amount}
                          className="text-sm font-display"
                          smallClassName="text-[0.7em]"
                        />
                        {row.transfer_amount != null && row.transfer_amount !== row.amount ? (
                          <span className="mt-0.5 block text-[10px] text-muted-foreground">
                            CK {row.transfer_amount.toLocaleString("vi-VN")}₫
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => startEdit(row.id, row.name, row.amount)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Sửa ${row.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await removeEmployee(row.id);
                          toast.success(`Đã xóa ${row.name}`);
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Xóa ${row.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
