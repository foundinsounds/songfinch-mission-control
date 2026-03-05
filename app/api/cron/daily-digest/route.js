// Daily Slack Digest — Sends pipeline summary to Slack
// Triggered by Vercel Cron daily at 9am, or manually
// Computes stats from Airtable and calls notifyDailyDigest()

import { getTasks, getAgents, getActivityFeed } from '../../../../lib/airtable'
import { notifyDailyDigest } from '../../../../lib/slack'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request) {
  // Verify cron secret for automated calls
  const authHeader = request.headers.get('authorization')
  const cronSecret = request.headers.get('x-cron-secret')
  const secret = process.env.CRON_SECRET

  if (secret && authHeader !== `Bearer ${secret}` && cronSecret !== secret) {
    // Allow unauthenticated for manual testing in dev
    if (process.env.VERCEL_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const [tasks, agents, activity] = await Promise.all([
      getTasks({ noCache: true }),
      getAgents({ noCache: true }),
      getActivityFeed({ maxRecords: 100 }),
    ])

    // Compute stats
    const totalTasks = tasks.length
    const completed = tasks.filter(t => t.status === 'Done').length
    const inProgress = tasks.filter(t => ['In Progress', 'Assigned', 'Review'].includes(t.status)).length

    // Average quality from recent approvals in activity feed
    const approvals = activity.filter(a => a.action === 'approved' && a.details)
    const scores = approvals
      .map(a => {
        const match = a.details.match(/\((\d+\.?\d*)\/5\)/)
        return match ? parseFloat(match[1]) : null
      })
      .filter(Boolean)
    const quality = scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
      : null

    // Top agent by completed tasks
    const agentCounts = {}
    tasks.filter(t => t.status === 'Done').forEach(t => {
      if (t.agent) agentCounts[t.agent] = (agentCounts[t.agent] || 0) + 1
    })
    const topAgent = Object.entries(agentCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null

    // Velocity: completed tasks in last 24h (rough estimate from activity timestamps)
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString()
    const recentCompletions = activity.filter(
      a => a.action === 'approved' && a.timestamp > oneDayAgo
    ).length
    const velocity = recentCompletions || null

    // Send to Slack
    await notifyDailyDigest({
      totalTasks,
      completed,
      inProgress,
      quality,
      topAgent,
      velocity,
    })

    const result = { totalTasks, completed, inProgress, quality, topAgent, velocity }
    console.log('[DIGEST] Daily digest sent:', result)

    return NextResponse.json({
      message: 'Daily digest sent',
      ...result,
    })
  } catch (err) {
    console.error('[DIGEST] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
