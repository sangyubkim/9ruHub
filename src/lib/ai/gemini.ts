/**
 * Gemini REST (9ruTrip apps/api/lib/gemini.mjs 와 동일 패턴)
 */

export function getGeminiConfig() {
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    "";
  const model =
    process.env.GEMINI_MODEL?.trim() || "gemini-flash-lite-latest";
  return { apiKey, model, enabled: Boolean(apiKey) };
}

export function parseJsonLoose(text: string): unknown {
  const trimmed = String(text || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Failed to parse JSON from model response");
  }
}

export async function geminiComplete(options: {
  systemHint: string;
  prompt: string;
  temperature?: number;
  json?: boolean;
  timeoutMs?: number;
}): Promise<string | null> {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(),
    options.timeoutMs ?? 90_000,
  );

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${options.systemHint}\n\n${options.prompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: options.temperature ?? 0.4,
          ...(options.json
            ? { responseMimeType: "application/json" }
            : {}),
        },
      }),
    });

    if (!res.ok) {
      console.warn("Gemini failed", res.status, await res.text());
      return null;
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("") || "";
    return text.trim() || null;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("Gemini timed out");
      return null;
    }
    console.warn("Gemini error", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function geminiChatJson(
  system: string,
  userPayload: unknown,
  temperature = 0.4,
): Promise<Record<string, unknown> | null> {
  const text = await geminiComplete({
    systemHint: `${system}\nRespond with valid JSON only.`,
    prompt: JSON.stringify(userPayload),
    temperature,
    json: true,
  });
  if (!text) return null;
  try {
    return parseJsonLoose(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function geminiChatText(
  system: string,
  userPayload: unknown,
  temperature = 0.3,
): Promise<string | null> {
  return geminiComplete({
    systemHint: system,
    prompt: JSON.stringify(userPayload),
    temperature,
    json: false,
  });
}
