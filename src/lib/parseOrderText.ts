import { foldCategoryName } from "./categoryVisuals";

export type ParsedOrderMode = "measure" | "money";

export interface ParsedOrderLine {
  raw: string;
  quantity: string;
  unit: string;
  name: string;
  normalizedName: string;
  mode: ParsedOrderMode;
  /** Thousands of ₫ when mode is money (e.g. "10" from "10k"). */
  moneyThousands: string;
  matched?: {
    id: string;
    name: string;
    unit: string;
    reference_price: number | null;
  } | null;
}

const KNOWN_UNITS = [
  "kg",
  "g",
  "lạng",
  "lang",
  "gam",
  "tấn",
  "yến",
  "gói",
  "bó",
  "bịch",
  "chai",
  "lít",
  "lon",
  "hộp",
  "tá",
  "chục",
  "cái",
  "quả",
  "trái",
  "củ",
  "bắp",
  "bông",
  "miếng",
  "túi",
  "thùng",
  "can",
  "lọ",
  "hũ",
];

/** Longest first so "gói" wins over "g", "bịch" over shorter stems. */
const UNITS_BY_LENGTH = [...KNOWN_UNITS].sort((a, b) => b.length - a.length);

/** `k` is last so it never steals `kg`. */
const MONEY_SUFFIXES = ["nghìn", "nghin", "ngàn", "ngan", "k"];

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeUnit(unit: string): string {
  const folded = foldCategoryName(unit);
  for (const u of KNOWN_UNITS) {
    if (foldCategoryName(u) === folded) return u;
  }
  return unit;
}

/** Strip a leading token when the next char is not a letter (so `k` ≠ `kg`). */
function stripPrefixToken(rest: string, token: string): string | null {
  const re = new RegExp(`^${escapeRegex(token)}(?![a-zA-ZÀ-ỹ])`, "i");
  if (!re.test(rest)) return null;
  return rest.slice(token.length).trim();
}

export function parseOrderLine(raw: string): {
  quantity: string;
  unit: string;
  name: string;
  mode: ParsedOrderMode;
  moneyThousands: string;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/^[-•*]\s*/, "");

  const leading = cleaned.match(/^(\d+(?:[.,]\d+)?)(.*)$/);
  if (leading) {
    const qtyRaw = leading[1].replace(",", ".");
    const rest = leading[2].trim();
    if (!rest) {
      return { quantity: qtyRaw, unit: "", name: "", mode: "measure", moneyThousands: "" };
    }

    for (const suf of MONEY_SUFFIXES) {
      const name = stripPrefixToken(rest, suf);
      if (name != null) {
        return {
          quantity: "1",
          unit: "",
          name,
          mode: "money",
          moneyThousands: qtyRaw,
        };
      }
    }

    for (const unit of UNITS_BY_LENGTH) {
      const name = stripPrefixToken(rest, unit);
      if (name != null) {
        return {
          quantity: qtyRaw,
          unit: normalizeUnit(unit),
          name,
          mode: "measure",
          moneyThousands: "",
        };
      }
    }

    return {
      quantity: qtyRaw,
      unit: "",
      name: rest,
      mode: "measure",
      moneyThousands: "",
    };
  }

  const trailing = cleaned.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)([a-zA-ZÀ-ỹ]+)?\s*$/);
  if (trailing) {
    const nameRaw = trailing[1].trim();
    const qtyRaw = trailing[2].replace(",", ".");
    const token = trailing[3] || "";
    if (token) {
      const folded = foldCategoryName(token);
      if (MONEY_SUFFIXES.some(s => foldCategoryName(s) === folded)) {
        return {
          quantity: "1",
          unit: "",
          name: nameRaw,
          mode: "money",
          moneyThousands: qtyRaw,
        };
      }
      const known = KNOWN_UNITS.find(u => foldCategoryName(u) === folded);
      if (known) {
        return {
          quantity: qtyRaw,
          unit: normalizeUnit(known),
          name: nameRaw,
          mode: "measure",
          moneyThousands: "",
        };
      }
    }
    return {
      quantity: qtyRaw,
      unit: "",
      name: token ? `${nameRaw} ${token}`.trim() : nameRaw,
      mode: "measure",
      moneyThousands: "",
    };
  }

  return {
    quantity: "1",
    unit: "",
    name: cleaned,
    mode: "measure",
    moneyThousands: "",
  };
}

export function parseOrderText(
  text: string,
  catalog: { id: string; name: string; unit: string; reference_price: number | null }[],
): ParsedOrderLine[] {
  const catalogMap = new Map<string, (typeof catalog)[number]>();
  for (const ing of catalog) {
    const key = foldCategoryName(ing.name);
    if (!catalogMap.has(key)) catalogMap.set(key, ing);
  }

  const lines = text
    .split(/[\n,;]+/)
    .map(l => l.trim())
    .filter(Boolean);

  const result: ParsedOrderLine[] = [];
  for (const raw of lines) {
    const parsed = parseOrderLine(raw);
    if (!parsed || !parsed.name) continue;
    const normalized = foldCategoryName(parsed.name);
    const matched = catalogMap.get(normalized) || null;
    result.push({
      raw,
      quantity: parsed.quantity,
      unit: parsed.unit || matched?.unit || "kg",
      name: parsed.name,
      normalizedName: normalized,
      mode: parsed.mode,
      moneyThousands: parsed.moneyThousands,
      matched: matched
        ? {
            id: matched.id,
            name: matched.name,
            unit: matched.unit,
            reference_price: matched.reference_price,
          }
        : null,
    });
  }
  return result;
}

/** `10k` for money lines; `3 bịch` for measure. */
export function formatParsedAmount(
  line: Pick<ParsedOrderLine, "mode" | "quantity" | "unit" | "moneyThousands">,
): string {
  if (line.mode === "money") return `${line.moneyThousands}k`;
  return [line.quantity, line.unit].filter(Boolean).join(" ");
}
