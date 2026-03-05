// Pipeline Health Endpoint — checks all service integrations
// Returns: per-service status, configuration, active provider info

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function detectActiveAIProvider() {
  if (process.env.ANTHROPIC_API_KEY) return 'Anthropic (Claude)'
  if (process.env.OPENAI_API_KEY) return 'OpenAI (GPT)'
  if (process.env.GOOGLE_AI_KEY || process.env.GOOGLE_AI_API_KEY) return 'Google (Gemini)'
  return null
}

async function checkAirtable() {
  const configured = !!process.env.AIRTABLE_API_KEY && !!process.env.AIRTABLE_BASE_ID
  if (!configured) return { configured, status: 'disconnected', name: 'Airtable' }

  const start = Date.now()
  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Agents?maxRecords=1`,
      {
        headers: { 'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      }
    )
    if (!res.ok) {
      return {
        configured: true,
        status: 'error',
        name: 'Airtable',
        latencyMs: Date.now() - start,
        error: `HTTP ${res.status}`,
      }
    }
    const data = await res.json()
    return {
      configured: true,
      status: 'connected',
      name: 'Airtable',
      latencyMs: Date.now() - start,
      recordCount: data.records?.length ?? null,
    }
  } catch (err) {
    return {
      configured: true,
      status: 'error',
      name: 'Airtable',
      latencyMs: Date.now() - start,
      error: err.message,
    }
  }
}

export async function GET() {
  const startTime = Date.now()

  try {
    // Check Airtable with a real ping
    const airtable = await checkAirtable()

    // AI Engine — detect which provider is active
    const aiProvider = detectActiveAIProvider()
    const aiConfigured = !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY || !!process.env.GOOGLE_AI_KEY || !!process.env.GOOGLE_AI_API_KEY
    const ai = {
      configured: aiConfigured,
      status: aiConfigured ? 'connected' : 'disconnected',
      name: 'AI Engine',
      provider: aiProvider,
      providers: {
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        openai: !!process.env.OPENAI_API_KEY,
        google: !!process.env.GOOGLE_AI_KEY || !!process.env.GOOGLE_AI_API_KEY,
      },
    }

    // DALL-E 3
    const dalleConfigured = !!process.env.OPENAI_API_KEY
    const dalle = {
      configured: dalleConfigured,
      status: dalleConfigured ? 'connected' : 'disconnected',
      name: 'DALL-E 3',
    }

    // LTX-2 Video
    const ltxConfigured = !!process.env.HF_TOKEN
    const ltx = {
      configured: ltxConfigured,
      status: ltxConfigured ? 'connected' : 'disconnected',
      name: 'LTX-2 Video',
    }

    // Cron Runner
    const cronConfigured = !!process.env.CRON_SECRET || !!process.env.VERCEL_URL
    const cron = {
      configured: cronConfigured,
      status: cronConfigured ? 'connected' : 'unknown',
      name: 'Cron Runner',
    }

    // Figma
    const figmaConfigured = !!process.env.FIGMA_ACCESS_TOKEN || !!process.env.FIGMA_TOKEN
    const figma = {
      configured: figmaConfigured,
      status: figmaConfigured ? 'connected' : 'disconnected',
      name: 'Figma',
    }

    // Slack
    const slackConfigured = !!process.env.SLACK_WEBHOOK_URL
    const slack = {
      configured: slackConfigured,
      status: slackConfigured ? 'connected' : 'disconnected',
      name: 'Slack',
    }

    // Google Drive
    const driveConfigured = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !!process.env.GOOGLE_DRIVE_FOLDER_ID
    const drive = {
      configured: driveConfigured,
      status: driveConfigured ? 'connected' : 'disconnected',
      name: 'Google Drive',
      folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
    }

    // Separate CORE services (needed for content generation) from OPTIONAL integrations
    const coreServices = { airtable, ai, dalle, cron }
    const optionalServices = { ltx, figma, slack, drive }

    // Mark unconfigured optional services as "not_configured" (not "disconnected")
    for (const svc of Object.values(optionalServices)) {
      if (!svc.configured) svc.status = 'not_configured'
    }

    const services = { ...coreServices, ...optionalServices }

    // Health is determined ONLY by core services
    const coreConnected = Object.values(coreServices).filter(s => s.status === 'connected').length
    const coreTotal = Object.keys(coreServices).length
    const optConnected = Object.values(optionalServices).filter(s => s.status === 'connected').length
    const optTotal = Object.keys(optionalServices).length

    const overallStatus = coreConnected === coreTotal
      ? 'healthy'
      : coreConnected >= 2
        ? 'degraded'
        : 'down'

    return NextResponse.json({
      status: overallStatus,
      connectedCount: coreConnected + optConnected,
      totalCount: coreTotal + optTotal,
      coreConnected,
      coreTotal,
      optionalConnected: optConnected,
      optionalTotal: optTotal,
      services,
      timestamp: new Date().toISOString(),
      checkDurationMs: Date.now() - startTime,
    })
  } catch (err) {
    return NextResponse.json({
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
