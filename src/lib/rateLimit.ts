/**
 * Rate Limiting Utility
 *
 * Provides in-memory rate limiting based on IP address.
 * Uses a sliding window approach with automatic cleanup.
 */

/** Configuration for the rate limiter */
interface RateLimitConfig {
  /** Maximum requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/** Tracks request timestamps per IP */
interface RateLimitEntry {
  timestamps: number[];
}

/** Default rate limit: 10 requests per minute */
const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
};

/** In-memory store mapping IP addresses to their request history */
const rateLimitStore = new Map<string, RateLimitEntry>();

/** Cleanup interval in milliseconds (5 minutes) */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/** Last cleanup timestamp */
let lastCleanup = Date.now();

/**
 * Cleans up expired entries from the store.
 * Called automatically during rate limit checks.
 */
function cleanupExpiredEntries(windowMs: number): void {
  const now = Date.now();

  // Only run cleanup periodically to avoid overhead
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanup = now;
  const cutoff = now - windowMs;

  for (const [ip, entry] of rateLimitStore.entries()) {
    // Filter out expired timestamps
    entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);

    // Remove entry if no valid timestamps remain
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(ip);
    }
  }
}

/** Result of a rate limit check */
interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in the current window */
  remaining: number;
  /** Time in milliseconds until the window resets */
  resetMs: number;
}

/**
 * Checks if a request from the given IP is allowed under rate limiting.
 *
 * @param ip - The IP address to check
 * @param config - Optional rate limit configuration
 * @returns Result indicating if the request is allowed and rate limit info
 */
export function checkRateLimit(
  ip: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): RateLimitResult {
  const now = Date.now();
  const { maxRequests, windowMs } = config;
  const cutoff = now - windowMs;

  // Periodically cleanup expired entries
  cleanupExpiredEntries(windowMs);

  // Get or create entry for this IP
  let entry = rateLimitStore.get(ip);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(ip, entry);
  }

  // Filter to only timestamps within the window
  entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);

  // Calculate time until oldest request expires (window reset)
  const resetMs =
    entry.timestamps.length > 0
      ? entry.timestamps[0] + windowMs - now
      : windowMs;

  // Check if under the limit
  if (entry.timestamps.length < maxRequests) {
    // Record this request
    entry.timestamps.push(now);

    return {
      allowed: true,
      remaining: maxRequests - entry.timestamps.length,
      resetMs,
    };
  }

  // Rate limit exceeded
  return {
    allowed: false,
    remaining: 0,
    resetMs,
  };
}

/**
 * Extracts the client IP address from an Astro request.
 *
 * Checks standard proxy headers first, then falls back to the connection info.
 *
 * @param request - The incoming Request object
 * @returns The client IP address or 'unknown'
 */
export function getClientIp(request: Request): string {
  // Check X-Forwarded-For header (common for proxies/load balancers)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP in the chain (original client)
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  // Check X-Real-IP header (Nginx)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  // Check CF-Connecting-IP header (Cloudflare)
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  // Fallback for direct connections
  return 'unknown';
}

/**
 * Creates a 429 Too Many Requests response with appropriate headers.
 *
 * @param resetMs - Time in milliseconds until the rate limit resets
 * @returns A Response object with 429 status
 */
export function createRateLimitResponse(resetMs: number): Response {
  const retryAfterSeconds = Math.ceil(resetMs / 1000);

  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please try again later.',
      retryAfter: retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}
