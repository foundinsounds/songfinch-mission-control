// Health Check Endpoint — monitoring + status page data
// Returns: system health, API connectivity, service versions, uptime info

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function checkAirtable() {
  const start = Date.now()
  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Agents?maxRecords=1`,
      {
        headers: { 'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      }
    )
    return {
      status: res.ok ? 'healthy' : 'degraded',
      latencyMs: Date.now() - start,
      statusCode: res.status,
    }
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      error: err.message,
    }
  }
}

async function checkAI(provider) {
  const configs = {
    anthropic: {
      url: 'https://api.anthropic.com/v1/messages',
      hasKey: !!process.env.ANTHROPIC_API_KEY,
    },
    openai: {
      url: 'https://api.openai.com/v1/models',
      hasKey: !!process.env.OPENAI_API_KEY,
    },
    google: {
      url: 'https://generativelanguage.googleapis.com/v1beta/models',
      hasKey: !!process.env.GOOGLE_AI_KEY,
    },
  }

  const config = configs[provider]
  if (!config) return { status: 'unknown', configured: false }
  if (!config.hasKey) return { status: 'not_configured', configured: false }

  return { status: 'configured', configured: true }
}

export async function GET() {
  const startTime = Date.now()

  try {
    // Run all health checks in parallel
    const [airtable, anthropic, openai, google] = await Promise.all([
      checkAirtable(),
      checkAI('anthropic'),
      checkAI('openai'),
      checkAI('google'),
    ])

    const services = { airtable, anthropic, openai, google }

    // Check optional integrations
    const integrations = {
      slack: { configured: !!process.env.SLACK_WEBHOOK_URL },
      figma: { configured: !!process.env.FIGMA_ACCESS_TOKEN },
      cron: { configured: !!process.env.CRON_SECRET },
      dalle: { configured: !!process.env.OPENAI_API_KEY },
    }

    // Overall status
    const criticalDown = airtable.status === 'down'
    const noAI = !anthropic.configured && !openai.configured && !google.configured
    const overallStatus = criticalDown ? 'down' : noAI ? 'degraded' : airtable.status === 'degraded' ? 'degraded' : 'healthy'

    return NextResponse.json({
      status: overallStatus,
      version: 'v4.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? `${Math.round(process.uptime())}s` : 'N/A',
      services,
      integrations,
      checks: {
        totalMs: Date.now() - startTime,
        airtableLatency: airtable.latencyMs || null,
      },
    }, {
      status: overallStatus === 'down' ? 503 : 200,
    })
  } catch (err) {
    return NextResponse.json({
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
