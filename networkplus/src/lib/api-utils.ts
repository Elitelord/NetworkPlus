import { NextResponse } from "next/server";

// ─── Constants ─────────────────────────────────────────────────────────────

/** Max request body size for JSON endpoints (15MB) */
export const MAX_JSON_BODY_BYTES = 15 * 1024 * 1024;

/** Max file size for CSV/VCF uploads (20MB) - use in client before parse */
export const MAX_UPLOAD_FILE_BYTES = 20 * 1024 * 1024;

/** Contact field limits */
export const LIMITS = {
  name: 2000,
  description: 2000,
  email: 500,
  phone: 200,
  groupItem: 1000,
  groupsArrayLength: 200,
  metadataKeys: 50,
  metadataValueLength: 1000,
  label: 500,
  interactionDescription: 2000,
} as const;

// ─── JSON body parsing ──────────────────────────────────────────────────────

export type ParseJsonResult =
  | { ok: true; data: unknown }
  | { ok: false; response: NextResponse };

/**
 * Parse request body as JSON. Returns 400 with a clear message on invalid JSON.
 * Optionally enforces a max body size (Content-Length) to avoid huge payloads.
 */
export async function parseJsonBody(
  req: Request,
  maxBytes: number = MAX_JSON_BODY_BYTES
): Promise<ParseJsonResult> {
  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const len = parseInt(contentLength, 10);
    if (!Number.isNaN(len) && len > maxBytes) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Request body too large" },
          { status: 413 }
        ),
      };
    }
  }

  try {
    const data = await req.json();
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      ),
    };
  }
}

// ─── Safe error responses ────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV === "development";

/**
 * Return a 500 JSON response without leaking internal details in production.
 * Logs the full error server-side; in development returns the error message.
 */
export function apiError(err: unknown, status: number = 500): NextResponse {
  const message = err instanceof Error ? err.message : String(err);
  if (!isDev) {
    console.error("API error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status }
    );
  }
  return NextResponse.json({ error: message }, { status });
}

// ─── Rate limiting (in-memory) ──────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/** Clean old entries periodically */
function pruneStore() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}
if (typeof setInterval !== "undefined") {
  setInterval(pruneStore, 60_000);
}

export type RateLimitConfig = {
  windowMs: number;
  max: number;
};

export const RATE_LIMITS = {
  register: { windowMs: 60 * 60 * 1000, max: 5 },
  auth: { windowMs: 15 * 60 * 1000, max: 20 },
  import: { windowMs: 60 * 60 * 1000, max: 30 },
  bulk: { windowMs: 60 * 60 * 1000, max: 60 },
} as const;

/**
 * Check rate limit. Returns null if allowed, or a 429 NextResponse if limited.
 * @param identifier - e.g. IP or user id
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): NextResponse | null {
  const now = Date.now();
  let entry = store.get(identifier);

  if (!entry || entry.resetAt < now) {
    entry = { count: 1, resetAt: now + config.windowMs };
    store.set(identifier, entry);
    return null;
  }

  entry.count++;
  if (entry.count > config.max) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }
  return null;
}

/** Get client identifier from request (IP or fallback) */
export function getRateLimitId(req: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip") ?? "unknown";
  return `ip:${ip}`;
}

// ─── Validation helpers ─────────────────────────────────────────────────────

export function clampString(
  value: unknown,
  maxLen: number
): string | null | undefined {
  if (value === undefined || value === null) return value === undefined ? undefined : null;
  const s = String(value).trim();
  if (s.length === 0) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function clampMetadata(
  value: unknown,
  maxKeys: number = LIMITS.metadataKeys,
  maxValueLen: number = LIMITS.metadataValueLength
): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) return undefined;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).slice(0, maxKeys);
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null) {
      const s = String(v).trim();
      if (s) out[k] = s.length > maxValueLen ? s.slice(0, maxValueLen) : s;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function clampGroupsArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, LIMITS.groupsArrayLength)
    .map((g) => clampString(g, LIMITS.groupItem))
    .filter((g): g is string => typeof g === "string" && g.length > 0);
}