// System Status & Control API
// GET: Read system state (pause status, cron info)
// POST: Toggle pause state from the dashboard

import { getSystemConfig, updateSystemConfig } from '../../../lib/system-config'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const config = await getSystemConfig()

    return NextResponse.json({
      paused: config.paused,
      pausedAt: config.pausedAt,
      pausedBy: config.pausedBy,
      reason: config.reason,
      status: config.paused ? 'paused' : 'running',
      cronsEnabled: config.cronsEnabled,
      message: config.paused
        ? `System paused${config.reason ? ': ' + config.reason : ''}. Use the dashboard toggle to resume.`
        : 'System is running normally.',
      crons: {
        runAgents: { schedule: '*/15 * * * *', active: !config.paused && config.cronsEnabled },
        dailyDigest: { schedule: '0 14 * * *', active: !config.paused && config.cronsEnabled },
      },
    })
  } catch (err) {
    console.error('[SYSTEM] GET error:', err)
    // Fallback to env var
    const paused = process.env.SYSTEM_PAUSED === 'true'
    return NextResponse.json({ paused, status: paused ? 'paused' : 'running' })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, reason } = body

    if (action === 'pause') {
      const config = await updateSystemConfig({
        paused: true,
        pausedAt: new Date().toISOString(),
        pausedBy: 'dashboard',
        reason: reason || 'Paused from dashboard',
      })
      return NextResponse.json({ success: true, ...config })
    }

    if (action === 'resume') {
      const config = await updateSystemConfig({
        paused: false,
        pausedAt: null,
        pausedBy: null,
        reason: null,
      })
      return NextResponse.json({ success: true, ...config })
    }

    return NextResponse.json({ error: 'Invalid action. Use "pause" or "resume".' }, { status: 400 })
  } catch (err) {
    console.error('[SYSTEM] POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
