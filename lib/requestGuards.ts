import { NextResponse } from "next/server";

export type ReadJsonResult =
  | { ok: true; data: unknown }
  | { ok: false; reason: "too_large" | "invalid_json" };

/**
 * Reads and JSON-parses a request body while enforcing a true byte cap as
 * the stream is read — unlike checking the Content-Length header, this
 * can't be bypassed by a client that lies about (or omits) that header.
 */
export async function readJsonWithLimit(
  request: Request,
  maxBytes: number
): Promise<ReadJsonResult> {
  const reader = request.body?.getReader();
  if (!reader) {
    try {
      return { ok: true, data: await request.json() };
    } catch {
      return { ok: false, reason: "invalid_json" };
    }
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { ok: false, reason: "too_large" };
    }
    chunks.push(value);
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, data: JSON.parse(new TextDecoder().decode(buffer)) };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}

export function tooManyRequestsResponse(retryAfterSeconds = 60): NextResponse {
  return NextResponse.json(
    {
      errors: [
        { field: "form", message: "Too many requests. Please try again shortly." },
      ],
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

export function payloadTooLargeResponse(): NextResponse {
  return NextResponse.json(
    { errors: [{ field: "form", message: "Request too large." }] },
    { status: 413 }
  );
}
