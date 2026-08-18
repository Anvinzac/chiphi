import { Check } from "lucide-react";
import ClearFieldButton from "./ClearFieldButton";

export const SEARCH_BAR_HEIGHT = 48;
export const SEARCH_PULL_OPEN_PX = 42;

interface ListSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onDismiss: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

/** Compact list search: clear lives in the field, check closes the bar. */
export default function ListSearchBar({
  query,
  onQueryChange,
  onDismiss,
  inputRef,
}: ListSearchBarProps) {
  return (
    <div className="flex h-12 items-center gap-2" data-no-double-tap>
      <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-border/50 bg-muted/45 px-3 py-1.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]">
        <span className="sr-only">Tìm chi tiêu</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Tìm chi tiêu"
          className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/45 caret-primary"
          autoComplete="off"
          enterKeyHint="search"
          aria-label="Tìm chi tiêu"
        />
        <ClearFieldButton
          visible={query.length > 0}
          onClear={() => onQueryChange("")}
          label="Xóa tìm kiếm"
          size="sm"
        />
      </label>
      <button
        type="button"
        onClick={onDismiss}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary transition-colors hover:bg-primary/25 active:scale-95"
        aria-label="Đóng tìm kiếm"
      >
        <Check className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
