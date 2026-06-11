import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

export const CALENDAR_FETCH_TIMEOUT_MS = 8000;
export const CALENDAR_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export type BoundedCalendarFetchResult = {
  ok: boolean;
  status: number;
  statusText: string;
  contentType: string | null;
  byteSize: number;
  text: string;
};

export type BoundedCalendarFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
  userAgentSuffix?: string;
  headers?: HeadersInit;
};

function byteCapLabel(maxBytes: number) {
  const mb = 1024 * 1024;
  if (maxBytes % mb === 0) return `${maxBytes / mb} MB`;
  if (maxBytes % 1024 === 0) return `${maxBytes / 1024} KB`;
  return `${maxBytes} bytes`;
}

function resolveUserAgent(userAgent?: string, suffix?: string) {
  if (userAgent) return userAgent;
  if (!suffix) return "GearTracker/1.0";
  const normalized = suffix.trim();
  return normalized.startsWith("(")
    ? `GearTracker/1.0 ${normalized}`
    : `GearTracker/1.0 (${normalized})`;
}

async function readTextWithByteLimit(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });

  if (!reader) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      throw new Error(`Feed exceeds ${byteCapLabel(maxBytes)} cap.`);
    }
    return {
      byteSize: buffer.byteLength,
      text: decoder.decode(buffer),
    };
  }

  let received = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    received += value.byteLength;
    if (received > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // The failure path is already the byte cap error.
      }
      throw new Error(`Feed exceeds ${byteCapLabel(maxBytes)} cap.`);
    }
    chunks.push(value);
  }

  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    byteSize: received,
    text: decoder.decode(buffer),
  };
}

export async function fetchCalendarText(
  url: string | URL,
  options: BoundedCalendarFetchOptions = {},
): Promise<BoundedCalendarFetchResult> {
  const {
    timeoutMs = CALENDAR_FETCH_TIMEOUT_MS,
    maxBytes = CALENDAR_MAX_RESPONSE_BYTES,
    headers: headersInit,
    userAgent,
    userAgentSuffix,
  } = options;
  const headers = new Headers(headersInit);
  headers.set("User-Agent", resolveUserAgent(userAgent, userAgentSuffix));

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      headers,
      timeoutMs,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Fetch timed out after ${timeoutMs}ms.`);
    }
    throw err;
  }

  const result: BoundedCalendarFetchResult = {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    contentType: response.headers.get("content-type"),
    byteSize: 0,
    text: "",
  };

  if (!response.ok) {
    return result;
  }

  const body = await readTextWithByteLimit(response, maxBytes);
  return {
    ...result,
    byteSize: body.byteSize,
    text: body.text,
  };
}
