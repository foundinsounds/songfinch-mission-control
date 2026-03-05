// Webhook & Notification Endpoint — External integration events
// Supports: Slack notifications, generic webhook forwarding, event triggers
// POST to register webhooks, GET to list them, DELETE to remove

import { addActivity } from '../../../lib/airtable'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// In-memory webhook registry (resets on deploy — Airtable persistence optional)
// For production: move to Airtable or KV store
const webhooks = new Map()

// ── EVENTS THAT TRIGGER WEBHOOKS ──
const VALID_EVENTS = [
  'task.created',
  'task.completed',
  'task.reviewed',
  'content.approved',
  'content.revised',
  'campaign.planned',
  'image.generated',
  'batch.completed',
  'cron.completed',
  'pipeline.alert',
]

// ── REGISTER WEBHOOK ──
export async function POST(request) {
  try {
    const body = await request.json()

    // If body has 'event' field, it's a notification dispatch request
    if (body.event && body.data) {
      return dispatchEvent(body.event, body.data)
    }

    // Otherwise it's a webhook registration
    const { url, events, name, secret } = body

    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    const hookEvents = events || VALID_EVENTS
    const invalidEvents = hookEvents.filter(e => !VALID_EVENTS.includes(e))
    if (invalidEvents.length > 0) {
      return NextResponse.json({
        error: `Invalid events: ${invalidEvents.join(', ')}`,
        validEvents: VALID_EVENTS,
      }, { status: 400 })
    }

    const id = `wh_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const webhook = {
      id,
      name: name || url,
      url,
      events: hookEvents,
      secret: secret || null,
      createdAt: new Date().toISOString(),
      deliveries: 0,
      lastDelivery: null,
      failures: 0,
    }

    webhooks.set(id, webhook)

    await addActivity({
      'Agent': 'System',
      'Action': 'webhook registered',
      'Task': name || url,
      'Details': `Registered webhook "${name || id}" for events: ${hookEvents.join(', ')}`,
      'Type': 'Comment',
    }).catch(() => {})

    return NextResponse.json({
      message: 'Webhook registered',
      webhook: { id, name: webhook.name, events: hookEvents },
    })

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── LIST WEBHOOKS ──
export async function GET() {
  const list = Array.from(webhooks.values()).map(wh => ({
    id: wh.id,
    name: wh.name,
    events: wh.events,
    deliveries: wh.deliveries,
    failures: wh.failures,
    lastDelivery: wh.lastDelivery,
    createdAt: wh.createdAt,
  }))

  return NextResponse.json({
    webhooks: list,
    validEvents: VALID_EVENTS,
    count: list.length,
  })
}

// ── DELETE WEBHOOK ──
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id parameter required' }, { status: 400 })
    }

    const deleted = webhooks.delete(id)
    return NextResponse.json({
      message: deleted ? 'Webhook removed' : 'Webhook not found',
      deleted,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── DISPATCH EVENT TO MATCHING WEBHOOKS ──
async function dispatchEvent(event, data) {
  if (!VALID_EVENTS.includes(event)) {
    return NextResponse.json({ error: `Invalid event: ${event}` }, { status: 400 })
  }

  const matchingHooks = Array.from(webhooks.values()).filter(wh =>
    wh.events.includes(event)
  )

  if (matchingHooks.length === 0) {
    return NextResponse.json({
      message: 'No webhooks registered for this event',
      event,
      dispatched: 0,
    })
  }

  const results = await Promise.allSettled(
    matchingHooks.map(wh => deliverWebhook(wh, event, data))
  )

  const delivered = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  return NextResponse.json({
    message: `Dispatched ${event} to ${matchingHooks.length} webhooks`,
    delivered,
    failed,
    event,
  })
}

async function deliverWebhook(webhook, event, data) {
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data,
    source: 'songfinch-mission-control',
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': event,
    'X-Webhook-ID': webhook.id,
  }

  // HMAC signing if secret is configured
  if (webhook.secret) {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhook.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(JSON.stringify(payload))
    )
    headers['X-Webhook-Signature'] = `sha256=${Buffer.from(signature).toString('hex')}`
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout

  try {
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    webhook.deliveries++
    webhook.lastDelivery = new Date().toISOString()

    if (!res.ok) {
      webhook.failures++
      throw new Error(`Webhook delivery failed: ${res.status}`)
    }
  } catch (err) {
    webhook.failures++
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

// ── HELPER: Dispatch from other endpoints (import this) ──
export async function notifyWebhooks(event, data) {
  const matchingHooks = Array.from(webhooks.values()).filter(wh =>
    wh.events.includes(event)
  )
  if (matchingHooks.length === 0) return

  await Promise.allSettled(
    matchingHooks.map(wh => deliverWebhook(wh, event, data))
  )
}
