// Pipeline Bottleneck Predictor — Identifies current and emerging bottlenecks
// Detects: queue buildups, slow agents, review backlogs, stalled stages
// Predicts: where the pipeline will jam next based on flow rates

import { NextResponse } from 'next/server'
import { getTasks, getAllActivity, getAgents } from '../../../../lib/airtable'

export const dynamic = 'force-dynamic'

const HOUR_MS = 3600000

function analyzeBottlenecks(tasks, activity, agents) {
  const now = Date.now()
  const bottlenecks = []

  // Stage distribution
  const stages = {
    Planned: tasks.filter(t => t.status === 'Planned'),
    Assigned: tasks.filter(t => t.status === 'Assigned'),
    'In Progress': tasks.filter(t => t.status === 'In Progress'),
    Review: tasks.filter(t => t.status === 'Review'),
    Done: tasks.filter(t => t.status === 'Done'),
  }

  const stageFlow = Object.entries(stages).map(([stage, items]) => ({
    stage,
    count: items.length,
    agents: [...new Set(items.map(t => t.agent).filter(Boolean))],
  }))

  // 1. Queue buildup — too many tasks waiting in any stage
  Object.entries(stages).forEach(([stage, items]) => {
    if (stage === 'Done') return
    if (items.length >= 8) {
      bottlenecks.push({
        type: 'queue_buildup',
        severity: items.length >= 15 ? 'critical' : items.length >= 10 ? 'high' : 'medium',
        stage,
        count: items.length,
        message: `${items.length} tasks queued in "${stage}" stage`,
        impact: `Downstream stages will starve once this clears — expect burst`,
        suggestion: stage === 'Review'
          ? 'Trigger additional CHIEF review cycle'
          : 'Consider rebalancing agent workloads or adding parallel processing',
      })
    }
  })

  // 2. Review bottleneck — review queue growing faster than completion
  const recentApprovals = activity
    .filter(a => a.action === 'approved' && a.createdAt)
    .filter(a => now - new Date(a.createdAt).getTime() < 24 * HOUR_MS)
  const reviewQueue = stages['Review'].length

  if (reviewQueue > 0 && reviewQueue > recentApprovals.length * 2) {
    bottlenecks.push({
      type: 'review_backlog',
      severity: reviewQueue >= 10 ? 'high' : 'medium',
      reviewPending: reviewQueue,
      approvedLast24h: recentApprovals.length,
      message: `Review backlog: ${reviewQueue} pending vs ${recentApprovals.length} approved in 24h`,
      impact: 'Completed content stuck waiting — agents idle while CHIEF catches up',
      suggestion: 'Increase review frequency or batch-approve similar content types',
    })
  }

  // 3. Agent-specific bottlenecks — individual agents with high task counts
  const agentLoads = {}
  tasks.filter(t => t.agent && t.status !== 'Done').forEach(t => {
    if (!agentLoads[t.agent]) agentLoads[t.agent] = { total: 0, stages: {} }
    agentLoads[t.agent].total++
    agentLoads[t.agent].stages[t.status] = (agentLoads[t.agent].stages[t.status] || 0) + 1
  })

  Object.entries(agentLoads).forEach(([agent, load]) => {
    if (load.total >= 6) {
      bottlenecks.push({
        type: 'agent_overload',
        severity: load.total >= 10 ? 'high' : 'medium',
        agent,
        taskCount: load.total,
        stages: load.stages,
        message: `${agent} has ${load.total} active tasks`,
        impact: `Quality may degrade — agent spread too thin across ${Object.keys(load.stages).length} stages`,
        suggestion: `Route new "${agent}" tasks to underutilized agents`,
      })
    }
  })

  // 4. Stalled tasks — tasks stuck in same stage too long
  const staleThreshold = 12 * HOUR_MS
  const stalledTasks = tasks.filter(t => {
    if (t.status === 'Done' || t.status === 'Planned') return false
    const created = t.createdAt ? new Date(t.createdAt).getTime() : 0
    return created > 0 && (now - created) > staleThreshold
  })

  if (stalledTasks.length >= 3) {
    bottlenecks.push({
      type: 'stalled_pipeline',
      severity: stalledTasks.length >= 8 ? 'high' : 'medium',
      count: stalledTasks.length,
      tasks: stalledTasks.slice(0, 5).map(t => ({ name: t.name, agent: t.agent, status: t.status })),
      message: `${stalledTasks.length} tasks stalled for 12+ hours`,
      impact: 'Pipeline throughput degraded — may miss content deadlines',
      suggestion: 'Review stalled tasks for blockers or reassign to available agents',
    })
  }

  // 5. Content type imbalance — some types piling up while others flow
  const typeQueues = {}
  tasks.filter(t => t.status !== 'Done' && t.contentType).forEach(t => {
    if (!typeQueues[t.contentType]) typeQueues[t.contentType] = 0
    typeQueues[t.contentType]++
  })

  const avgTypeQueue = Object.values(typeQueues).length > 0
    ? Object.values(typeQueues).reduce((a, b) => a + b, 0) / Object.values(typeQueues).length
    : 0

  Object.entries(typeQueues).forEach(([type, count]) => {
    if (count > avgTypeQueue * 3 && count >= 5) {
      bottlenecks.push({
        type: 'type_congestion',
        severity: 'medium',
        contentType: type,
        queueSize: count,
        avgQueue: Math.round(avgTypeQueue * 10) / 10,
        message: `"${type}" is congested: ${count} queued (avg across types: ${Math.round(avgTypeQueue)})`,
        impact: 'Content mix becoming unbalanced — may affect campaign coverage',
        suggestion: `Prioritize "${type}" processing or add specialized agent capacity`,
      })
    }
  })

  // 6. Throughput prediction — estimate when current queue clears
  const last7d = 7 * 24 * HOUR_MS
  const recentCompletions = activity
    .filter(a => a.action === 'approved' && a.createdAt)
    .filter(a => now - new Date(a.createdAt).getTime() < last7d)

  const dailyThroughput = recentCompletions.length / 7
  const totalQueued = tasks.filter(t => t.status !== 'Done').length
  const estimatedClearDays = dailyThroughput > 0 ? Math.round((totalQueued / dailyThroughput) * 10) / 10 : null

  return {
    bottlenecks: bottlenecks.sort((a, b) => {
      const sev = { critical: 4, high: 3, medium: 2, low: 1 }
      return (sev[b.severity] || 0) - (sev[a.severity] || 0)
    }),
    pipelineFlow: stageFlow,
    throughput: {
      dailyAvg: Math.round(dailyThroughput * 10) / 10,
      weeklyTotal: recentCompletions.length,
      totalQueued,
      estimatedClearDays,
      clearLabel: estimatedClearDays !== null ? `~${estimatedClearDays} days` : 'N/A',
    },
    health: computeHealth(bottlenecks, totalQueued, dailyThroughput),
  }
}

