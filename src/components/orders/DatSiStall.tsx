import { useEffect, useMemo, useRef, useState } from "react";
import { aisleMeta, aisleWalkIndex, searchAisleMeta, type AisleMeta } from "@/lib/orderAisles";

export type StallIngredient = {
  id: string;
  name: string;
  unit: string;
  subcategory: string | null;
};

type Aisle = AisleMeta & { ings: StallIngredient[] };

interface Props {
  ingredients: StallIngredient[];
  searching: boolean;
  search: string;
  onSearch: (q: string) => void;
  pickedLabel: (name: string) => string | null;
  frequentDot: (name: string) => string | null;
  onPick: (ing: StallIngredient) => void;
}

const TILE_MIN = 72;
const GAP = 8;

function buildAisles(ingredients: StallIngredient[], searching: boolean): Aisle[] {
  if (searching) {
    return [{ ...searchAisleMeta(), ings: ingredients }];
  }
  const map = new Map<string, Aisle>();
  for (const ing of ingredients) {
    const meta = aisleMeta(ing.subcategory);
    const aisle = map.get(meta.key);
    if (aisle) aisle.ings.push(ing);
    else map.set(meta.key, { ...meta, ings: [ing] });
  }
  return Array.from(map.values()).sort((a, b) => {
    const walk = aisleWalkIndex(a.key) - aisleWalkIndex(b.key);
    if (walk !== 0) return walk;
    return a.title.localeCompare(b.title, "vi");
  });
}

export default function DatSiStall({
  ingredients,
  searching,
  search,
  onSearch,
  pickedLabel,
  frequentDot,
  onPick,
}: Props) {
  const aisles = useMemo(() => buildAisles(ingredients, searching), [ingredients, searching]);
  const [aisleIdx, setAisleIdx] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const boardRef = useRef<HTMLDivElement>(null);
  const pagerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAisleIdx(0);
    setPage(0);
  }, [searching, aisles.length]);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      const cols = w >= 420 ? 3 : 2;
      const rows = Math.max(2, Math.floor((h + GAP) / (TILE_MIN + GAP)));
      setPageSize(cols * rows);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const aisle = aisles[Math.min(aisleIdx, Math.max(0, aisles.length - 1))] ?? null;
  const pages = useMemo(() => {
    if (!aisle) return [];
    const out: StallIngredient[][] = [];
    for (let i = 0; i < aisle.ings.length; i += pageSize) {
      out.push(aisle.ings.slice(i, i + pageSize));
    }
    return out.length > 0 ? out : [[]];
  }, [aisle, pageSize]);

  useEffect(() => {
    setPage(0);
    pagerRef.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [aisleIdx, pageSize, aisle?.key]);

  const settle = () => {
    const el = pagerRef.current;
    if (!el || el.clientWidth <= 0) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    setPage(Math.max(0, Math.min(next, pages.length - 1)));
  };

  const goAisle = (idx: number) => {
    setAisleIdx(idx);
  };

  const pickedInAisle = (a: Aisle) => a.ings.filter(ing => pickedLabel(ing.name)).length;

  if (!aisle) {
    return (
      <div className="dat-si-stall flex min-h-0 flex-1 items-center justify-center px-4">
        <p className="text-center text-sm text-muted-foreground">Sạp trống — không có nguyên liệu</p>
      </div>
    );
  }

  return (
    <div className="dat-si-stall flex min-h-0 flex-1 flex-col">
      {aisles.length > 1 && (
        <div className="dat-si-aisles" role="tablist" aria-label="Sạp">
          {aisles.map((a, i) => {
            const active = i === aisleIdx;
            const n = pickedInAisle(a);
            return (
              <button
                key={a.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => goAisle(i)}
                className={`dat-si-aisle${active ? " dat-si-aisle--on" : ""}`}
                style={{ background: active ? a.fill : undefined, color: active ? a.ink : undefined }}
              >
                <span aria-hidden>{a.emoji}</span>
                <span>{a.title}</span>
                {n > 0 ? <span className="dat-si-aisle__pip">{n}</span> : null}
              </button>
            );
          })}
        </div>
      )}

      <div className="dat-si-stall__head">
        <p className="dat-si-stall__sign">
          <span aria-hidden>{aisle.emoji}</span>
          Sạp {aisle.title}
          <span className="dat-si-stall__meta">
            {aisle.ings.length} món
            {pages.length > 1 ? ` · ${page + 1}/${pages.length}` : ""}
          </span>
        </p>
        <label className="dat-si-call">
          <span className="sr-only">Gọi sạp</span>
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Gọi sạp…"
            className="dat-si-call__input"
            autoComplete="off"
            autoCorrect="off"
          />
        </label>
      </div>

      <div ref={boardRef} className="dat-si-board">
        <div
          ref={pagerRef}
          className="dat-si-pager"
          onScroll={settle}
          onTouchEnd={settle}
          aria-label={`Sạp ${aisle.title}`}
        >
          {pages.map((tray, pageIdx) => (
            <div key={`${aisle.key}-${pageIdx}`} className="dat-si-tray">
              {tray.map(ing => {
                const qty = pickedLabel(ing.name);
                const picked = Boolean(qty);
                const dot = frequentDot(ing.name);
                return (
                  <button
                    key={ing.id}
                    type="button"
                    onClick={() => onPick(ing)}
                    className={`dat-si-crate${picked ? " dat-si-crate--in" : ""}`}
                    style={{ background: picked ? aisle.fill : undefined, color: picked ? aisle.ink : undefined }}
                    aria-pressed={picked}
                  >
                    <span className="dat-si-crate__top">
                      {qty ? (
                        <span className="dat-si-crate__qty">{qty}</span>
                      ) : (
                        <span className="dat-si-crate__unit">{ing.unit}</span>
                      )}
                      {dot ? <span className={`dat-si-crate__dot ${dot}`} aria-hidden /> : null}
                    </span>
                    <span className="dat-si-crate__name">{ing.name}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {pages.length > 1 && (
        <div className="dat-si-dots" aria-hidden>
          {pages.map((_, i) => (
            <span key={i} className={`dat-si-dot${i === page ? " dat-si-dot--on" : ""}`} />
          ))}
        </div>
      )}
    </div>
  );
}
