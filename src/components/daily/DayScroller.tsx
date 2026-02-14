import { useRef, useEffect } from "react";
import { format, subDays, isToday, isYesterday } from "date-fns";
import { CalendarDays } from "lucide-react";

interface DayScrollerProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onRequestCalendar: () => void;
}

export default function DayScroller({ selectedDate, onSelectDate, onRequestCalendar }: DayScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => subDays(today, i));

  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-date="${selectedDate}"]`);
    el?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [selectedDate]);

  const getLabel = (d: Date) => {
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yest.";
    return format(d, "EEE");
  };

  return (
    <div className="animate-in slide-in-from-top-2 fade-in duration-200">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto px-4 py-2 items-center"
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
              className={`flex-shrink-0 flex flex-col items-center px-3.5 py-1.5 rounded-xl transition-all duration-200 min-w-[3.8rem] ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className="text-[9px] uppercase tracking-wider font-medium">{getLabel(d)}</span>
              <span className="text-base font-display leading-tight">{format(d, "d")}</span>
            </button>
          );
        })}
        {/* More / Calendar button */}
        <button
          onClick={onRequestCalendar}
          className="flex-shrink-0 flex flex-col items-center px-3 py-1.5 rounded-xl bg-muted/30 text-muted-foreground hover:bg-muted transition-colors min-w-[3.8rem]"
        >
          <CalendarDays className="h-4 w-4 mb-0.5" />
          <span className="text-[9px] uppercase tracking-wider">More</span>
        </button>
      </div>
    </div>
  );
}
