// Global Middleware — Applies rate limiting to all /api/* routes
// Runs on Edge Runtime before any route handler
// Uses the existing rateLimit module with per-route configurations

import { NextResponse } from 'next/server'
import { rateLimit, getRateLimitConfig, getClientId } from './lib/rateLimit'

export function middleware(request) {
  // Only rate-limit API routes
  const { pathname } = request.nextUrl
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Skip rate limiting for health checks (monitoring uptime)
  if (pathname === '/api/health' || pathname === '/api/health/pipeline') {
    return NextResponse.next()
  }

  // Skip rate limiting for cron jobs authenticated via CRON_SECRET
  // Vercel cron sends an Authorization header with the CRON_SECRET
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')?.replace('Bearer ', '')
    const webhookSecret = request.headers.get('x-webhook-secret')
    if (auth === cronSecret || webhookSecret === cronSecret) {
      return NextResponse.next()
    }
  }

  const clientId = getClientId(request)
  const config = getRateLimitConfig(pathname)
  const identifier = `${clientId}:${pathname}`

  const result = rateLimit(identifier, config)

  if (!result.success) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)

    return new NextResponse(
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

  // Add rate limit headers to successful responses for client awareness
  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Limit', String(result.limit))
  response.headers.set('X-RateLimit-Remaining', String(result.remaining))
  response.headers.set('X-RateLimit-Reset', String(result.resetAt))

  return response
}

// Only run middleware on API routes
export const config = {
  matcher: '/api/:path*',
}
