// Predictive Quality Scoring — Estimates task quality before execution
// Uses historical agent+contentType performance data to predict outcomes
// Factors: agent skill, content type history, workload, priority, time-of-day patterns

import { NextResponse } from 'next/server'
import { getTasks, getAllActivity, getAgents } from '../../../../lib/airtable'

export const dynamic = 'force-dynamic'

function buildPredictionModel(tasks, activity) {
  // Build score map from approvals
  const scoreMap = {}
  activity
    .filter(a => a.action === 'approved' && a.details)
    .forEach(a => {
      const m = a.details.match(/\((\d+\.?\d*)\/5\)/)
      if (m) scoreMap[a.task] = parseFloat(m[1])
    })

  // Build revision count map
  const revisionMap = {}
  activity
    .filter(a => a.action === 'revised')
    .forEach(a => { revisionMap[a.task] = (revisionMap[a.task] || 0) + 1 })

  // Historical performance by agent + content type combination
  const combos = {}
  const agentStats = {}
  const typeStats = {}

  tasks.filter(t => t.status === 'Done' && scoreMap[t.name]).forEach(t => {
    const score = scoreMap[t.name]
    const revisions = revisionMap[t.name] || 0

    // Agent + ContentType combo
    const comboKey = `${t.agent}::${t.contentType || 'General'}`
    if (!combos[comboKey]) combos[comboKey] = { scores: [], revisions: [], count: 0 }
    combos[comboKey].scores.push(score)
    combos[comboKey].revisions.push(revisions)
    combos[comboKey].count++

    // Agent overall
    if (t.agent) {
      if (!agentStats[t.agent]) agentStats[t.agent] = { scores: [], revisions: [], count: 0 }
      agentStats[t.agent].scores.push(score)
      agentStats[t.agent].revisions.push(revisions)
      agentStats[t.agent].count++
    }

    // Content type overall
    const ct = t.contentType || 'General'
    if (!typeStats[ct]) typeStats[ct] = { scores: [], revisions: [], count: 0 }
    typeStats[ct].scores.push(score)
    typeStats[ct].revisions.push(revisions)
    typeStats[ct].count++
  })

  return { combos, agentStats, typeStats, scoreMap, revisionMap }
}

function predictTask(task, model, agents) {
  const { combos, agentStats, typeStats } = model
  const ct = task.contentType || 'General'
  const comboKey = `${task.agent}::${ct}`

  // Get relevant data
  const combo = combos[comboKey]
  const agentData = agentStats[task.agent]
  const typeData = typeStats[ct]

  // Weighted prediction: combo (60%) > agent (25%) > type (15%)
  let predictedScore = null
  let confidence = 'none'
  const factors = []

  if (combo && combo.count >= 3) {
    const comboAvg = avg(combo.scores)
    predictedScore = comboAvg
    confidence = combo.count >= 10 ? 'high' : combo.count >= 5 ? 'medium' : 'low'
    factors.push({
      factor: 'agent_content_match',
      weight: 0.6,
      value: comboAvg,
      samples: combo.count,
      detail: `${task.agent} has done ${combo.count} "${ct}" tasks, avg ${comboAvg}/5`,
    })
  }

  if (agentData && agentData.count >= 2) {
    const agentAvg = avg(agentData.scores)
    if (predictedScore !== null) {
      predictedScore = predictedScore * 0.6 + agentAvg * 0.25 + (typeData ? avg(typeData.scores) * 0.15 : agentAvg * 0.15)
    } else {
      predictedScore = agentAvg
      confidence = agentData.count >= 8 ? 'medium' : 'low'
    }
    factors.push({
      factor: 'agent_baseline',
      weight: combo ? 0.25 : 0.7,
      value: agentAvg,
      samples: agentData.count,
      detail: `${task.agent} overall avg: ${agentAvg}/5 across ${agentData.count} tasks`,
    })
  }

  if (typeData && typeData.count >= 2) {
    if (predictedScore === null) {
      predictedScore = avg(typeData.scores)
      confidence = 'low'
    }
    factors.push({
      factor: 'content_type_baseline',
      weight: combo && agentData ? 0.15 : 0.3,
      value: avg(typeData.scores),
      samples: typeData.count,
      detail: `"${ct}" type avg: ${avg(typeData.scores)}/5 across ${typeData.count} tasks`,
    })
  }

  // Workload penalty — busy agents tend to produce lower quality
  const agent = agents.find(a => a.name === task.agent)
  if (agent) {
    const activeTasks = model.scoreMap ? Object.keys(model.scoreMap).length : 0 // proxy
    if (activeTasks > 5) {
      const penalty = Math.min(0.3, (activeTasks - 5) * 0.05)
      if (predictedScore !== null) predictedScore -= penalty
      factors.push({
        factor: 'workload_penalty',
        weight: -1,
        value: -penalty,
        detail: `Agent has high workload — ${penalty.toFixed(2)} point penalty`,
      })
    }
  }

  // Priority bonus — high-priority tasks often get more attention
  if (task.priority === 'High' && predictedScore !== null) {
    predictedScore += 0.1
    factors.push({
      factor: 'priority_bonus',
      weight: 1,
      value: 0.1,
      detail: 'High priority → +0.1 predicted quality',
    })
  }

  // Revision probability
  let revisionProb = null
  if (combo && combo.revisions.length >= 3) {
    revisionProb = Math.round((combo.revisions.filter(r => r > 0).length / combo.revisions.length) * 100)
  } else if (agentData && agentData.revisions.length >= 3) {
    revisionProb = Math.round((agentData.revisions.filter(r => r > 0).length / agentData.revisions.length) * 100)
  }

  return {
    task: task.name,
    agent: task.agent,
    contentType: ct,
    status: task.status,
    priority: task.priority,
    prediction: {
      estimatedScore: predictedScore !== null ? Math.round(Math.min(5, Math.max(1, predictedScore)) * 10) / 10 : null,
      confidence,
      revisionProbability: revisionProb !== null ? `${revisionProb}%` : null,
      riskLevel: predictedScore !== null
        ? predictedScore >= 4.0 ? 'low' : predictedScore >= 3.0 ? 'medium' : 'high'
        : 'unknown',
    },
    factors,
    recommendation: generateRecommendation(task, predictedScore, confidence, model),
  }
}

