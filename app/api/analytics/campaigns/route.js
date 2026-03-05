// Campaign Performance & ROI Estimation — Tracks campaign effectiveness
// Measures: completion rates, quality scores, velocity, agent utilization per campaign
// Estimates ROI based on content output value vs agent processing costs

import { NextResponse } from 'next/server'
import { getTasks, getAllActivity, getGoals } from '../../../../lib/airtable'

export const dynamic = 'force-dynamic'

// Estimated value per content piece (used for ROI projections)
const CONTENT_VALUE = {
  'Blog Post': 150,
  'Social Media Post': 50,
  'Email Newsletter': 120,
  'Landing Page': 300,
  'Video Script': 200,
  'Ad Copy': 80,
  'Product Description': 60,
  'Case Study': 250,
  'Press Release': 180,
  'SEO Article': 175,
  default: 100,
}

// Estimated cost per AI agent task cycle
const COST_PER_TASK = 0.15 // average API cost per task execution
const COST_PER_REVISION = 0.08 // cost per revision cycle

function analyzeCampaign(campaignTasks, activity, campaignName) {
  const now = Date.now()
  const done = campaignTasks.filter(t => t.status === 'Done')
  const active = campaignTasks.filter(t => ['Assigned', 'In Progress'].includes(t.status))
  const review = campaignTasks.filter(t => t.status === 'Review')

  // Build score map from activity
  const scoreMap = {}
  const revisionMap = {}
  activity.forEach(a => {
    if (a.action === 'approved' && a.details) {
      const m = a.details.match(/\((\d+\.?\d*)\/5\)/)
      if (m) scoreMap[a.task] = parseFloat(m[1])
    }
    if (a.action === 'revised') {
      revisionMap[a.task] = (revisionMap[a.task] || 0) + 1
    }
  })

  // Quality metrics
  const scores = done.map(t => scoreMap[t.name]).filter(Boolean)
  const avgScore = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null
  const approvalRate = done.length > 0
    ? Math.round((scores.filter(s => s >= 3.5).length / done.length) * 100)
    : null

  // Velocity — tasks completed per day since campaign started
  const timestamps = campaignTasks
    .map(t => t.createdAt ? new Date(t.createdAt).getTime() : 0)
    .filter(t => t > 0)
  const campaignStart = timestamps.length > 0 ? Math.min(...timestamps) : now
  const daysSinceStart = Math.max(1, (now - campaignStart) / 86400000)
  const velocity = Math.round((done.length / daysSinceStart) * 10) / 10

  // Agent distribution
  const agentBreakdown = {}
  campaignTasks.forEach(t => {
    if (!t.agent) return
    if (!agentBreakdown[t.agent]) agentBreakdown[t.agent] = { total: 0, done: 0, scores: [] }
    agentBreakdown[t.agent].total++
    if (t.status === 'Done') agentBreakdown[t.agent].done++
    if (scoreMap[t.name]) agentBreakdown[t.agent].scores.push(scoreMap[t.name])
  })

  const agentStats = Object.entries(agentBreakdown).map(([agent, data]) => ({
    agent,
    tasks: data.total,
    completed: data.done,
    avgScore: data.scores.length > 0
      ? Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10
      : null,
    completionRate: data.total > 0 ? Math.round((data.done / data.total) * 100) : 0,
  })).sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0))

  // Content type breakdown
  const contentBreakdown = {}
  campaignTasks.forEach(t => {
    const ct = t.contentType || 'Unknown'
    if (!contentBreakdown[ct]) contentBreakdown[ct] = { total: 0, done: 0, scores: [] }
    contentBreakdown[ct].total++
    if (t.status === 'Done') contentBreakdown[ct].done++
    if (scoreMap[t.name]) contentBreakdown[ct].scores.push(scoreMap[t.name])
  })

  const contentStats = Object.entries(contentBreakdown).map(([type, data]) => ({
    contentType: type,
    tasks: data.total,
    completed: data.done,
    avgScore: data.scores.length > 0
      ? Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10
      : null,
  }))

  // ROI estimation
  const totalRevisions = Object.values(revisionMap).reduce((s, v) => s + v, 0)
  const estimatedCost = (campaignTasks.length * COST_PER_TASK) + (totalRevisions * COST_PER_REVISION)
  const estimatedValue = done.reduce((sum, t) => {
    const ct = t.contentType || 'default'
    return sum + (CONTENT_VALUE[ct] || CONTENT_VALUE.default)
  }, 0)
  const roi = estimatedCost > 0
    ? Math.round(((estimatedValue - estimatedCost) / estimatedCost) * 100)
    : null

  // Completion timeline
  const completionRate = campaignTasks.length > 0
    ? Math.round((done.length / campaignTasks.length) * 100)
    : 0
  const estimatedDaysToComplete = velocity > 0 && active.length + review.length > 0
    ? Math.round((active.length + review.length) / velocity)
    : null

  return {
    campaign: campaignName,
    overview: {
      totalTasks: campaignTasks.length,
      completed: done.length,
      active: active.length,
      inReview: review.length,
      completionRate,
      daysSinceStart: Math.round(daysSinceStart),
      velocity,
      estimatedDaysToComplete,
    },
    quality: {
      avgScore,
      approvalRate,
      totalRevisions,
      scoresDistribution: {
        excellent: scores.filter(s => s >= 4.5).length,
        good: scores.filter(s => s >= 3.5 && s < 4.5).length,
        needsWork: scores.filter(s => s < 3.5).length,
      },
    },
    roi: {
      estimatedContentValue: Math.round(estimatedValue),
      estimatedProcessingCost: Math.round(estimatedCost * 100) / 100,
      estimatedROI: roi,
      roiLabel: roi !== null ? `${roi}%` : 'N/A',
      valuePerTask: done.length > 0 ? Math.round(estimatedValue / done.length) : 0,
    },
    agents: agentStats,
    contentTypes: contentStats,
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignFilter = searchParams.get('campaign')

    const [tasks, activity, goals] = await Promise.all([
      getTasks({ noCache: true }),
      getAllActivity(),
      getGoals({ noCache: true }),
    ])

    // Group tasks by campaign
    const campaigns = {}
    tasks.forEach(t => {
      const camp = t.campaign || 'Uncategorized'
      if (!campaigns[camp]) campaigns[camp] = []
      campaigns[camp].push(t)
    })

    // Analyze each campaign
    let results = Object.entries(campaigns)
      .filter(([name]) => name !== 'Uncategorized' || Object.keys(campaigns).length === 1)
      .map(([name, campTasks]) => analyzeCampaign(campTasks, activity, name))
      .sort((a, b) => b.overview.totalTasks - a.overview.totalTasks)

    if (campaignFilter) {
      results = results.filter(r =>
        r.campaign.toLowerCase().includes(campaignFilter.toLowerCase())
      )
    }

    // Cross-campaign comparison
    const crossCampaign = {
      totalCampaigns: results.length,
      totalTasks: results.reduce((s, r) => s + r.overview.totalTasks, 0),
      totalCompleted: results.reduce((s, r) => s + r.overview.completed, 0),
      avgCompletionRate: results.length > 0
        ? Math.round(results.reduce((s, r) => s + r.overview.completionRate, 0) / results.length)
        : 0,
      avgQuality: results.filter(r => r.quality.avgScore).length > 0
        ? Math.round((results.filter(r => r.quality.avgScore).reduce((s, r) => s + r.quality.avgScore, 0) /
          results.filter(r => r.quality.avgScore).length) * 10) / 10
        : null,
      totalEstimatedValue: results.reduce((s, r) => s + r.roi.estimatedContentValue, 0),
      totalEstimatedCost: Math.round(results.reduce((s, r) => s + r.roi.estimatedProcessingCost, 0) * 100) / 100,
      bestCampaign: results.length > 0
        ? results.reduce((best, r) => (r.quality.avgScore || 0) > (best.quality.avgScore || 0) ? r : best).campaign
        : null,
      fastestCampaign: results.length > 0
        ? results.reduce((fast, r) => r.overview.velocity > fast.overview.velocity ? r : fast).campaign
        : null,
    }

    // Active goals tied to campaigns
    const campaignGoals = goals
      .filter(g => g.campaign && g.status === 'Active')
      .map(g => ({
        name: g.name,
        campaign: g.campaign,
        frequency: g.frequency,
        tasksGenerated: g.tasksGenerated,
      }))

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      summary: crossCampaign,
      campaigns: results,
      activeGoals: campaignGoals,
    })
  } catch (err) {
    console.error('[CAMPAIGNS] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
