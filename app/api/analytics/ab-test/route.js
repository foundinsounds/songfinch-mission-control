// A/B Test Performance Analysis — Compares content variations to find winners
// Analyzes: same content type + platform combos across agents to find best approaches
// Also detects which content types, hooks, and formats outperform others

import { NextResponse } from 'next/server'
import { getTasks, getAllActivity } from '../../../../lib/airtable'

export const dynamic = 'force-dynamic'

// Group tasks into natural A/B comparisons
function buildComparisons(tasks, activity) {
  const comparisons = []

  // 1. Same content type, different agents → which agent excels
  const byContentType = {}
  tasks.forEach(t => {
    if (t.status !== 'Done' || !t.agent || !t.contentType) return
    const key = t.contentType
    if (!byContentType[key]) byContentType[key] = []
    byContentType[key].push(t)
  })

  // Build scored events lookup
  const scoreMap = {}
  activity
    .filter(a => a.action === 'approved' && a.details)
    .forEach(event => {
      const scoreMatch = event.details.match(/\((\d+\.?\d*)\/5\)/)
      if (scoreMatch) scoreMap[event.task] = parseFloat(scoreMatch[1])
    })

  // Compare agents within each content type
  Object.entries(byContentType).forEach(([contentType, ctTasks]) => {
    if (ctTasks.length < 2) return

    const byAgent = {}
    ctTasks.forEach(t => {
      if (!byAgent[t.agent]) byAgent[t.agent] = []
      byAgent[t.agent].push({
        name: t.name,
        score: scoreMap[t.name] || null,
        completedAt: t.completedAt,
        output: t.output ? t.output.length : 0,
      })
    })

    const agentStats = Object.entries(byAgent)
      .filter(([, tasks]) => tasks.some(t => t.score))
      .map(([agent, tasks]) => {
        const scored = tasks.filter(t => t.score)
        const avgScore = scored.length > 0
          ? Math.round((scored.reduce((s, t) => s + t.score, 0) / scored.length) * 10) / 10
          : null
        return {
          agent,
          tasks: tasks.length,
          avgScore,
          topScore: scored.length > 0 ? Math.max(...scored.map(t => t.score)) : null,
          avgOutputLength: Math.round(tasks.reduce((s, t) => s + t.output, 0) / tasks.length),
        }
      })
      .sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0))

    if (agentStats.length >= 2) {
      const winner = agentStats[0]
      const runnerUp = agentStats[1]
      const lift = winner.avgScore && runnerUp.avgScore
        ? Math.round(((winner.avgScore - runnerUp.avgScore) / runnerUp.avgScore) * 1000) / 10
        : null

      comparisons.push({
        type: 'agent_comparison',
        dimension: contentType,
        sampleSize: ctTasks.length,
        winner: winner.agent,
        runnerUp: runnerUp.agent,
        winnerScore: winner.avgScore,
        runnerUpScore: runnerUp.avgScore,
        liftPercent: lift,
        confidence: computeConfidence(agentStats[0].tasks, agentStats[1].tasks, lift),
        breakdown: agentStats,
      })
    }
  })

  // 2. Same agent, different content types → where does each agent shine
  const byAgent = {}
  tasks.forEach(t => {
    if (t.status !== 'Done' || !t.agent || !t.contentType) return
    if (!byAgent[t.agent]) byAgent[t.agent] = {}
    if (!byAgent[t.agent][t.contentType]) byAgent[t.agent][t.contentType] = []
    byAgent[t.agent][t.contentType].push({
      name: t.name,
      score: scoreMap[t.name] || null,
    })
  })

  Object.entries(byAgent).forEach(([agent, contentTypes]) => {
    const ctStats = Object.entries(contentTypes)
      .map(([ct, tasks]) => {
        const scored = tasks.filter(t => t.score)
        return {
          contentType: ct,
          tasks: tasks.length,
          avgScore: scored.length > 0
            ? Math.round((scored.reduce((s, t) => s + t.score, 0) / scored.length) * 10) / 10
            : null,
        }
      })
      .filter(ct => ct.avgScore !== null)
      .sort((a, b) => b.avgScore - a.avgScore)

    if (ctStats.length >= 2) {
      comparisons.push({
        type: 'content_type_comparison',
        dimension: agent,
        sampleSize: ctStats.reduce((s, ct) => s + ct.tasks, 0),
        bestContentType: ctStats[0].contentType,
        bestScore: ctStats[0].avgScore,
        worstContentType: ctStats[ctStats.length - 1].contentType,
        worstScore: ctStats[ctStats.length - 1].avgScore,
        breakdown: ctStats,
      })
    }
  })

  // 3. Priority impact — do high-priority tasks get better scores?
  const byPriority = { High: [], Medium: [], Low: [] }
  tasks.forEach(t => {
    if (t.status !== 'Done' || !t.priority) return
    const score = scoreMap[t.name]
    if (score) byPriority[t.priority]?.push(score)
  })

  const priorityStats = Object.entries(byPriority)
    .filter(([, scores]) => scores.length > 0)
    .map(([priority, scores]) => ({
      priority,
      count: scores.length,
      avgScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
    }))

  if (priorityStats.length >= 2) {
    comparisons.push({
      type: 'priority_impact',
      dimension: 'Priority Level',
      breakdown: priorityStats,
      insight: derivesPriorityInsight(priorityStats),
    })
  }

  // 4. Output length vs quality correlation
  const outputQuality = tasks
    .filter(t => t.status === 'Done' && t.output && scoreMap[t.name])
    .map(t => ({ length: t.output.length, score: scoreMap[t.name] }))

  if (outputQuality.length >= 5) {
    const shortContent = outputQuality.filter(o => o.length < 1000)
    const mediumContent = outputQuality.filter(o => o.length >= 1000 && o.length < 3000)
    const longContent = outputQuality.filter(o => o.length >= 3000)

    const lengthBuckets = [
      { label: 'Short (<1k chars)', items: shortContent },
      { label: 'Medium (1-3k chars)', items: mediumContent },
      { label: 'Long (3k+ chars)', items: longContent },
    ]
      .filter(b => b.items.length > 0)
      .map(b => ({
        label: b.label,
        count: b.items.length,
        avgScore: Math.round((b.items.reduce((s, o) => s + o.score, 0) / b.items.length) * 10) / 10,
      }))

    comparisons.push({
      type: 'length_quality_correlation',
      dimension: 'Output Length',
      breakdown: lengthBuckets,
      insight: deriveLengthInsight(lengthBuckets),
    })
  }

  return comparisons
}

