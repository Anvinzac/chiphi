import { cn } from "@/lib/utils";
import { thousandsInputMark } from "@/lib/thousandsSuffix";
import { useThousandsSuffix } from "@/hooks/useThousandsSuffix";

export default function ThousandsMark({ className }: { className?: string }) {
  const [mode] = useThousandsSuffix();
  const text = thousandsInputMark(mode);
  if (!text) return null;
  return <span className={cn("tabular-nums", className)}>{text}</span>;
}
