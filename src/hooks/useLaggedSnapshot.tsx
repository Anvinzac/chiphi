import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  downloadSnapshotJson,
  fetchLiveSnapshot,
  getSnapshotSlot,
  readLaggedSnapshot,
  saveLaggedSnapshot,
  snapshotMeta,
  type SnapshotMeta,
  type SnapshotPayload,
  type SnapshotRecord,
  type SnapshotSlot,
} from "@/lib/laggedSnapshot";

export type SnapshotMode = "loading" | "live" | "today" | "yesterday" | "none";

type LaggedSnapshotValue = {
  mode: SnapshotMode;
  snapshot: SnapshotPayload | null;
  fallback: SnapshotRecord | null;
  todayMeta: SnapshotMeta | null;
  yesterdayMeta: SnapshotMeta | null;
  refresh: () => Promise<boolean>;
  scheduleRefresh: () => void;
  downloadSlot: (slot: SnapshotSlot) => Promise<void>;
};

const LaggedSnapshotContext = createContext<LaggedSnapshotValue | null>(null);

export function LaggedSnapshotProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [mode, setMode] = useState<SnapshotMode>("loading");
  const [snapshot, setSnapshot] = useState<SnapshotPayload | null>(null);
  const [fallback, setFallback] = useState<SnapshotRecord | null>(null);
  const [todayMeta, setTodayMeta] = useState<SnapshotMeta | null>(null);
  const [yesterdayMeta, setYesterdayMeta] = useState<SnapshotMeta | null>(null);
  const timerRef = useRef<number | null>(null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const loadMeta = useCallback(async (id: string) => {
    const meta = await snapshotMeta(id);
    if (userIdRef.current !== id) return;
    setTodayMeta(meta.today);
    setYesterdayMeta(meta.yesterday);
  }, []);

  const applyFallback = useCallback(async (id: string) => {
    if (userIdRef.current !== id) return false;
    const lagged = await readLaggedSnapshot(id);
    if (userIdRef.current !== id) return false;
    if (!lagged) {
      setSnapshot(null);
      setFallback(null);
      setMode("none");
      return false;
    }
    setSnapshot(lagged.data);
    setFallback(lagged);
    setMode(lagged.slot);
    return true;
  }, []);

  const refresh = useCallback(async () => {
    const id = userIdRef.current;
    if (!id) return false;
    const live = await fetchLiveSnapshot(id);
    if (userIdRef.current !== id) return false;
    if (live.ok) {
      await saveLaggedSnapshot(id, live.data);
      if (userIdRef.current !== id) return false;
      setSnapshot(live.data);
      setFallback(null);
      setMode("live");
      await loadMeta(id);
      return true;
    }
    await applyFallback(id);
    if (userIdRef.current !== id) return false;
    await loadMeta(id);
    return false;
  }, [applyFallback, loadMeta]);

  const scheduleRefresh = useCallback(() => {
    if (!userIdRef.current) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void refresh();
    }, 4000);
  }, [refresh]);

  const downloadSlot = useCallback(async (slot: SnapshotSlot) => {
    const id = userIdRef.current;
    if (!id) return;
    const record = await getSnapshotSlot(id, slot);
    if (record) downloadSnapshotJson(record);
  }, []);

  useEffect(() => {
    if (!userId) {
      setMode("loading");
      setSnapshot(null);
      setFallback(null);
      setTodayMeta(null);
      setYesterdayMeta(null);
      return;
    }
    setSnapshot(null);
    setFallback(null);
    setTodayMeta(null);
    setYesterdayMeta(null);
    setMode("loading");
    void refresh();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [userId, refresh]);

  useEffect(() => {
    const onAccountData = () => {
      void refresh();
    };
    window.addEventListener("mise:account-data", onAccountData);
    return () => window.removeEventListener("mise:account-data", onAccountData);
  }, [refresh]);

  const value = useMemo<LaggedSnapshotValue>(
    () => ({
      mode,
      snapshot,
      fallback,
      todayMeta,
      yesterdayMeta,
      refresh,
      scheduleRefresh,
      downloadSlot,
    }),
    [mode, snapshot, fallback, todayMeta, yesterdayMeta, refresh, scheduleRefresh, downloadSlot],
  );

  return (
    <LaggedSnapshotContext.Provider value={value}>
      {children}
    </LaggedSnapshotContext.Provider>
  );
}

export function useLaggedSnapshot() {
  const ctx = useContext(LaggedSnapshotContext);
  if (!ctx) {
    return {
      mode: "none" as SnapshotMode,
      snapshot: null,
      fallback: null,
      todayMeta: null,
      yesterdayMeta: null,
      refresh: async () => false,
      scheduleRefresh: () => {},
      downloadSlot: async () => {},
    };
  }
  return ctx;
}