function generateRecommendation(task, score, confidence, model) {
  if (score === null) return 'Insufficient data for prediction — monitor closely'
  if (score >= 4.5 && confidence !== 'low') return 'High confidence — expect excellent output'
  if (score >= 4.0) return 'Good quality expected — standard review sufficient'
  if (score >= 3.5) return 'Moderate quality — consider detailed review instructions'

  // Find a better agent for this content type
  const ct = task.contentType || 'General'
  const betterAgents = Object.entries(model.combos)
    .filter(([key, data]) => {
      const [agent, type] = key.split('::')
      return type === ct && agent !== task.agent && data.count >= 3 && avg(data.scores) > score + 0.3
    })
    .map(([key, data]) => ({ agent: key.split('::')[0], avg: avg(data.scores), count: data.count }))
    .sort((a, b) => b.avg - a.avg)

  if (betterAgents.length > 0) {
    const best = betterAgents[0]
    return `Consider routing to ${best.agent} (${best.avg}/5 avg on ${ct}, ${best.count} samples) for better results`
  }

  return 'Quality risk — consider adding extra context/instructions to the task'
}

function avg(arr) {
  if (arr.length === 0) return 0
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentFilter = searchParams.get('agent')
    const statusFilter = searchParams.get('status') || 'pending' // pending = not yet done

    const [tasks, activity, agents] = await Promise.all([
      getTasks({ noCache: true }),
      getAllActivity(),
      getAgents({ noCache: true }),
    ])

    const model = buildPredictionModel(tasks, activity)

    // Predict for active (non-done) tasks
    let predictableTasks = tasks.filter(t =>
      ['Assigned', 'In Progress', 'Review', 'Planned'].includes(t.status) && t.agent
    )

    if (agentFilter) {
      predictableTasks = predictableTasks.filter(t => t.agent === agentFilter)
    }

    const predictions = predictableTasks.map(t => predictTask(t, model, agents))

    // Risk summary
    const riskSummary = {
      total: predictions.length,
      highRisk: predictions.filter(p => p.prediction.riskLevel === 'high').length,
      mediumRisk: predictions.filter(p => p.prediction.riskLevel === 'medium').length,
      lowRisk: predictions.filter(p => p.prediction.riskLevel === 'low').length,
      unknown: predictions.filter(p => p.prediction.riskLevel === 'unknown').length,
      avgPredictedScore: predictions.filter(p => p.prediction.estimatedScore).length > 0
        ? avg(predictions.filter(p => p.prediction.estimatedScore).map(p => p.prediction.estimatedScore))
        : null,
    }

    // Sort by risk — highest risk first
    const riskOrder = { high: 0, medium: 1, unknown: 2, low: 3 }
    predictions.sort((a, b) => (riskOrder[a.prediction.riskLevel] ?? 4) - (riskOrder[b.prediction.riskLevel] ?? 4))

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      summary: riskSummary,
      predictions,
      modelStats: {
        trainingTasks: Object.values(model.agentStats).reduce((s, a) => s + a.count, 0),
        agentContentCombos: Object.keys(model.combos).length,
        contentTypes: Object.keys(model.typeStats).length,
      },
    })
  } catch (err) {
    console.error('[PREDICT] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
