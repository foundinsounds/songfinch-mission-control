// Pipeline Stats — Real-time pipeline health metrics for monitoring
// Lightweight: designed for frequent polling (dashboard refresh, health checks)

import { NextResponse } from 'next/server'
import { getTasks, getAgents } from '../../../../lib/airtable'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [tasks, agents] = await Promise.all([
      getTasks({ noCache: true }),
      getAgents({ noCache: true }),
    ])

    const now = Date.now()

    // Status breakdown
    const byStatus = {}
    tasks.forEach(t => {
      const s = t.status || 'Unknown'
      byStatus[s] = (byStatus[s] || 0) + 1
    })

    // Priority breakdown
    const byPriority = { High: 0, Medium: 0, Low: 0 }
    tasks.forEach(t => {
      if (byPriority[t.priority] !== undefined) byPriority[t.priority]++
    })

    // Agent workloads
    const agentLoad = {}
    agents.forEach(a => {
      const agentTasks = tasks.filter(t => t.agent === a.name && t.status !== 'Done')
      agentLoad[a.name] = {
        active: agentTasks.filter(t => ['Assigned', 'In Progress'].includes(t.status)).length,
        review: agentTasks.filter(t => t.status === 'Review').length,
        total: agentTasks.length,
        status: a.status,
      }
    })

    // Pipeline velocity — tasks completed in last 24h, 7d
    // Uses completedAt timestamp if available, falls back to createdAt for legacy tasks
    const done = tasks.filter(t => t.status === 'Done')
    const doneLast24h = done.filter(t => {
      const ts = t.completedAt || t.createdAt
      return ts && (now - new Date(ts).getTime()) < 86400000
    }).length
    const doneLast7d = done.filter(t => {
      const ts = t.completedAt || t.createdAt
      return ts && (now - new Date(ts).getTime()) < 7 * 86400000
    }).length

    // Overdue tasks (scheduled date in the past, not Done)
    const overdue = tasks.filter(t =>
      t.scheduledDate &&
      t.status !== 'Done' &&
      new Date(t.scheduledDate).getTime() < now
    ).length

    // Bottleneck detection — thresholds tuned for a 10-agent pipeline
    // With multiple content agents producing simultaneously, Review naturally accumulates.
    // CHIEF processes ~15 per cycle (every 15 min) = ~60/hour clearance rate.
    const inbox = byStatus['Inbox'] || 0
    const review = byStatus['Review'] || 0
    const inProgress = byStatus['In Progress'] || 0
    let bottleneck = null
    if (review > 40) bottleneck = { stage: 'Review', count: review, severity: 'high' }
    else if (inbox > 20) bottleneck = { stage: 'Inbox', count: inbox, severity: 'high' }
    else if (review > 20) bottleneck = { stage: 'Review', count: review, severity: 'medium' }
    else if (inbox > 10) bottleneck = { stage: 'Inbox', count: inbox, severity: 'medium' }

    // Pipeline health score (0-100)
    let healthScore = 100
    if (bottleneck?.severity === 'high') healthScore -= 25
    else if (bottleneck?.severity === 'medium') healthScore -= 10
    if (overdue > 5) healthScore -= 20
    else if (overdue > 0) healthScore -= overdue * 3
    if (doneLast24h === 0 && (inbox + inProgress) > 0) healthScore -= 20
    healthScore = Math.max(0, Math.min(100, healthScore))

    const healthLabel = healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'degraded' : 'critical'

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      health: { score: healthScore, label: healthLabel },
      pipeline: {
        total: tasks.length,
        byStatus,
        byPriority,
        overdue,
        bottleneck,
      },
      velocity: {
        last24h: doneLast24h,
        last7d: doneLast7d,
        dailyAvg: Math.round((doneLast7d / 7) * 10) / 10,
      },
      agents: agentLoad,
      activeAgents: agents.filter(a => a.status === 'Active' || a.status === 'Working').length,
      totalAgents: agents.length,
    })
  } catch (err) {
    console.error('[STATS] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
