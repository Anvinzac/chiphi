import { useEffect, useState, useRef, useCallback } from "react";
import type { VerifyData } from "@/types/expense";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check } from "lucide-react";

interface QuickVerifyPopupProps {
  data: VerifyData;
  onSave: (updated: VerifyData) => void;
  onDismiss: () => void;
}

export default function QuickVerifyPopup({ data, onSave, onDismiss }: QuickVerifyPopupProps) {
  const [countdown, setCountdown] = useState(5);
  const [paused, setPaused] = useState(false);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<VerifyData>(data);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [paused, onDismiss]);

  const handleInteract = useCallback(() => {
    if (!paused) {
      setPaused(true);
      clearInterval(timerRef.current);
    }
  }, [paused]);

  const handleEdit = (field: string) => {
    handleInteract();
    setEditField(field);
  };

  const fields = [
    { key: "supplierName", label: "Supplier" },
    { key: "categoryName", label: "Category" },
    { key: "subCategoryName", label: "Sub-category" },
    { key: "unitPrice", label: `Unit Price (/${editValues.unit})` },
  ];

  // Countdown ring
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const progress = (countdown / 5) * circumference;

  return (
    <div
      ref={containerRef}
      className="card-editorial quick-verify-enter p-4 mt-2 relative"
      role="dialog"
      aria-label="Verify expense details"
      onMouseEnter={handleInteract}
      onFocus={handleInteract}
    >
      {/* Countdown */}
      {!paused && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5" aria-live="polite">
          <svg width="34" height="34" className="-rotate-90">
            <circle cx="17" cy="17" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="2.5" />
            <circle
              cx="17" cy="17" r={radius} fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2.5"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              className="countdown-ring"
            />
          </svg>
          <span className="text-xs text-muted-foreground absolute inset-0 flex items-center justify-center font-medium">
            {countdown}
          </span>
        </div>
      )}

      <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
        Quick Verify
      </p>

      <div className="space-y-2">
        {fields.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground min-w-[100px]">{label}</span>
            {editField === key ? (
              <div className="flex items-center gap-1.5 flex-1">
                <Input
                  autoFocus
                  className="h-7 text-sm"
                  value={String(editValues[key as keyof VerifyData] ?? "")}
                  onChange={(e) => setEditValues(prev => ({
                    ...prev,
                    [key]: key === "unitPrice" ? Number(e.target.value) || 0 : e.target.value,
                  }))}
                  onKeyDown={(e) => e.key === "Enter" && setEditField(null)}
                  aria-label={`Edit ${label}`}
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditField(null)} aria-label="Confirm edit">
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-1">
                <span className="font-medium truncate">{String(editValues[key as keyof VerifyData] ?? "—")}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 ml-auto shrink-0" onClick={() => handleEdit(key)} aria-label={`Edit ${label}`}>
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {paused && (
        <div className="flex justify-end mt-3 pt-3 border-t border-border">
          <Button size="sm" onClick={() => onSave(editValues)} className="gap-1.5">
            <Check className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
