import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import MoneyLabel from "./MoneyLabel";

interface DaySectionProps {
  title: string;
  total?: number;
  meta?: ReactNode;
  onAdd?: () => void;
  addLabel?: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}

/** Day heading that toggles its details; details sit behind a leading vertical rule. */
export default function DaySection({
  title,
  total = 0,
  meta,
  onAdd,
  addLabel = "Thêm chi tiêu ngày này",
  children,
  defaultExpanded = true,
}: DaySectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const showDayTotal = meta == null;

  return (
    <section className="mb-5">
      <div className="sticky top-0 z-10 -mx-1 mb-1.5 flex w-[calc(100%+0.5rem)] items-center rounded-lg bg-background/95 px-1 py-1 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-2 text-left transition-colors hover:bg-muted/40"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <h2 className="min-w-0 flex-1 truncate font-display text-base capitalize leading-none text-foreground">
            {title}
          </h2>
          {!expanded && showDayTotal ? (
            <MoneyLabel
              amount={total}
              className="shrink-0 text-xs text-muted-foreground"
              smallClassName="text-[0.7em]"
            />
          ) : meta != null ? (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{meta}</span>
          ) : null}
        </button>
        {expanded && onAdd ? (
          <>
            <div className="w-[10%] shrink-0 self-stretch" aria-hidden />
            <button
              type="button"
              onClick={onAdd}
              aria-label={addLabel}
              data-no-double-tap
              className="inline-flex h-8 w-16 shrink-0 items-center justify-center rounded-full text-muted-foreground/80 transition-colors hover:bg-muted hover:text-foreground active:scale-95"
            >
              <Plus className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </>
        ) : null}
      </div>

      {expanded && (
        <div className="ml-5 border-l border-border/50 pl-3 animate-in fade-in slide-in-from-top-1 duration-150">
          {children}
          {showDayTotal && (
            <div className="mt-0.5 flex justify-end border-t border-border/40 px-3 py-2.5">
              <MoneyLabel
                amount={total}
                className="text-sm text-foreground/85"
                smallClassName="text-[0.7em]"
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
