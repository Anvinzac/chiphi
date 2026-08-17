import { useEffect, useState } from "react";
import {
  getThousandsSuffix,
  setThousandsSuffix,
  THOUSANDS_SUFFIX_EVENT,
  type ThousandsSuffixMode,
} from "@/lib/thousandsSuffix";

export function useThousandsSuffix() {
  const [mode, setModeState] = useState<ThousandsSuffixMode>(getThousandsSuffix);

  useEffect(() => {
    const sync = () => setModeState(getThousandsSuffix());
    window.addEventListener(THOUSANDS_SUFFIX_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(THOUSANDS_SUFFIX_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setMode = (next: ThousandsSuffixMode) => {
    setThousandsSuffix(next);
    setModeState(next);
  };

  return [mode, setMode] as const;
}
