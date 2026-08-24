import { useRef, useState } from "react";
import { getCategoryVisual } from "@/lib/categoryVisuals";

interface BulkIngredient {
  id: string;
  name: string;
  unit: string;
}

interface Props {
  pages: { title: string; ings: BulkIngredient[] }[];
  selected: Set<string>;
  alreadyInOrder: (name: string) => boolean;
  onToggle: (ing: BulkIngredient, selected: boolean) => void;
}

export default function BulkIngredientPager({ pages, selected, alreadyInOrder, onToggle }: Props) {
  const [page, setPage] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const settle = () => {
    const el = ref.current;
    if (!el || el.clientWidth <= 0) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    setPage(Math.max(0, Math.min(next, pages.length - 1)));
  };

  if (pages.length === 0 || pages.every(p => p.ings.length === 0)) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Không có nguyên liệu</p>;
  }

  return (
    <>
      {pages.length > 1 && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {pages.map((pg, i) => {
              const emoji = pg.title ? getCategoryVisual(pg.title).emoji : getCategoryVisual(pg.ings[0]?.name).emoji;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    ref.current?.scrollTo({ left: i * (ref.current?.clientWidth || 0), behavior: "smooth" });
                    setPage(i);
                  }}
                  aria-label={`Trang ${i + 1}`}
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] transition-colors ${i === page ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {page + 1}/{pages.length}
          </span>
        </div>
      )}
      <div
        ref={ref}
        className="ingredient-chip-pager"
        onScroll={settle}
        onTouchEnd={settle}
        aria-label="Chọn sỉ — nguyên liệu"
      >
        {pages.map((pg, idx) => (
          <div key={pg.title || `page-${idx}`} className="ingredient-chip-page">
            <div className="ingredient-chip-track">
              {pg.ings.map(ing => {
                const sel = selected.has(ing.id);
                const already = alreadyInOrder(ing.name);
                return (
                  <label
                    key={ing.id}
                    className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                      sel ? "border-primary bg-primary/10" : already ? "border-border/50 bg-muted/30 opacity-50" : "border-border/60 bg-card hover:border-primary/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={sel}
                      disabled={already}
                      onChange={() => onToggle(ing, !sel)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                    />
                    <span className="min-w-0 flex-1 truncate">{ing.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{ing.unit}</span>
                    {already && !sel && <span className="shrink-0 text-[10px] text-muted-foreground">đã có</span>}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
