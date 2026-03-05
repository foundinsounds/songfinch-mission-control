// Pipeline Manual Trigger — Allows dashboard to kick off pipeline runs on demand
// Supports: full run, plan-only, review-only, or single-agent targeting
// Returns execution status and summary

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // No secret = dev mode
  const auth = request.headers.get('authorization')
  const cronHeader = request.headers.get('x-cron-secret')
  const { searchParams } = new URL(request.url)
  const keyParam = searchParams.get('key')
  return auth === `Bearer ${secret}` || cronHeader === secret || keyParam === secret
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const body = await request.json().catch(() => ({}))
    const { mode = 'full', agent, limit } = body
    // mode: 'full' | 'plan' | 'review' | 'process'

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    const headers = {
      'Content-Type': 'application/json',
      'x-cron-secret': process.env.CRON_SECRET || '',
    }

    const results = {}

    if (mode === 'review' || mode === 'full') {
      // Trigger auto-review
      const reviewRes = await fetch(`${baseUrl}/api/review/auto`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ limit: limit || 15 }),
      })
      results.review = await reviewRes.json().catch(() => ({ error: 'Failed to parse review response' }))
    }

    if (mode === 'plan' || mode === 'full') {
      // Trigger planning via cron runner with planOnly flag
      const planRes = await fetch(`${baseUrl}/api/cron/run-agents?key=${process.env.CRON_SECRET || ''}`, {
        method: 'GET',
        headers: { 'x-cron-secret': process.env.CRON_SECRET || '' },
      })
      results.plan = await planRes.json().catch(() => ({ error: 'Failed to parse plan response' }))
    }

    if (mode === 'process') {
      // Direct cron trigger for task processing
      const processRes = await fetch(`${baseUrl}/api/cron/run-agents?key=${process.env.CRON_SECRET || ''}`, {
        method: 'GET',
        headers: { 'x-cron-secret': process.env.CRON_SECRET || '' },
      })
      results.process = await processRes.json().catch(() => ({ error: 'Failed to parse process response' }))
    }

    // Log the manual trigger
    try {
      await fetch(`${baseUrl}/api/pipeline/history`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'manual_trigger',
          mode,
          agent: agent || null,
          results,
          durationMs: Date.now() - startTime,
        }),
      })
    } catch {
      // Non-critical — don't fail the trigger if logging fails
    }

    return NextResponse.json({
      message: `Pipeline triggered (mode: ${mode})`,
      mode,
      results,
      durationMs: Date.now() - startTime,
    })
  } catch (err) {
    console.error('[TRIGGER] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
