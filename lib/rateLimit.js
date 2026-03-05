// Rate Limiting Middleware — in-memory sliding window with per-route configuration
// Prevents abuse of API endpoints while allowing burst traffic for legitimate users
// Uses a Map-based store with automatic cleanup to prevent memory leaks

const rateLimitStore = new Map()

// Cleanup stale entries every 5 minutes
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 5 * 60 * 1000

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  for (const [key, entry] of rateLimitStore) {
    // Remove entries older than the largest possible window (1 hour)
    if (now - entry.windowStart > 3600000) {
      rateLimitStore.delete(key)
    }
  }
}

/**
 * Rate limiter with sliding window counter
 * @param {string} identifier - Unique key (IP, API key, etc.)
 * @param {object} options
 * @param {number} options.limit - Max requests per window (default: 60)
 * @param {number} options.windowMs - Window size in ms (default: 60000 = 1 min)
 * @returns {{ success: boolean, limit: number, remaining: number, resetAt: number }}
 */
export function rateLimit(identifier, { limit = 60, windowMs = 60000 } = {}) {
  cleanup()

  const now = Date.now()
  const key = identifier
  const entry = rateLimitStore.get(key)

  if (!entry || now - entry.windowStart >= windowMs) {
    // New window
    rateLimitStore.set(key, {
      windowStart: now,
      count: 1,
    })
    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetAt: now + windowMs,
    }
  }

  // Existing window
  entry.count++
  const remaining = Math.max(0, limit - entry.count)

  if (entry.count > limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      resetAt: entry.windowStart + windowMs,
    }
  }

  return {
    success: true,
    limit,
    remaining,
    resetAt: entry.windowStart + windowMs,
  }
}

/**
 * Route-specific rate limit configurations
 * Different endpoints have different limits based on their cost and usage patterns
 */
export const RATE_LIMITS = {
  // Heavy AI operations - very restricted
  'cron/run-agents': { limit: 4, windowMs: 60000 },      // 4/min (usually cron-triggered)
  'agents/run': { limit: 10, windowMs: 60000 },           // 10/min
  'content/generate': { limit: 10, windowMs: 60000 },     // 10/min

  // Read-heavy endpoints - moderate limits
  'tasks': { limit: 120, windowMs: 60000 },               // 120/min (dashboard polling)
  'agents': { limit: 120, windowMs: 60000 },              // 120/min
  'content': { limit: 60, windowMs: 60000 },              // 60/min
  'activity': { limit: 60, windowMs: 60000 },             // 60/min
  'analytics': { limit: 30, windowMs: 60000 },            // 30/min (heavier query)
  'memory': { limit: 60, windowMs: 60000 },               // 60/min
  'goals': { limit: 60, windowMs: 60000 },                // 60/min

  // Utility endpoints
  'health': { limit: 30, windowMs: 60000 },               // 30/min
  'tasks/comments': { limit: 60, windowMs: 60000 },       // 60/min
  'content/performance': { limit: 30, windowMs: 60000 },  // 30/min

  // Default fallback
  default: { limit: 60, windowMs: 60000 },
}

/**
 * Get rate limit config for a route path
 * @param {string} pathname - The request URL pathname
 * @returns {{ limit: number, windowMs: number }}
 */
export function getRateLimitConfig(pathname) {
  // Strip /api/ prefix and normalize
  const route = pathname.replace(/^\/api\//, '').replace(/\/$/, '')

  // Check for exact match first, then prefix matches
  if (RATE_LIMITS[route]) return RATE_LIMITS[route]

  // Check prefix matches (e.g., 'tasks/comments' matches before 'tasks')
  const sortedRoutes = Object.keys(RATE_LIMITS)
    .filter(k => k !== 'default')
    .sort((a, b) => b.length - a.length) // Longer routes first

  for (const routeKey of sortedRoutes) {
    if (route.startsWith(routeKey)) return RATE_LIMITS[routeKey]
  }

  return RATE_LIMITS.default
}

/**
 * Extract client identifier from request
 * Uses X-Forwarded-For header (Vercel sets this), falls back to generic key
 * @param {Request} request
 * @returns {string}
 */
export function getClientId(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp

  return 'anonymous'
}

/**
 * Apply rate limiting to a request
 * Returns null if allowed, or a Response if rate limited
 * @param {Request} request
 * @returns {Response|null}
 */
export function applyRateLimit(request) {
  const url = new URL(request.url)
  const clientId = getClientId(request)
  const config = getRateLimitConfig(url.pathname)
  const identifier = `${clientId}:${url.pathname}`

  const result = rateLimit(identifier, config)

  if (!result.success) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)

    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        retryAfter,
        limit: result.limit,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(result.resetAt),
        },
      }
    )
  }

  return null // Allowed — no response needed
}
