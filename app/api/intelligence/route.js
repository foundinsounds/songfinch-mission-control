// Intelligence API — Deep analytics, A/B test analysis, performance insights
// Powers the Intelligence tab in the dashboard
// Computes: agent rankings, A/B winners, territory performance, memory utilization, pipeline health

import { getTasks, getAgents, getAllActivity } from '../../../lib/airtable'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [tasks, agents, activity] = await Promise.all([
      getTasks({ noCache: true }),
      getAgents({ noCache: true }),
      getAllActivity(), // Full activity feed (paginated) — not limited to 20 records
    ])

    const now = new Date()

    // ── A/B TEST ANALYSIS ─────────────────────────────
    const abResults = analyzeABTests(tasks, activity)

    // ── AGENT RANKINGS ────────────────────────────────
    const agentRankings = computeAgentRankings(tasks, agents, activity)

    // ── TERRITORY PERFORMANCE ─────────────────────────
    const territoryPerformance = computeTerritoryPerformance(tasks, activity)

    // ── MEMORY UTILIZATION ────────────────────────────
    const memoryStats = await fetchMemoryStats()

    // ── PIPELINE HEALTH ──────────────────────────────
    const pipelineHealth = computePipelineHealth(tasks, activity, now)

    // ── CONTENT TYPE PERFORMANCE ──────────────────────
    const contentTypePerformance = computeContentTypePerformance(tasks, activity)

    // ── RECENT LEARNINGS ─────────────────────────────
    const recentLearnings = extractRecentLearnings(activity)

    return NextResponse.json({
      abTests: abResults,
      agentRankings,
      territoryPerformance,
      memoryStats,
      pipelineHealth,
      contentTypePerformance,
      recentLearnings,
      generatedAt: now.toISOString(),
    })

  } catch (err) {
    console.error('[INTELLIGENCE] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── A/B TEST ANALYSIS ──────────────────────────────

function analyzeABTests(tasks, activity) {
  // Find A/B variant pairs: tasks with [A] and [B] in name
  const variantMap = {}

  tasks.forEach(task => {
    const variantMatch = task.name.match(/^(.*?)\s*\[(A|B)\]\s*$/i)
    if (variantMatch) {
      const baseName = variantMatch[1].trim()
      const variant = variantMatch[2].toUpperCase()
      if (!variantMap[baseName]) variantMap[baseName] = {}
      variantMap[baseName][variant] = task
    }
  })

  // Extract quality scores from review activities
  const taskScores = {}
  activity.forEach(a => {
    if (a.agent === 'CHIEF' && (a.action === 'approved' || a.action === 'revision requested')) {
      const scoreMatch = a.details?.match(/(?:Score|scored|approved)\s*\(?(\d+\.?\d*)\/5\)?/i)
      if (scoreMatch) {
        taskScores[a.task] = parseFloat(scoreMatch[1])
      }
    }
  })

  // Build results for complete pairs
  const results = []
  Object.entries(variantMap).forEach(([baseName, variants]) => {
    if (variants.A && variants.B) {
      const scoreA = taskScores[variants.A.name] || null
      const scoreB = taskScores[variants.B.name] || null

      let winner = null
      let delta = null
      if (scoreA !== null && scoreB !== null) {
        delta = Math.abs(scoreA - scoreB)
        if (delta >= 0.3) { // Minimum meaningful difference
          winner = scoreA > scoreB ? 'A' : 'B'
        } else {
          winner = 'tie'
        }
      }

      results.push({
        name: baseName,
        variantA: {
          task: variants.A.name,
          agent: variants.A.agent,
          status: variants.A.status,
          score: scoreA,
          contentType: variants.A.contentType,
        },
        variantB: {
          task: variants.B.name,
          agent: variants.B.agent,
          status: variants.B.status,
          score: scoreB,
          contentType: variants.B.contentType,
        },
        winner,
        scoreDelta: delta,
        bothComplete: variants.A.status === 'Done' && variants.B.status === 'Done',
        bothReviewed: scoreA !== null && scoreB !== null,
      })
    }
  })

  return {
    pairs: results,
    totalPairs: results.length,
    completedPairs: results.filter(r => r.bothReviewed).length,
    winnersFound: results.filter(r => r.winner && r.winner !== 'tie').length,
  }
}

// ── AGENT RANKINGS ──────────────────────────────

function computeAgentRankings(tasks, agents, activity) {
  // Extract all quality scores per agent
  const agentScores = {}
  const agentRevisions = {}

  activity.forEach(a => {
    if (a.agent === 'CHIEF') {
      const scoreMatch = a.details?.match(/(?:Score|scored|approved)\s*\(?(\d+\.?\d*)\/5\)?/i)
      if (scoreMatch) {
        const score = parseFloat(scoreMatch[1])
        // Find which agent created this task
        const task = tasks.find(t => t.name === a.task)
        if (task?.agent) {
          if (!agentScores[task.agent]) agentScores[task.agent] = []
          agentScores[task.agent].push(score)
        }
      }
      if (a.action === 'revision requested') {
        const task = tasks.find(t => t.name === a.task)
        if (task?.agent) {
          agentRevisions[task.agent] = (agentRevisions[task.agent] || 0) + 1
        }
      }
    }
  })

  return agents
    .filter(a => a.name !== 'CHIEF' && a.name !== 'CMO') // Exclude meta-agents
    .map(agent => {
      const scores = agentScores[agent.name] || []
      const agentTasks = tasks.filter(t => t.agent === agent.name)
      const doneTasks = agentTasks.filter(t => t.status === 'Done')
      const revisions = agentRevisions[agent.name] || 0

      const avgScore = scores.length > 0
        ? (scores.reduce((a, b) => a + b, 0) / scores.length)
        : null

      // Composite ranking: 40% quality + 30% completion rate + 30% volume (normalized)
      const qualityScore = avgScore ? (avgScore / 5) * 40 : 0
      const completionRate = agentTasks.length > 0 ? (doneTasks.length / agentTasks.length) * 30 : 0
      const volumeScore = Math.min(30, doneTasks.length * 3) // Cap at 30 pts, 10 tasks = max

      const compositeScore = Math.round(qualityScore + completionRate + volumeScore)

      return {
        name: agent.name,
        emoji: agent.emoji,
        role: agent.role,
        status: agent.status,
        totalTasks: agentTasks.length,
        completed: doneTasks.length,
        avgQuality: avgScore ? parseFloat(avgScore.toFixed(1)) : null,
        revisions,
        revisionRate: scores.length > 0 ? Math.round((revisions / scores.length) * 100) : 0,
        compositeScore,
        topScore: scores.length > 0 ? Math.max(...scores) : null,
        recentTrend: computeScoreTrend(scores),
      }
    })
    .sort((a, b) => b.compositeScore - a.compositeScore)
}

function computeScoreTrend(scores) {
  if (scores.length < 2) return null
  const recent = scores.slice(-3)
  const older = scores.slice(0, -3)
  if (older.length === 0) return null
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length
  const delta = recentAvg - olderAvg
  return delta > 0.2 ? 'improving' : delta < -0.2 ? 'declining' : 'stable'
}

// ── TERRITORY PERFORMANCE ──────────────────────────

function computeTerritoryPerformance(tasks, activity) {
  const territories = {}

  // Extract quality scores per task
  const taskScores = {}
  activity.forEach(a => {
    const scoreMatch = a.details?.match(/(?:Score|scored|approved)\s*\(?(\d+\.?\d*)\/5\)?/i)
    if (scoreMatch) taskScores[a.task] = parseFloat(scoreMatch[1])
  })

  tasks.forEach(task => {
    const terrMatch = task.description?.match(/Territory:\s*(Celebration|Gratitude|Memory|Identity|Tribute)/i)
    if (!terrMatch) return

    const terr = terrMatch[1]
    if (!territories[terr]) {
      territories[terr] = { total: 0, done: 0, scores: [], contentTypes: {}, agents: {} }
    }

    territories[terr].total++
    if (task.status === 'Done') territories[terr].done++

    const score = taskScores[task.name]
    if (score) territories[terr].scores.push(score)

    // Track content type distribution
    const ct = task.contentType || 'General'
    territories[terr].contentTypes[ct] = (territories[terr].contentTypes[ct] || 0) + 1

    // Track agent distribution
    if (task.agent) {
      territories[terr].agents[task.agent] = (territories[terr].agents[task.agent] || 0) + 1
    }
  })

  return Object.entries(territories).map(([name, data]) => ({
    name,
    total: data.total,
    done: data.done,
    completionRate: data.total > 0 ? Math.round((data.done / data.total) * 100) : 0,
    avgScore: data.scores.length > 0
      ? parseFloat((data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1))
      : null,
    bestScore: data.scores.length > 0 ? Math.max(...data.scores) : null,
    topContentType: Object.entries(data.contentTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    topAgent: Object.entries(data.agents).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    reviewCount: data.scores.length,
  })).sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0))
}

// ── MEMORY UTILIZATION ─────────────────────────────

async function fetchMemoryStats() {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/memory`, { cache: 'no-store' })
    if (!res.ok) return { total: 0, byAgent: {}, byType: {} }

    const { memories = [] } = await res.json()

    const byAgent = {}
    const byType = {}
    memories.forEach(m => {
      byAgent[m.agent] = (byAgent[m.agent] || 0) + 1
      byType[m.type] = (byType[m.type] || 0) + 1
    })

    return {
      total: memories.length,
      byAgent,
      byType,
      recentMemories: memories.slice(0, 10).map(m => ({
        agent: m.agent,
        type: m.type,
        content: m.content?.substring(0, 150),
        importance: m.importance,
      })),
    }
  } catch {
    return { total: 0, byAgent: {}, byType: {}, recentMemories: [] }
  }
}

// ── PIPELINE HEALTH ────────────────────────────────

function computePipelineHealth(tasks, activity, now) {
  const stages = {
    inbox: tasks.filter(t => t.status === 'Inbox'),
    assigned: tasks.filter(t => t.status === 'Assigned'),
    inProgress: tasks.filter(t => t.status === 'In Progress'),
    review: tasks.filter(t => t.status === 'Review'),
    done: tasks.filter(t => t.status === 'Done'),
  }

  // Stall detection: tasks in same status for too long
  const stalls = []
  const STALL_HOURS = {
    'Assigned': 4,
    'In Progress': 8,
    'Review': 4,
  }

  tasks.forEach(task => {
    const maxHours = STALL_HOURS[task.status]
    if (!maxHours || !task.createdAt) return

    const ageHours = (now - new Date(task.createdAt)) / (1000 * 60 * 60)
    if (ageHours > maxHours * 3) { // 3x the expected time = stall
      stalls.push({
        task: task.name,
        agent: task.agent,
        status: task.status,
        ageHours: Math.round(ageHours),
        expectedHours: maxHours,
      })
    }
  })

  // Pipeline flow rate (tasks completed per hour over last 24h)
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000)
  const recentCompletions = activity.filter(a =>
    a.action === 'approved' && a.timestamp && new Date(a.timestamp) >= dayAgo
  ).length

  // Queue health
  const totalActive = stages.assigned.length + stages.inProgress.length + stages.review.length
  const queueHealth = totalActive < 5 ? 'low' :
    totalActive < 20 ? 'healthy' :
    totalActive < 40 ? 'busy' : 'overloaded'

  // Bottleneck detection
  let bottleneck = null
  if (stages.review.length > stages.inProgress.length * 2 && stages.review.length > 3) {
    bottleneck = { stage: 'Review', count: stages.review.length, message: 'Tasks piling up in review' }
  } else if (stages.inbox.length > 10) {
    bottleneck = { stage: 'Inbox', count: stages.inbox.length, message: 'Too many unassigned tasks' }
  } else if (stages.assigned.length > stages.inProgress.length * 3 && stages.assigned.length > 5) {
    bottleneck = { stage: 'Assigned', count: stages.assigned.length, message: 'Tasks assigned but not started' }
  }

  return {
    stages: {
      inbox: stages.inbox.length,
      assigned: stages.assigned.length,
      inProgress: stages.inProgress.length,
      review: stages.review.length,
      done: stages.done.length,
    },
    stalls,
    stallCount: stalls.length,
    flowRate: recentCompletions, // completions in last 24h
    queueHealth,
    bottleneck,
    totalActive,
  }
}

// ── CONTENT TYPE PERFORMANCE ───────────────────────

function computeContentTypePerformance(tasks, activity) {
  const typeScores = {}

  // Build task score map
  const taskScores = {}
  activity.forEach(a => {
    const scoreMatch = a.details?.match(/(?:Score|scored|approved)\s*\(?(\d+\.?\d*)\/5\)?/i)
    if (scoreMatch) taskScores[a.task] = parseFloat(scoreMatch[1])
  })

  tasks.forEach(task => {
    const ct = task.contentType || 'General'
    if (!typeScores[ct]) typeScores[ct] = { total: 0, done: 0, scores: [], agents: new Set() }
    typeScores[ct].total++
    if (task.status === 'Done') typeScores[ct].done++
    if (task.agent) typeScores[ct].agents.add(task.agent)

    const score = taskScores[task.name]
    if (score) typeScores[ct].scores.push(score)
  })

  return Object.entries(typeScores)
    .map(([type, data]) => ({
      type,
      total: data.total,
      done: data.done,
      avgScore: data.scores.length > 0
        ? parseFloat((data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1))
        : null,
      agents: [...data.agents],
      reviewCount: data.scores.length,
    }))
    .sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0))
}

// ── RECENT LEARNINGS ──────────────────────────────

function extractRecentLearnings(activity) {
  return activity
    .filter(a =>
      a.agent === 'CHIEF' &&
      (a.action === 'approved' || a.action === 'revision requested') &&
      a.details
    )
    .slice(0, 15)
    .map(a => ({
      task: a.task,
      action: a.action,
      summary: a.details?.substring(0, 200),
      timestamp: a.timestamp,
    }))
}
