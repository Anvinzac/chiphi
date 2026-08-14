import { useEffect, useRef } from "react";
import { ArrowLeft, Camera, Check, ImageIcon, Trash2 } from "lucide-react";

interface ReceiptPhaseProps {
  previewUrl: string | null;
  onPickFile: (file: File | null) => void;
  onBack: () => void;
  onSave: () => void;
  saving?: boolean;
  canSave: boolean;
}

export default function ReceiptPhase({
  previewUrl,
  onPickFile,
  onBack,
  onSave,
  saving = false,
  canSave,
}: ReceiptPhaseProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      // parent owns the object URL
    };
  }, []);

  const handleFile = (file: File | undefined) => {
    onPickFile(file ?? null);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col px-5 pt-2 pb-3">
      <div className="flex shrink-0 items-center justify-between mb-3">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-11 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Quay lại nâng cao"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Nâng cao
        </button>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Biên lai
        </span>
        <span className="w-16" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar space-y-4">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Ảnh xác nhận giao dịch (tuỳ chọn). Cho phép camera để chụp, hoặc chọn từ thư viện.
        </p>

        {previewUrl ? (
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-muted/30">
            <img
              src={previewUrl}
              alt="Biên lai"
              className="max-h-52 w-full object-contain bg-black/5"
            />
            <button
              type="button"
              onClick={() => onPickFile(null)}
              className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-destructive shadow-sm"
              aria-label="Xóa ảnh"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/30 px-4 py-10 text-center">
            <Camera className="h-7 w-7 text-muted-foreground/70 mb-2" />
            <p className="text-sm text-muted-foreground">Chưa có ảnh biên lai</p>
          </div>
        )}

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={e => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={e => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-3 py-3 text-sm font-medium text-primary"
          >
            <Camera className="h-4 w-4" />
            Chụp ảnh
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/60 px-3 py-3 text-sm font-medium text-foreground"
          >
            <ImageIcon className="h-4 w-4" />
            Thư viện
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={!canSave || saving}
        className="mt-3 shrink-0 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-warm disabled:opacity-30"
      >
        <Check className="mr-1.5 -mt-0.5 inline-block h-4 w-4" />
        {saving ? "Đang lưu…" : "Lưu chi tiêu"}
      </button>
    </div>
  );
}
