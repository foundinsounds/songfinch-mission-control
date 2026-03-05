// Pipeline Rebalancer — Auto-scales agent workloads for optimal throughput
// Detects: overloaded agents, idle agents, stalled tasks, uneven distribution
// Actions: redistributes tasks, suggests reassignments, flags bottlenecks

import { NextResponse } from 'next/server'
import { getTasks, getAgents, updateTask, addActivity } from '../../../../lib/airtable'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_OPTIMAL_LOAD = 5    // Ideal max tasks per agent
const OVERLOAD_THRESHOLD = 8  // Above this = overloaded
const STALL_HOURS = 6         // Task unchanged for this long = stalled

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const { searchParams } = new URL(request.url)
  const auth = request.headers.get('authorization')?.replace('Bearer ', '')
  const headerSecret = request.headers.get('x-cron-secret') || request.headers.get('x-webhook-secret')
  const queryKey = searchParams.get('key')
  return auth === secret || headerSecret === secret || queryKey === secret
}

function analyzeWorkloads(tasks, agents) {
  const now = Date.now()
  const analysis = {
    agents: {},
    overloaded: [],
    underutilized: [],
    stalledTasks: [],
    redistributionPlan: [],
  }

  // Build per-agent workload profile
  agents.forEach(a => {
    const agentTasks = tasks.filter(t => t.agent === a.name && t.status !== 'Done')
    const activeTasks = agentTasks.filter(t => ['Assigned', 'In Progress'].includes(t.status))
    const reviewTasks = agentTasks.filter(t => t.status === 'Review')

    // Detect stalled tasks (no update in STALL_HOURS)
    const stalled = agentTasks.filter(t => {
      if (t.status === 'Assigned') {
        const created = t.createdAt ? new Date(t.createdAt).getTime() : 0
        return (now - created) > STALL_HOURS * 3600000
      }
      return false
    })

    analysis.agents[a.name] = {
      name: a.name,
      type: a.type,
      status: a.status,
      totalActive: agentTasks.length,
      inProgress: activeTasks.length,
      inReview: reviewTasks.length,
      stalled: stalled.length,
      stalledTasks: stalled.map(t => t.name),
      loadScore: computeLoadScore(agentTasks.length, activeTasks.length, stalled.length),
      capacity: Math.max(0, MAX_OPTIMAL_LOAD - agentTasks.length),
    }

    if (agentTasks.length > OVERLOAD_THRESHOLD) {
      analysis.overloaded.push(a.name)
    } else if (agentTasks.length === 0 && a.status !== 'Idle' && a.type !== 'EXEC') {
      analysis.underutilized.push(a.name)
    }

    stalled.forEach(t => analysis.stalledTasks.push({ task: t.name, agent: a.name, status: t.status }))
  })

  // Build redistribution plan
  if (analysis.overloaded.length > 0 && analysis.underutilized.length > 0) {
    analysis.overloaded.forEach(overAgent => {
      const overData = analysis.agents[overAgent]
      const excess = overData.totalActive - MAX_OPTIMAL_LOAD

      // Find tasks that can be moved (prefer assigned, not in-progress)
      const movable = tasks.filter(t =>
        t.agent === overAgent &&
        t.status === 'Assigned' &&
        t.status !== 'Done'
      ).slice(0, excess)

      movable.forEach(task => {
        // Find best underutilized agent
        const target = analysis.underutilized
          .map(name => analysis.agents[name])
          .filter(a => a.capacity > 0 && a.type !== 'EXEC')
          .sort((a, b) => b.capacity - a.capacity)[0]

        if (target) {
          analysis.redistributionPlan.push({
            task: task.name,
            taskId: task.id,
            from: overAgent,
            to: target.name,
            reason: `${overAgent} overloaded (${overData.totalActive} tasks), ${target.name} has capacity (${target.capacity} slots)`,
          })
          target.capacity--
        }
      })
    })
  }

  return analysis
}

function computeLoadScore(total, active, stalled) {
  // 0-100 scale: 0=idle, 50=optimal, 100=critical
  let score = (total / MAX_OPTIMAL_LOAD) * 50
  if (total > OVERLOAD_THRESHOLD) score += (total - OVERLOAD_THRESHOLD) * 10
  if (stalled > 0) score += stalled * 15
  return Math.min(100, Math.round(score))
}

// GET: Analyze workloads without making changes (dry run)
export async function GET(request) {
  try {
    const [tasks, agents] = await Promise.all([
      getTasks({ noCache: true }),
      getAgents({ noCache: true }),
    ])

    const analysis = analyzeWorkloads(tasks, agents)

    // Overall health metrics
    const totalActive = Object.values(analysis.agents).reduce((s, a) => s + a.totalActive, 0)
    const avgLoad = Object.values(analysis.agents).filter(a => a.type !== 'EXEC').length > 0
      ? Math.round((totalActive / Object.values(analysis.agents).filter(a => a.type !== 'EXEC').length) * 10) / 10
      : 0

    const giniCoefficient = computeGini(Object.values(analysis.agents).filter(a => a.type !== 'EXEC').map(a => a.totalActive))

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      summary: {
        totalActiveTasks: totalActive,
        avgLoadPerAgent: avgLoad,
        overloadedAgents: analysis.overloaded.length,
        underutilizedAgents: analysis.underutilized.length,
        stalledTasks: analysis.stalledTasks.length,
        redistributionSuggestions: analysis.redistributionPlan.length,
        distributionEquity: Math.round((1 - giniCoefficient) * 100), // 100 = perfectly equal
      },
      agents: analysis.agents,
      overloaded: analysis.overloaded,
      underutilized: analysis.underutilized,
      stalledTasks: analysis.stalledTasks,
      redistributionPlan: analysis.redistributionPlan,
    })
  } catch (err) {
    console.error('[REBALANCE] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST: Execute rebalancing (actually move tasks)
export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const dryRun = body.dryRun !== false // Default to dry run for safety

    const [tasks, agents] = await Promise.all([
      getTasks({ noCache: true }),
      getAgents({ noCache: true }),
    ])

    const analysis = analyzeWorkloads(tasks, agents)

    if (analysis.redistributionPlan.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Workloads are balanced — no redistribution needed',
        moved: 0,
      })
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        message: `Would redistribute ${analysis.redistributionPlan.length} tasks`,
        plan: analysis.redistributionPlan,
      })
    }

    // Execute redistribution
    const results = []
    for (const move of analysis.redistributionPlan) {
      try {
        await updateTask(move.taskId, { 'Agent': move.to })
        await addActivity({
          'Agent': 'System',
          'Action': 'rebalanced',
          'Task': move.task,
          'Details': `Auto-rebalanced: ${move.from} → ${move.to}. ${move.reason}`,
          'Type': 'Rebalance',
        })
        results.push({ ...move, success: true })
      } catch (err) {
        results.push({ ...move, success: false, error: err.message })
      }
    }

    const successCount = results.filter(r => r.success).length

    return NextResponse.json({
      success: true,
      message: `Rebalanced ${successCount}/${results.length} tasks`,
      moved: successCount,
      results,
    })
  } catch (err) {
    console.error('[REBALANCE] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Gini coefficient: measures inequality of distribution (0 = equal, 1 = one agent has everything)
function computeGini(values) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const sum = sorted.reduce((a, b) => a + b, 0)
  if (sum === 0) return 0

  let cumulativeSum = 0
  let giniNumerator = 0
  sorted.forEach((val, i) => {
    cumulativeSum += val
    giniNumerator += (2 * (i + 1) - n - 1) * val
  })

  return giniNumerator / (n * sum)
}
