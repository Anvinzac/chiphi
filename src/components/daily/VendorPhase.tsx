import { useMemo, useState } from "react";
import { ArrowLeft, Check, Plus, Store } from "lucide-react";
import ClearFieldButton from "./ClearFieldButton";

export type VendorOption = {
  id: string;
  name: string;
  contact?: string | null;
};

interface VendorPhaseProps {
  vendors: VendorOption[];
  frequentVendorIds: string[];
  defaultVendorId: string | null;
  selectedVendorId: string | null;
  selectedVendorName: string;
  onSelect: (vendor: { id: string | null; name: string }) => void;
  onCreate: (name: string) => Promise<VendorOption | null>;
  onDone: () => void;
  onBack?: () => void;
  /** Search + list only — sits in the amount-page keypad slot. */
  embedded?: boolean;
}

export default function VendorPhase({
  vendors,
  frequentVendorIds,
  defaultVendorId,
  selectedVendorId,
  selectedVendorName,
  onSelect,
  onCreate,
  onDone,
  onBack,
  embedded = false,
}: VendorPhaseProps) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return vendors;
    return vendors.filter(v => v.name.toLowerCase().includes(q));
  }, [vendors, q]);

  const frequent = useMemo(() => {
    const byId = new Map(vendors.map(v => [v.id, v]));
    return frequentVendorIds
      .map(id => byId.get(id))
      .filter((v): v is VendorOption => !!v)
      .slice(0, 6);
  }, [vendors, frequentVendorIds]);

  const defaultVendor = defaultVendorId
    ? vendors.find(v => v.id === defaultVendorId) ?? null
    : null;

  const exactMatch = q
    ? vendors.some(v => v.name.toLowerCase() === q)
    : false;

  const pick = (id: string | null, name: string) => {
    onSelect({ id, name });
    onDone();
  };

  const handleCreate = async () => {
    const name = query.trim();
    if (!name || creating || exactMatch) return;
    setCreating(true);
    try {
      const created = await onCreate(name);
      if (created) pick(created.id, created.name);
    } finally {
      setCreating(false);
    }
  };

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors active:scale-95 ${
      active
        ? "border-primary/50 bg-primary/15 font-medium text-primary"
        : "border-border/60 bg-muted/70 text-foreground hover:border-primary/30"
    }`;

  const body = (
    <>
      <div className="shrink-0 mb-2">
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
          <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tìm hoặc thêm nhà cung cấp..."
            className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/45 caret-primary"
            autoComplete="off"
            aria-label="Tìm nhà cung cấp"
            onFocus={() => {
              window.scrollTo(0, 0);
              requestAnimationFrame(() => window.scrollTo(0, 0));
            }}
          />
          <ClearFieldButton
            visible={query.length > 0}
            size="sm"
            label="Xóa tìm kiếm"
            onClear={() => setQuery("")}
          />
        </div>
        {!embedded && (selectedVendorName || selectedVendorId) && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Đang chọn:{" "}
            <span className="font-medium text-foreground">
              {selectedVendorName || "—"}
            </span>
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar space-y-4 pb-2">
        <section>
          <button
            type="button"
            onClick={() => pick(null, "")}
            className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
              !selectedVendorId && !selectedVendorName
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/50 bg-card text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Không chọn nhà cung cấp
          </button>
        </section>

        {defaultVendor && (
          <section>
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Mặc định mặt hàng
            </p>
            <button
              type="button"
              onClick={() => pick(defaultVendor.id, defaultVendor.name)}
              className={chipClass(selectedVendorId === defaultVendor.id)}
            >
              {defaultVendor.name}
            </button>
          </section>
        )}

        {frequent.length > 0 && (
          <section>
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Thường dùng
            </p>
            <div className="flex flex-wrap gap-2">
              {frequent.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => pick(v.id, v.name)}
                  className={chipClass(selectedVendorId === v.id)}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {q ? "Kết quả" : "Tất cả"}
          </p>
          {q && !exactMatch && (
            <button
              type="button"
              disabled={creating}
              onClick={handleCreate}
              className="mb-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-primary/35 bg-primary/5 px-3 py-2.5 text-left text-sm text-primary"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Thêm “{query.trim()}”
            </button>
          )}
          {filtered.length === 0 && !q ? (
            <p className="text-xs text-muted-foreground">Chưa có nhà cung cấp nào</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">Không tìm thấy</p>
          ) : (
            <ul className="space-y-1">
              {filtered.map(v => {
                const active = selectedVendorId === v.id;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => pick(v.id, v.name)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        active
                          ? "border-primary/40 bg-primary/10"
                          : "border-transparent bg-muted/40 hover:bg-muted"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className={`block text-sm ${active ? "font-medium text-primary" : "text-foreground"}`}>
                          {v.name}
                        </span>
                        {v.contact && (
                          <span className="block text-[11px] text-muted-foreground mt-0.5">
                            {v.contact}
                          </span>
                        )}
                      </span>
                      {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {body}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col px-5 pt-2 pb-3">
      <div className="flex shrink-0 items-center justify-between mb-3">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-11 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Quay lại số tiền"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Số tiền
        </button>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Nhà cung cấp
        </span>
        <button
          type="button"
          onClick={onDone}
          className="flex min-h-11 items-center gap-1 text-xs font-medium text-primary"
        >
          Xong <Check className="h-3.5 w-3.5" />
        </button>
      </div>
      {body}
    </div>
  );
}