function computeHealth(bottlenecks, queued, throughput) {
  let score = 100

  // Deductions
  bottlenecks.forEach(b => {
    if (b.severity === 'critical') score -= 25
    else if (b.severity === 'high') score -= 15
    else if (b.severity === 'medium') score -= 8
    else score -= 3
  })

  // Queue ratio penalty
  if (throughput > 0) {
    const daysToProcess = queued / throughput
    if (daysToProcess > 14) score -= 20
    else if (daysToProcess > 7) score -= 10
    else if (daysToProcess > 3) score -= 5
  }

  score = Math.max(0, Math.min(100, score))

  let label
  if (score >= 80) label = 'Healthy'
  else if (score >= 60) label = 'Warning'
  else if (score >= 40) label = 'Degraded'
  else label = 'Critical'

  return { score, label, bottleneckCount: bottlenecks.length }
}

export async function GET(request) {
  try {
    const [tasks, activity, agents] = await Promise.all([
      getTasks({ noCache: true }),
      getAllActivity(),
      getAgents({ noCache: true }),
    ])

    const result = analyzeBottlenecks(tasks, activity, agents)

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      summary: {
        healthScore: result.health.score,
        healthLabel: result.health.label,
        bottleneckCount: result.bottlenecks.length,
        critical: result.bottlenecks.filter(b => b.severity === 'critical').length,
        throughputPerDay: result.throughput.dailyAvg,
        estimatedClear: result.throughput.clearLabel,
      },
      bottlenecks: result.bottlenecks,
      pipelineFlow: result.pipelineFlow,
      throughput: result.throughput,
      health: result.health,
    })
  } catch (err) {
    console.error('[BOTTLENECKS] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
