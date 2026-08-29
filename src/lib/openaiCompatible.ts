/** OpenAI-compatible chat/completions client (vision). Credentials stay off the client in dev. */

export const OPENAI_COMPAT_MISSING_KEY =
  "Chưa có OPENAI_API_KEY trong .env.local. Thêm OPENAI_API_KEY (và tuỳ chọn OPENAI_BASE_URL, OPENAI_MODEL) rồi restart bun run dev.";

export const OPENAI_COMPAT_DEV_PATH = "/openai-compat/chat/completions";

export function openaiCompatModel() {
  return (import.meta.env.VITE_OPENAI_MODEL || "gpt-4o").trim() || "gpt-4o";
}

export function openaiCompatDirectBaseUrl() {
  const raw = (import.meta.env.VITE_OPENAI_BASE_URL || "").trim().replace(/\/$/, "");
  return raw || "https://api.openai.com/v1";
}

export function openaiCompatDirectApiKey() {
  return (import.meta.env.VITE_OPENAI_API_KEY || "").trim();
}

export function openaiCompatChatUrl() {
  if (import.meta.env.DEV) return OPENAI_COMPAT_DEV_PATH;
  return `${openaiCompatDirectBaseUrl()}/chat/completions`;
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
};

type ChatCompletionsBody = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
};

function errorFromBody(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const rec = payload as Record<string, unknown>;
  const err = rec.error;
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object") {
    const message = (err as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (typeof rec.message === "string" && rec.message.trim()) return rec.message;
  return fallback;
}

export async function openaiCompatChatCompletions(body: ChatCompletionsBody) {
  const url = openaiCompatChatUrl();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!import.meta.env.DEV) {
    const key = openaiCompatDirectApiKey();
    if (!key) throw new Error(OPENAI_COMPAT_MISSING_KEY);
    headers.Authorization = `Bearer ${key}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${res.status}: ${errorFromBody(payload, res.statusText || "OpenAI-compatible request failed")}`);
  }

  const rec = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const choices = rec && Array.isArray(rec.choices) ? rec.choices : [];
  const first = choices[0] && typeof choices[0] === "object" ? (choices[0] as Record<string, unknown>) : null;
  const message = first?.message && typeof first.message === "object" ? (first.message as Record<string, unknown>) : null;
  const content = message?.content;
  if (typeof content === "string" && content.trim()) return content;
  throw new Error("OpenAI-compatible response không có choices[0].message.content");
}
