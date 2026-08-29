/** Repair typical copy-paste JSON flaws (smart quotes, fences, markdown, trailing commas). */

function tryParse(raw: string): unknown | undefined {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function extractOuterJson(body: string): string | null {
  const trimmed = body.trim();
  const objStart = trimmed.indexOf("{");
  const arrStart = trimmed.indexOf("[");
  const arrayIsOuter = arrStart >= 0 && (objStart < 0 || arrStart < objStart);
  if (arrayIsOuter) {
    const arrEnd = trimmed.lastIndexOf("]");
    if (arrEnd > arrStart) return trimmed.slice(arrStart, arrEnd + 1);
  }
  const objEnd = trimmed.lastIndexOf("}");
  if (objStart >= 0 && objEnd > objStart) return trimmed.slice(objStart, objEnd + 1);
  return null;
}

function stripFences(raw: string) {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fence ? fence[1] : raw.replace(/```(?:json)?/gi, "")).trim();
}

function straightenQuotes(raw: string) {
  return raw
    .replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u2032\u2033]/g, "'");
}

/** Drop markdown/WhatsApp bold stars that break JSON, including a leftover * next to quotes. */
function stripMarkdownStars(raw: string) {
  return raw
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([A-Za-z0-9_."'-]+)\*/g, "$1")
    .replace(/\*(?=["{\[])/g, "")
    .replace(/(?<=["}\]])\*/g, "")
    .replace(/(?<=[\d\w])\*/g, "")
    .replace(/\*(?=\s*[,}\]])/g, "")
    .replace(/(?<=:)\s*\*(?=\s*")/g, " ")
    .replace(/"\s*\*/g, '"')
    .replace(/\*\s*"/g, '"');
}

function stripComments(raw: string) {
  return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function pythonLiterals(raw: string) {
  return raw.replace(/\bNone\b/g, "null").replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false");
}

function dropTrailingCommas(raw: string) {
  let next = raw;
  for (let i = 0; i < 8; i++) {
    const updated = next.replace(/,\s*([}\]])/g, "$1");
    if (updated === next) break;
    next = updated;
  }
  return next;
}

function quoteBareKeys(raw: string) {
  return raw.replace(/([{\[,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
}

function singleQuotedToJson(raw: string) {
  if (!raw.includes("'")) return raw;
  if (!raw.includes('"')) return raw.replace(/'/g, '"');
  return raw.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, inner: string) =>
    JSON.stringify(inner.replace(/\\'/g, "'")),
  );
}

function walkJsonStrings(raw: string, onPlain: (ch: string, i: number) => void) {
  let inStr = false;
  let esc = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === "\\") {
        esc = true;
        continue;
      }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    onPlain(ch, i);
  }
}

function closeUnbalanced(raw: string) {
  const stack: Array<"{" | "["> = [];
  walkJsonStrings(raw, ch => {
    if (ch === "{") stack.push("{");
    else if (ch === "[") stack.push("[");
    else if (ch === "}" || ch === "]") stack.pop();
  });
  let suffix = "";
  while (stack.length) {
    suffix += stack.pop() === "{" ? "}" : "]";
  }
  return suffix ? raw + suffix : raw;
}

function normalize(raw: string) {
  return dropTrailingCommas(
    quoteBareKeys(
      pythonLiterals(
        stripComments(stripMarkdownStars(straightenQuotes(stripFences(raw.trim().replace(/^\uFEFF/, ""))))),
      ),
    ),
  );
}

/**
 * Best-effort fix for JSON copied from chat, docs, or WhatsApp.
 * Returns a string that JSON.parse can often accept; if still invalid, returns the cleaned text.
 */
export function repairCopiedJson(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const candidates = [trimmed];
  const outer = extractOuterJson(trimmed);
  if (outer) candidates.push(outer);

  const fenced = stripFences(trimmed);
  candidates.push(fenced);
  const fencedOuter = extractOuterJson(fenced);
  if (fencedOuter) candidates.push(fencedOuter);

  const normalized = normalize(trimmed);
  candidates.push(normalized);
  const normalizedOuter = extractOuterJson(normalized);
  if (normalizedOuter) candidates.push(normalizedOuter);
  candidates.push(closeUnbalanced(normalized));
  if (normalizedOuter) candidates.push(closeUnbalanced(normalizedOuter));

  const singled = singleQuotedToJson(normalized);
  candidates.push(singled);
  const singledOuter = extractOuterJson(singled);
  if (singledOuter) candidates.push(singledOuter);

  const noStars = dropTrailingCommas(normalized.replace(/\*/g, ""));
  candidates.push(noStars);
  const noStarsOuter = extractOuterJson(noStars);
  if (noStarsOuter) candidates.push(noStarsOuter);
  candidates.push(closeUnbalanced(noStars));
  if (noStarsOuter) candidates.push(closeUnbalanced(noStarsOuter));

  for (const candidate of candidates) {
    if (tryParse(candidate) !== undefined) return candidate;
  }

  return normalizedOuter ?? normalized;
}
