// Daily Slack Digest — Sends pipeline summary to Slack
// Triggered by Vercel Cron daily at 9am, or manually
// Computes stats from Airtable and calls notifyDailyDigest()

import { getTasks, getAgents, getActivityFeed, getAllActivity } from '../../../../lib/airtable'
import { notifyDailyDigest } from '../../../../lib/slack'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request) {
  // KILL SWITCH: Set SYSTEM_PAUSED=true in Vercel env vars to halt all cron processing
  if (process.env.SYSTEM_PAUSED === 'true') {
    console.log('[DIGEST] System is PAUSED — skipping digest')
    return NextResponse.json({ paused: true, message: 'System is paused' })
  }

  // Verify cron secret for automated calls
  const authHeader = request.headers.get('authorization')
  const cronSecret = request.headers.get('x-cron-secret')
  const secret = process.env.CRON_SECRET

  if (secret && authHeader !== `Bearer ${secret}` && cronSecret !== secret) {
    if (process.env.VERCEL_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const [tasks, agents, activity] = await Promise.all([
      getTasks({ noCache: true }),
      getAgents({ noCache: true }),
      getAllActivity(),
    ])

    const now = Date.now()
    const oneDayAgo = now - 86400000
    const twoDaysAgo = now - 2 * 86400000
    const oneWeekAgo = now - 7 * 86400000

    // ---- BASIC STATS ----
    const totalTasks = tasks.length
    const completed = tasks.filter(t => t.status === 'Done').length
    const inProgress = tasks.filter(t => ['In Progress', 'Assigned', 'Review'].includes(t.status)).length
    const inbox = tasks.filter(t => t.status === 'Inbox').length
    const review = tasks.filter(t => t.status === 'Review').length

    // ---- QUALITY ----
    const extractScore = (a) => {
      const match = a.details?.match(/\((\d+\.?\d*)\/5\)/)
      return match ? parseFloat(match[1]) : null
    }

    const approvals = activity.filter(a => a.action === 'approved' && a.details)
    const todayApprovals = approvals.filter(a => new Date(a.timestamp).getTime() > oneDayAgo)
    const yesterdayApprovals = approvals.filter(a => {
      const t = new Date(a.timestamp).getTime()
      return t > twoDaysAgo && t <= oneDayAgo
    })

    const todayScores = todayApprovals.map(extractScore).filter(Boolean)
    const yesterdayScores = yesterdayApprovals.map(extractScore).filter(Boolean)
    const weekScores = approvals
      .filter(a => new Date(a.timestamp).getTime() > oneWeekAgo)
      .map(extractScore).filter(Boolean)

    const quality = todayScores.length > 0
      ? (todayScores.reduce((a, b) => a + b, 0) / todayScores.length).toFixed(1)
      : weekScores.length > 0
        ? (weekScores.reduce((a, b) => a + b, 0) / weekScores.length).toFixed(1)
        : null

    const yesterdayQuality = yesterdayScores.length > 0
      ? (yesterdayScores.reduce((a, b) => a + b, 0) / yesterdayScores.length).toFixed(1)
      : null

    const qualityDelta = quality && yesterdayQuality
      ? (parseFloat(quality) - parseFloat(yesterdayQuality)).toFixed(1)
      : null

    // ---- VELOCITY ----
    const todayCompletions = activity.filter(
      a => a.action === 'approved' && new Date(a.timestamp).getTime() > oneDayAgo
    ).length

    const yesterdayCompletions = activity.filter(a => {
      const t = new Date(a.timestamp).getTime()
      return a.action === 'approved' && t > twoDaysAgo && t <= oneDayAgo
    }).length

    const weekCompletions = activity.filter(
      a => a.action === 'approved' && new Date(a.timestamp).getTime() > oneWeekAgo
    ).length

    const velocity = todayCompletions || null
    const velocityDelta = todayCompletions - yesterdayCompletions

    // ---- TOP AGENTS ----
    const agentCounts = {}
    tasks.filter(t => t.status === 'Done').forEach(t => {
      if (t.agent) agentCounts[t.agent] = (agentCounts[t.agent] || 0) + 1
    })
    const topAgents = Object.entries(agentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => `${name} (${count})`)

    const topAgent = topAgents[0]?.split(' (')[0] || null

    // ---- REVISION RATE ----
    const weekRevisions = activity.filter(
      a => a.action === 'revision requested' && new Date(a.timestamp).getTime() > oneWeekAgo
    ).length
    const approvalRate = weekCompletions + weekRevisions > 0
      ? Math.round((weekCompletions / (weekCompletions + weekRevisions)) * 100)
      : null

    // ---- PIPELINE HEALTH ----
    const bottleneck = review > 5 ? 'Review' : inbox > 5 ? 'Inbox' : null

    // Send to Slack with enriched data
    await notifyDailyDigest({
      totalTasks,
      completed,
      inProgress,
      quality,
      qualityDelta,
      topAgent,
      topAgents,
      velocity,
      velocityDelta,
      weekCompletions,
      approvalRate,
      inbox,
      review,
      bottleneck,
    })

    const result = {
      totalTasks, completed, inProgress, quality, qualityDelta,
      topAgent, topAgents, velocity, velocityDelta,
      weekCompletions, approvalRate, inbox, review, bottleneck,
    }
    console.log('[DIGEST] Daily digest sent:', result)

    return NextResponse.json({ message: 'Daily digest sent', ...result })
  } catch (err) {
    console.error('[DIGEST] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
