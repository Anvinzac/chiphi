import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import MoneyLabel from "./MoneyLabel";

interface DaySectionProps {
  title: string;
  total?: number;
  meta?: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
}

/** Day heading that toggles its details; details sit behind a leading vertical rule. */
export default function DaySection({
  title,
  total = 0,
  meta,
  children,
  defaultExpanded = true,
}: DaySectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className="mb-5">
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        aria-expanded={expanded}
        className="sticky top-0 z-10 -mx-1 mb-1.5 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded-lg bg-background/95 px-1 py-2 backdrop-blur-sm transition-colors hover:bg-muted/40"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <h2 className="min-w-0 flex-1 truncate text-left font-display text-base capitalize leading-none text-foreground">
          {title}
        </h2>
        {meta != null ? (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{meta}</span>
        ) : (
          <MoneyLabel
            amount={total}
            className="shrink-0 text-xs text-muted-foreground"
            smallClassName="text-[0.7em]"
          />
        )}
      </button>

      {expanded && (
        <div className="ml-5 border-l border-border/50 pl-3 animate-in fade-in slide-in-from-top-1 duration-150">
          {children}
        </div>
      )}
    </section>
  );
}
