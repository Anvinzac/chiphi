import { X } from "lucide-react";

interface ClearFieldButtonProps {
  visible: boolean;
  onClear: () => void;
  label?: string;
  className?: string;
  /** Smaller hit target for dense inline editors */
  size?: "sm" | "md";
}

/** Circular × that appears whenever a field has content — tap to clear instead of holding backspace. */
export default function ClearFieldButton({
  visible,
  onClear,
  label = "Xóa nội dung",
  className = "",
  size = "md",
}: ClearFieldButtonProps) {
  if (!visible) return null;

  const dim = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const icon = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground active:scale-95 ${className}`}
      onMouseDown={(e) => {
        // Keep focus in the field; avoid blur-commit races on inline editors
        e.preventDefault();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClear();
      }}
    >
      <X className={icon} strokeWidth={2.5} />
    </button>
  );
}
