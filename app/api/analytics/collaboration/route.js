// Agent Collaboration Detection — Maps how agents work together
// Detects: handoff patterns, revision chains, co-campaign work
// Measures: collaboration quality, handoff efficiency, synergy scores

import { NextResponse } from 'next/server'
import { getTasks, getAllActivity } from '../../../../lib/airtable'

export const dynamic = 'force-dynamic'

function analyzeCollaboration(tasks, activity) {
  // Build handoff map: who hands off to whom, and outcomes
  const handoffs = {}
  const revisionChains = {}
  const campaignCollabs = {}

  // Track task-level interactions from activity feed
  const taskEvents = {}
  activity.forEach(a => {
    if (!a.task) return
    if (!taskEvents[a.task]) taskEvents[a.task] = []
    taskEvents[a.task].push(a)
  })

  // Detect CHIEF review interactions (main collaboration point)
  const scoreMap = {}
  activity
    .filter(a => a.action === 'approved' && a.details)
    .forEach(a => {
      const m = a.details.match(/\((\d+\.?\d*)\/5\)/)
      if (m) scoreMap[a.task] = parseFloat(m[1])
    })

  // Build revision chain: agent produces → CHIEF reviews → agent revises
  activity.filter(a => a.action === 'revised').forEach(a => {
    const task = tasks.find(t => t.name === a.task)
    if (!task || !task.agent) return

    const key = `${task.agent}→CHIEF`
    if (!revisionChains[key]) revisionChains[key] = { from: task.agent, to: 'CHIEF', count: 0, tasks: [] }
    revisionChains[key].count++
    revisionChains[key].tasks.push(a.task)
  })

  // Detect agent-to-agent handoffs (task reassignment in activity)
  activity.filter(a => a.action === 'rebalanced' || (a.action === 'assigned' && a.details)).forEach(a => {
    const fromMatch = a.details?.match(/from\s+(\w+)/i) || a.details?.match(/(\w+)\s*→/)
    const toMatch = a.details?.match(/to\s+(\w+)/i) || a.details?.match(/→\s*(\w+)/)
    if (fromMatch && toMatch) {
      const key = `${fromMatch[1]}→${toMatch[1]}`
      if (!handoffs[key]) handoffs[key] = { from: fromMatch[1], to: toMatch[1], count: 0, tasks: [] }
      handoffs[key].count++
      handoffs[key].tasks.push(a.task)
    }
  })

  // Campaign collaboration — agents working on same campaign
  const campaigns = {}
  tasks.forEach(t => {
    if (!t.campaign || !t.agent) return
    if (!campaigns[t.campaign]) campaigns[t.campaign] = {}
    if (!campaigns[t.campaign][t.agent]) campaigns[t.campaign][t.agent] = { total: 0, done: 0, scores: [] }
    campaigns[t.campaign][t.agent].total++
    if (t.status === 'Done') campaigns[t.campaign][t.agent].done++
    if (scoreMap[t.name]) campaigns[t.campaign][t.agent].scores.push(scoreMap[t.name])
  })

  Object.entries(campaigns).forEach(([campaign, agentMap]) => {
    const agentNames = Object.keys(agentMap)
    if (agentNames.length >= 2) {
      campaignCollabs[campaign] = {
        campaign,
        agents: agentNames,
        agentCount: agentNames.length,
        agentStats: Object.entries(agentMap).map(([agent, data]) => ({
          agent,
          tasks: data.total,
          completed: data.done,
          avgScore: data.scores.length > 0
            ? Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10
            : null,
        })),
        totalTasks: Object.values(agentMap).reduce((s, d) => s + d.total, 0),
      }
    }
  })

  // Build collaboration pairs matrix
  const pairMatrix = {}
  Object.values(campaignCollabs).forEach(collab => {
    const agents = collab.agents
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const pair = [agents[i], agents[j]].sort().join('↔')
        if (!pairMatrix[pair]) pairMatrix[pair] = { agents: [agents[i], agents[j]].sort(), campaigns: [], taskCount: 0 }
        pairMatrix[pair].campaigns.push(collab.campaign)
        pairMatrix[pair].taskCount += collab.totalTasks
      }
    }
  })

  // Score each pair's synergy
  const pairs = Object.values(pairMatrix).map(p => {
    const [a1, a2] = p.agents
    const a1Tasks = tasks.filter(t => t.agent === a1 && t.status === 'Done')
    const a2Tasks = tasks.filter(t => t.agent === a2 && t.status === 'Done')
    const a1Scores = a1Tasks.map(t => scoreMap[t.name]).filter(Boolean)
    const a2Scores = a2Tasks.map(t => scoreMap[t.name]).filter(Boolean)

    // Shared campaign quality
    const sharedCampaignTasks = tasks.filter(t =>
      t.status === 'Done' &&
      p.campaigns.includes(t.campaign) &&
      [a1, a2].includes(t.agent)
    )
    const sharedScores = sharedCampaignTasks.map(t => scoreMap[t.name]).filter(Boolean)
    const sharedAvg = sharedScores.length > 0
      ? Math.round((sharedScores.reduce((a, b) => a + b, 0) / sharedScores.length) * 10) / 10
      : null
    const individualAvg = [...a1Scores, ...a2Scores].length > 0
      ? Math.round(([...a1Scores, ...a2Scores].reduce((a, b) => a + b, 0) / [...a1Scores, ...a2Scores].length) * 10) / 10
      : null

    return {
      pair: p.agents,
      campaigns: [...new Set(p.campaigns)],
      sharedCampaigns: [...new Set(p.campaigns)].length,
      sharedTasks: sharedCampaignTasks.length,
      sharedAvgScore: sharedAvg,
      individualAvgScore: individualAvg,
      synergyDelta: sharedAvg && individualAvg
        ? Math.round((sharedAvg - individualAvg) * 10) / 10
        : null,
    }
  }).sort((a, b) => (b.sharedCampaigns || 0) - (a.sharedCampaigns || 0))

  return {
    handoffs: Object.values(handoffs).sort((a, b) => b.count - a.count),
    revisionChains: Object.values(revisionChains).sort((a, b) => b.count - a.count),
    campaignCollabs: Object.values(campaignCollabs),
    collaborationPairs: pairs,
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentFilter = searchParams.get('agent')

    const [tasks, activity] = await Promise.all([
      getTasks({ noCache: true }),
      getAllActivity(),
    ])

    const result = analyzeCollaboration(tasks, activity)

    // Apply agent filter
    if (agentFilter) {
      result.handoffs = result.handoffs.filter(h => h.from === agentFilter || h.to === agentFilter)
      result.revisionChains = result.revisionChains.filter(r => r.from === agentFilter || r.to === agentFilter)
      result.campaignCollabs = result.campaignCollabs.filter(c => c.agents.includes(agentFilter))
      result.collaborationPairs = result.collaborationPairs.filter(p => p.pair.includes(agentFilter))
    }

    // Summary
    const uniqueCollaborators = new Set()
    result.collaborationPairs.forEach(p => p.pair.forEach(a => uniqueCollaborators.add(a)))

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      summary: {
        totalHandoffs: result.handoffs.reduce((s, h) => s + h.count, 0),
        totalRevisionCycles: result.revisionChains.reduce((s, r) => s + r.count, 0),
        multiAgentCampaigns: result.campaignCollabs.length,
        collaborationPairs: result.collaborationPairs.length,
        activeCollaborators: uniqueCollaborators.size,
        bestSynergy: result.collaborationPairs
          .filter(p => p.synergyDelta !== null)
          .sort((a, b) => (b.synergyDelta || 0) - (a.synergyDelta || 0))[0] || null,
      },
      handoffs: result.handoffs,
      revisionChains: result.revisionChains,
      campaignCollaboration: result.campaignCollabs,
      collaborationPairs: result.collaborationPairs,
    })
  } catch (err) {
    console.error('[COLLABORATION] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
