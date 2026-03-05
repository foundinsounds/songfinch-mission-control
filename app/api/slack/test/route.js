// Slack Test — Sends a test message to verify webhook connectivity
// Auth: CRON_SECRET via Bearer token, header, or query param

import { NextResponse } from 'next/server'
import { notifyTest } from '../../../../lib/slack'

export const dynamic = 'force-dynamic'

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const { searchParams } = new URL(request.url)
  const auth = request.headers.get('authorization')?.replace('Bearer ', '')
  const headerSecret = request.headers.get('x-cron-secret') || request.headers.get('x-webhook-secret')
  const queryKey = searchParams.get('key')
  return auth === secret || headerSecret === secret || queryKey === secret
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const message = searchParams.get('message') || 'Webhook connectivity verified! Mission Control is online.'

    await notifyTest({ message })

    return NextResponse.json({
      success: true,
      message: 'Test notification sent to Slack',
      sentMessage: message,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[SLACK-TEST] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const message = body.message || 'Webhook connectivity verified! Mission Control is online.'

    await notifyTest({ message })

    return NextResponse.json({
      success: true,
      message: 'Test notification sent to Slack',
      sentMessage: message,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[SLACK-TEST] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
