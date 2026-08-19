import { useEffect, useState } from "react";
import {
  getHighValueThresholds,
  setHighValueThresholds,
  HIGH_VALUE_THRESHOLDS_EVENT,
  type HighValueThresholds,
} from "@/lib/highValueThresholds";

export function useHighValueThresholds() {
  const [thresholds, setState] = useState<HighValueThresholds>(getHighValueThresholds);

  useEffect(() => {
    const sync = () => setState(getHighValueThresholds());
    window.addEventListener(HIGH_VALUE_THRESHOLDS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(HIGH_VALUE_THRESHOLDS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setThresholds = (next: HighValueThresholds) => {
    setHighValueThresholds(next);
    setState(getHighValueThresholds());
  };

  return [thresholds, setThresholds] as const;
}
