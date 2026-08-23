import { foldCategoryName } from "./categoryVisuals";

export interface ParsedOrderLine {
  raw: string;
  quantity: string;
  unit: string;
  name: string;
  normalizedName: string;
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

function normalizeUnit(unit: string): string {
  const folded = foldCategoryName(unit);
  for (const u of KNOWN_UNITS) {
    if (foldCategoryName(u) === folded) return u;
  }
  return unit;
}

function parseLine(raw: string): { quantity: string; unit: string; name: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Remove leading bullet or dash
  const cleaned = trimmed.replace(/^[-•*]\s*/, "");
  // Try to match quantity and unit at start
  // Patterns:
  // "2kg cà chua" -> qty 2, unit kg, name cà chua
  // "2 kg cà chua" -> qty 2, unit kg, name cà chua
  // "1.5kg rau muống" -> qty 1.5, unit kg, name rau muống
  // "500g hành lá" -> qty 500, unit g, name hành lá
  // "3 gói đậu hũ" -> qty 3, unit gói, name đậu hũ
  // "cà chua 2kg" -> qty 2, unit kg, name cà chua (reverse)
  // For now, handle the common case: qty at start
  const qtyUnitNameRegex = /^(\d+(?:[.,]\d+)?)\s*([a-zA-ZÀ-ỹ]+)?\s+(.+)$/;
  const match = cleaned.match(qtyUnitNameRegex);
  if (match) {
    const qtyRaw = match[1].replace(",", ".");
    const unitRaw = match[2] || "";
    const nameRaw = match[3].trim();
    // Check if unitRaw is actually part of name (not a known unit)
    const unitFolded = foldCategoryName(unitRaw);
    const isKnownUnit = unitRaw && KNOWN_UNITS.some(u => foldCategoryName(u) === unitFolded);
    if (unitRaw && isKnownUnit) {
      return {
        quantity: qtyRaw,
        unit: normalizeUnit(unitRaw),
        name: nameRaw,
      };
    }
    // If unitRaw is not a known unit, treat it as part of name, and quantity is qtyRaw, unit is default, name is unitRaw + " " + nameRaw
    if (unitRaw && !isKnownUnit) {
      return {
        quantity: qtyRaw,
        unit: "",
        name: `${unitRaw} ${nameRaw}`.trim(),
      };
    }
    // No unit
    return {
      quantity: qtyRaw,
      unit: "",
      name: nameRaw,
    };
  }
  // No quantity at start, try quantity at end: "cà chua 2kg"
  const nameQtyUnitRegex = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-ZÀ-ỹ]+)?\s*$/;
  const match2 = cleaned.match(nameQtyUnitRegex);
  if (match2) {
    const nameRaw = match2[1].trim();
    const qtyRaw = match2[2].replace(",", ".");
    const unitRaw = match2[3] || "";
    const unitFolded = foldCategoryName(unitRaw);
    const isKnownUnit = unitRaw && KNOWN_UNITS.some(u => foldCategoryName(u) === unitFolded);
    if (unitRaw && isKnownUnit) {
      return {
        quantity: qtyRaw,
        unit: normalizeUnit(unitRaw),
        name: nameRaw,
      };
    }
    if (unitRaw && !isKnownUnit) {
      return {
        quantity: qtyRaw,
        unit: "",
        name: `${nameRaw} ${unitRaw}`.trim(),
      };
    }
    return {
      quantity: qtyRaw,
      unit: "",
      name: nameRaw,
    };
  }
  // No quantity found, treat whole line as name with quantity 1
  return {
    quantity: "1",
    unit: "",
    name: cleaned,
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
    const parsed = parseLine(raw);
    if (!parsed) continue;
    const normalized = foldCategoryName(parsed.name);
    const matched = catalogMap.get(normalized) || null;
    // Also try to find partial match: if catalog name is substring of parsed name or vice versa
    let finalMatched = matched;
    if (!finalMatched) {
      for (const [key, ing] of catalogMap) {
        if (normalized.includes(key) || key.includes(normalized)) {
          finalMatched = ing;
          break;
        }
      }
    }
    result.push({
      raw,
      quantity: parsed.quantity,
      unit: parsed.unit || finalMatched?.unit || "kg",
      name: parsed.name,
      normalizedName: normalized,
      matched: finalMatched
        ? {
            id: finalMatched.id,
            name: finalMatched.name,
            unit: finalMatched.unit,
            reference_price: finalMatched.reference_price,
          }
        : null,
    });
  }
  return result;
}
