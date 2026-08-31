import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isKitchenAccount } from "@/lib/kitchenAccount";

/**
 * Keeps the kitchen account inside the daily order flow: the list plus a single
 * order. Monthly grids stay admin-only, and the kitchen has no expense, salary,
 * or admin data of its own.
 */
function isKitchenPath(path: string): boolean {
  if (path === "/orders") return true;
  // /orders/:id — but not /orders/monthly
  const rest = path.startsWith("/orders/") ? path.slice("/orders/".length) : "";
  return rest.length > 0 && !rest.includes("/") && rest !== "monthly";
}

export default function KitchenRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isKitchen = isKitchenAccount(user?.email);
  const allowed = isKitchenPath(location.pathname);

  useEffect(() => {
    if (loading || !isKitchen) return;
    if (allowed) return;
    navigate("/orders", { replace: true });
  }, [loading, isKitchen, allowed, navigate]);

  return null;
}
