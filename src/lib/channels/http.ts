export class ChannelApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ChannelApiError";
    this.status = status;
    this.body = body;
  }
}

export async function readJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

export function errorMessageFromBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const row = body as {
    message?: string;
    code?: string;
    errorMessage?: string;
    msg?: string;
  };
  return row.message || row.errorMessage || row.msg || row.code || fallback;
}
