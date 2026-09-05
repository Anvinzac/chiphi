import { useEffect, useState } from "react";
import { localDateKey, msUntilNextLocalMidnight } from "@/lib/localDate";

/** Local calendar date that rolls at midnight and when the tab becomes visible again. */
export function useLocalToday(): string {
  const [todayStr, setTodayStr] = useState(localDateKey);

  useEffect(() => {
    let timeoutId = 0;
    const sync = () => setTodayStr(localDateKey());
    const arm = () => {
      timeoutId = window.setTimeout(() => {
        sync();
        arm();
      }, msUntilNextLocalMidnight() + 50);
    };
    arm();
    const onVis = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return todayStr;
}
