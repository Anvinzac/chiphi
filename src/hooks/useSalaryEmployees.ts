import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  SALARY_EMPLOYEES_EVENT,
  newSalaryEmployee,
  type SalaryEmployee,
  type SalaryEmployeesFile,
  type SalaryImportMeta,
} from "@/lib/salaryEmployees";
import { loadSalaryStore, saveSalaryStore, invalidateSalaryStoreCache } from "@/lib/salaryEmployeesDb";

function notifyRoster() {
  window.dispatchEvent(new Event(SALARY_EMPLOYEES_EVENT));
}

export function useSalaryEmployees() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [store, setStore] = useState<SalaryEmployeesFile>({ employees: [] });

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      loadSalaryStore(userId).then(next => {
        if (!cancelled) setStore(next);
      });
    };
    const syncFresh = () => {
      invalidateSalaryStoreCache();
      loadSalaryStore(userId, { fresh: true }).then(next => {
        if (!cancelled) setStore(next);
      });
    };
    sync();
    window.addEventListener(SALARY_EMPLOYEES_EVENT, sync);
    window.addEventListener("storage", syncFresh);
    return () => {
      cancelled = true;
      window.removeEventListener(SALARY_EMPLOYEES_EVENT, sync);
      window.removeEventListener("storage", syncFresh);
    };
  }, [userId]);

  const save = useCallback(
    async (employees: SalaryEmployee[], meta?: SalaryImportMeta) => {
      const next = await saveSalaryStore(userId, employees, meta);
      setStore(next);
      notifyRoster();
      return next;
    },
    [userId],
  );

  const addEmployee = useCallback(
    async (name: string, amount: number, extra?: Pick<SalaryEmployee, "account" | "deposit" | "transfer_amount">) => {
      const row = newSalaryEmployee(name, amount, extra);
      if (!row.name) return null;
      const prev = await loadSalaryStore(userId);
      await save([...prev.employees, row], prev.meta);
      return row;
    },
    [save, userId],
  );

  const replaceAll = useCallback(
    async (rows: Omit<SalaryEmployee, "id">[], meta?: SalaryImportMeta) => {
      const next = rows
        .map(row =>
          newSalaryEmployee(row.name, row.amount, {
            account: row.account,
            deposit: row.deposit,
            transfer_amount: row.transfer_amount,
          }),
        )
        .filter(row => row.name);
      await save(next, meta);
      return next;
    },
    [save],
  );

  const updateEmployee = useCallback(
    async (
      id: string,
      patch: Partial<Pick<SalaryEmployee, "name" | "amount" | "account" | "deposit" | "transfer_amount">>,
    ) => {
      const prev = await loadSalaryStore(userId);
      await save(
        prev.employees.map(row =>
          row.id === id
            ? {
                ...row,
                name: patch.name?.trim() || row.name,
                amount: patch.amount != null ? Math.max(0, Math.round(patch.amount)) : row.amount,
                account: patch.account !== undefined ? patch.account || undefined : row.account,
                deposit: patch.deposit !== undefined ? patch.deposit : row.deposit,
                transfer_amount: patch.transfer_amount !== undefined ? patch.transfer_amount : row.transfer_amount,
              }
            : row,
        ),
        prev.meta,
      );
    },
    [save, userId],
  );

  const removeEmployee = useCallback(
    async (id: string) => {
      const prev = await loadSalaryStore(userId);
      await save(prev.employees.filter(row => row.id !== id), prev.meta);
    },
    [save, userId],
  );

  return {
    employees: store.employees,
    meta: store.meta,
    addEmployee,
    replaceAll,
    updateEmployee,
    removeEmployee,
  };
}
