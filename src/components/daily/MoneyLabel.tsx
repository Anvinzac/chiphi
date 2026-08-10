import { cn } from "@/lib/utils";

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
}: MoneyLabelProps) {
  const formatted =
    amount === 0 && zeroDisplay ? zeroDisplay : amount.toLocaleString(locale);
  const lastDot = formatted.lastIndexOf(".");

  const main = lastDot !== -1 ? formatted.slice(0, lastDot) : formatted;
  const small = lastDot !== -1 ? formatted.slice(lastDot + 1) : "";

  return (
    <span className={cn("tabular-nums whitespace-nowrap", className)}>
      {lastDot !== -1 ? (
        <>
          <span className={mainClassName}>{main}</span>
          <span className={cn("text-[0.75em] opacity-80", smallClassName)}>.{small}</span>
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