function computeConfidence(n1, n2, lift) {
  if (!lift) return 'insufficient'
  const minSample = Math.min(n1, n2)
  if (minSample >= 10 && Math.abs(lift) >= 10) return 'high'
  if (minSample >= 5 && Math.abs(lift) >= 5) return 'medium'
  if (minSample >= 3) return 'low'
  return 'insufficient'
}

function derivesPriorityInsight(stats) {
  const sorted = [...stats].sort((a, b) => b.avgScore - a.avgScore)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  if (best.priority === 'High') return `High-priority tasks score ${best.avgScore}/5 on average — focus drives quality`
  if (best.priority === 'Low') return `Surprisingly, low-priority tasks score highest (${best.avgScore}/5) — agents may rush high-priority work`
  return `${best.priority}-priority tasks perform best at ${best.avgScore}/5`
}

function deriveLengthInsight(buckets) {
  const sorted = [...buckets].sort((a, b) => b.avgScore - a.avgScore)
  const best = sorted[0]
  return `${best.label} content scores highest at ${best.avgScore}/5 — sweet spot for quality`
}

// Aggregate actionable recommendations
function buildRecommendations(comparisons) {
  const recommendations = []

  comparisons
    .filter(c => c.type === 'agent_comparison' && c.confidence !== 'insufficient')
    .forEach(c => {
      if (c.liftPercent && c.liftPercent > 5) {
        recommendations.push({
          action: 'route',
          priority: c.confidence === 'high' ? 'high' : 'medium',
          suggestion: `Route ${c.dimension} tasks to ${c.winner} — ${c.liftPercent}% quality lift over ${c.runnerUp}`,
          data: { contentType: c.dimension, preferAgent: c.winner, lift: c.liftPercent },
        })
      }
    })

  comparisons
    .filter(c => c.type === 'content_type_comparison')
    .forEach(c => {
      if (c.bestScore - c.worstScore >= 0.5) {
        recommendations.push({
          action: 'specialize',
          priority: 'medium',
          suggestion: `${c.dimension} excels at ${c.bestContentType} (${c.bestScore}/5) but struggles with ${c.worstContentType} (${c.worstScore}/5) — consider re-routing`,
          data: { agent: c.dimension, bestType: c.bestContentType, worstType: c.worstContentType },
        })
      }
    })

  return recommendations.sort((a, b) => {
    const p = { high: 3, medium: 2, low: 1 }
    return (p[b.priority] || 0) - (p[a.priority] || 0)
  })
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const typeFilter = searchParams.get('type') // agent_comparison, content_type_comparison, etc.
    const agentFilter = searchParams.get('agent')

    const [tasks, activity] = await Promise.all([
      getTasks({ noCache: true }),
      getAllActivity(),
    ])

    let comparisons = buildComparisons(tasks, activity)
    const recommendations = buildRecommendations(comparisons)

    // Apply filters
    if (typeFilter) {
      comparisons = comparisons.filter(c => c.type === typeFilter)
    }
    if (agentFilter) {
      comparisons = comparisons.filter(c =>
        c.dimension === agentFilter ||
        c.winner === agentFilter ||
        c.runnerUp === agentFilter ||
        c.breakdown?.some(b => b.agent === agentFilter)
      )
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      comparisons,
      recommendations,
      summary: {
        totalComparisons: comparisons.length,
        highConfidence: comparisons.filter(c => c.confidence === 'high').length,
        actionableRecommendations: recommendations.length,
      },
    })
  } catch (err) {
    console.error('[AB-TEST] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
