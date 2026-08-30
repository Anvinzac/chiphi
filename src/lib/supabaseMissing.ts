export function isMissingRelation(error: { message?: string; code?: string } | null | undefined) {
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

export function isMissingColumn(error: { message?: string; code?: string } | null | undefined) {
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");
  return (
    code === "42703" ||
    code === "PGRST204" ||
    (msg.includes("could not find") && msg.includes("column")) ||
    msg.includes("category_key")
  );
}

export function isMissingOnConflict(error: { message?: string; code?: string } | null | undefined) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("no unique or exclusion constraint") || msg.includes("on conflict");
}
