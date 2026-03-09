// System Status & Control API
// GET: Read system state (pause status, cron info, budget)
// POST: Toggle pause state or update budget from the dashboard

import { getSystemConfig, updateSystemConfig } from '../../../lib/system-config'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const config = await getSystemConfig()

    // Reset todayCalls if it's a new day
    const today = new Date().toISOString().split('T')[0]
    const todayCalls = config.todayDate === today ? (config.todayCalls || 0) : 0

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
      // Budget info
      budget: {
        dailyLimit: config.dailyBudget || 0,
        todayCalls,
        todayDate: today,
        remaining: config.dailyBudget ? Math.max(0, config.dailyBudget - todayCalls) : null,
        totalCallsAllTime: config.totalCallsAllTime || 0,
        percentUsed: config.dailyBudget ? Math.min(100, Math.round((todayCalls / config.dailyBudget) * 100)) : 0,
      },
    })
  } catch (err) {
    console.error('[SYSTEM] GET error:', err)
    // Fallback to env var
    const paused = process.env.SYSTEM_PAUSED === 'true'
    return NextResponse.json({ paused, status: paused ? 'paused' : 'running', budget: null })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, reason, dailyBudget } = body

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

    if (action === 'set-budget') {
      const budget = parseInt(dailyBudget, 10)
      if (isNaN(budget) || budget < 0) {
        return NextResponse.json({ error: 'dailyBudget must be a non-negative integer' }, { status: 400 })
      }
      const config = await updateSystemConfig({ dailyBudget: budget })
      return NextResponse.json({ success: true, dailyBudget: budget, ...config })
    }

    if (action === 'reset-counter') {
      const config = await updateSystemConfig({
        todayCalls: 0,
        todayDate: new Date().toISOString().split('T')[0],
      })
      return NextResponse.json({ success: true, ...config })
    }

    return NextResponse.json({ error: 'Invalid action. Use "pause", "resume", "set-budget", or "reset-counter".' }, { status: 400 })
  } catch (err) {
    console.error('[SYSTEM] POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
