import { cn } from "@/lib/utils";
import { formatVndParts, type ThousandsSuffixMode } from "@/lib/thousandsSuffix";
import { useThousandsSuffix } from "@/hooks/useThousandsSuffix";

interface MoneyLabelProps {
  amount: number;
  className?: string;
  mainClassName?: string;
  smallClassName?: string;
  suffix?: string;
  suffixClassName?: string;
  locale?: string;
  /** When amount is 0, render this instead (e.g. "0.000.000") to reserve layout width. */
  zeroDisplay?: string;
  thousandsMode?: ThousandsSuffixMode;
}

export default function MoneyLabel({
  amount,
  className,
  mainClassName,
  smallClassName,
  suffix = "₫",
  suffixClassName,
  locale = "vi-VN",
  zeroDisplay,
  thousandsMode,
}: MoneyLabelProps) {
  const [hookMode] = useThousandsSuffix();
  const mode = thousandsMode ?? hookMode;
  const usePlaceholder = amount === 0 && zeroDisplay && mode === "000";
  const { main, small } = usePlaceholder
    ? { main: zeroDisplay.slice(0, zeroDisplay.lastIndexOf(".")), small: `.${zeroDisplay.slice(zeroDisplay.lastIndexOf(".") + 1)}` }
    : formatVndParts(amount, mode, locale);

  return (
    <span className={cn("tabular-nums whitespace-nowrap", className)}>
      {small ? (
        <>
          <span className={mainClassName}>{main}</span>
          <span
            className={
              mode === "k"
                ? mainClassName
                : cn("text-[0.75em] opacity-80", smallClassName)
            }
          >
            {small}
          </span>
        </>
      ) : (
        <span className={mainClassName}>{main}</span>
      )}
      {suffix && (
        <span className={cn("ml-0.5 align-super text-[0.65em] opacity-60 -translate-y-0.5", suffixClassName)}>
          {suffix}
        </span>
      )}
    </span>
  );
}
