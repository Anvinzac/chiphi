import { useRef, useEffect } from "react";
import { format, subDays, isToday, isYesterday } from "date-fns";

interface DayScrollerProps {
  selectedDate: string; // yyyy-MM-dd
  onSelectDate: (date: string) => void;
}

export default function DayScroller({ selectedDate, onSelectDate }: DayScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  // Show today + 6 past days
  const days = Array.from({ length: 7 }, (_, i) => subDays(today, i));

  useEffect(() => {
    // Scroll selected into view
    const el = scrollRef.current?.querySelector(`[data-date="${selectedDate}"]`);
    el?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [selectedDate]);

  const getLabel = (d: Date) => {
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return format(d, "EEE");
  };

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-2"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {days.map((d) => {
        const dateStr = format(d, "yyyy-MM-dd");
        const isSelected = dateStr === selectedDate;
        return (
          <button
            key={dateStr}
            data-date={dateStr}
            onClick={() => onSelectDate(dateStr)}
            className={`flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-xl transition-all duration-200 min-w-[4.5rem] ${
              isSelected
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            <span className="text-[10px] uppercase tracking-wider font-medium">
              {getLabel(d)}
            </span>
            <span className={`text-lg font-display leading-tight ${isSelected ? "" : ""}`}>
              {format(d, "d")}
            </span>
            <span className="text-[9px] opacity-70">{format(d, "MMM")}</span>
          </button>
        );
      })}
    </div>
  );
}
