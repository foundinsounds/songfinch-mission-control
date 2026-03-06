// Dashboard-triggered agent run — proxies to /api/cron/run-agents with server-side auth.
//
// WHY THIS EXISTS:
// The CRON endpoint requires CRON_SECRET for security (prevents public triggering).
// But the dashboard's auto-run feature (useDataFetching.js) calls from the client side,
// where it can't access server-only env vars. This proxy injects the secret server-side,
// letting the dashboard trigger agent runs without exposing the secret to the browser.
//
// The Vercel CRON scheduler (every 15 min) is the PRIMARY trigger.
// This endpoint is a SECONDARY trigger for dashboard-initiated runs.

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Match CRON endpoint timeout

function getBaseUrl() {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

export async function GET() {
  const cronSecret = process.env.CRON_SECRET
  const baseUrl = getBaseUrl()

  const headers = {}
  if (cronSecret) {
    headers['Authorization'] = `Bearer ${cronSecret}`
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/run-agents`, {
      headers,
      // Prevent Next.js from caching this proxy call
      cache: 'no-store',
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[trigger-agents] Proxy failed:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
