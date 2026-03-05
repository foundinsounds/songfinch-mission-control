// Agent Skill Specialization — Tracks quality by content type per agent
// Powers intelligent routing: tasks go to agents with proven skill
// Also exposes data for dashboard skill-matrix visualization

import { NextResponse } from 'next/server'
import { getTasks, getAgents, getAllActivity } from '../../../../lib/airtable'

export const dynamic = 'force-dynamic'

// Build specialization profiles from historical performance
function buildSpecializations(tasks, agents, activity) {
  const profiles = {}

  agents.forEach(a => {
    profiles[a.name] = {
      agent: a.name,
      role: a.role,
      specializations: {},
      totalReviewed: 0,
      overallAvg: null,
    }
  })

  // Cross-reference: approved/revised tasks → agent + contentType → quality score
  const scoredEvents = activity.filter(a =>
    (a.action === 'approved' || a.action === 'revision requested') && a.details
  )

  scoredEvents.forEach(event => {
    // Find the task to get content type and agent
    const task = tasks.find(t => t.name === event.task)
    if (!task || !task.agent || !profiles[task.agent]) return

    const contentType = task.contentType || 'General'
    const agent = task.agent

    // Extract score from details
    const scoreMatch = event.details.match(/\((\d+\.?\d*)\/5\)/)
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : null
    const wasApproved = event.action === 'approved'

    if (!profiles[agent].specializations[contentType]) {
      profiles[agent].specializations[contentType] = {
        contentType,
        reviews: 0,
        approvals: 0,
        revisions: 0,
        scores: [],
        avgScore: null,
        approvalRate: null,
        skill: 'unknown', // will compute below
      }
    }

    const spec = profiles[agent].specializations[contentType]
    spec.reviews++
    if (wasApproved) spec.approvals++
    else spec.revisions++
    if (score) spec.scores.push(score)
  })

  // Compute derived metrics for each specialization
  Object.values(profiles).forEach(profile => {
    let allScores = []

    Object.values(profile.specializations).forEach(spec => {
      if (spec.scores.length > 0) {
        spec.avgScore = Math.round((spec.scores.reduce((a, b) => a + b, 0) / spec.scores.length) * 10) / 10
        allScores = allScores.concat(spec.scores)
      }
      spec.approvalRate = spec.reviews > 0
        ? Math.round((spec.approvals / spec.reviews) * 100)
        : null

      // Skill rating: based on avg score + approval rate + volume
      spec.skill = computeSkillRating(spec)

      // Clean up raw scores array from response
      delete spec.scores
    })

    profile.totalReviewed = allScores.length
    profile.overallAvg = allScores.length > 0
      ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
      : null
  })

  return profiles
}

// Skill rating: combines quality, consistency, and volume
function computeSkillRating(spec) {
  if (spec.reviews < 2) return 'developing' // Not enough data
  if (spec.avgScore >= 4.5 && spec.approvalRate >= 90) return 'expert'
  if (spec.avgScore >= 4.0 && spec.approvalRate >= 75) return 'proficient'
  if (spec.avgScore >= 3.5 && spec.approvalRate >= 60) return 'competent'
  if (spec.avgScore >= 3.0) return 'developing'
  return 'needs_training'
}

// Skill matrix: which agents are best at which content types
function buildSkillMatrix(profiles) {
  const contentTypes = new Set()
  Object.values(profiles).forEach(p => {
    Object.keys(p.specializations).forEach(ct => contentTypes.add(ct))
  })

  const matrix = {}
  contentTypes.forEach(ct => {
    const agentScores = Object.values(profiles)
      .filter(p => p.specializations[ct]?.avgScore)
      .map(p => ({
        agent: p.agent,
        avgScore: p.specializations[ct].avgScore,
        approvalRate: p.specializations[ct].approvalRate,
        reviews: p.specializations[ct].reviews,
        skill: p.specializations[ct].skill,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)

    matrix[ct] = {
      bestAgent: agentScores[0]?.agent || null,
      rankings: agentScores,
    }
  })

  return matrix
}

// Routing recommendations — what should AGENT_ROUTING look like based on data
function buildRoutingRecommendations(matrix) {
  const recommendations = {}

  Object.entries(matrix).forEach(([ct, data]) => {
    if (!data.bestAgent) return

    const best = data.rankings[0]
    if (best.reviews >= 3 && best.avgScore >= 3.5) {
      recommendations[ct] = {
        recommended: best.agent,
        score: best.avgScore,
        confidence: best.reviews >= 10 ? 'high' : best.reviews >= 5 ? 'medium' : 'low',
        runner_up: data.rankings[1]?.agent || null,
      }
    }
  })

  return recommendations
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentFilter = searchParams.get('agent')
    const contentTypeFilter = searchParams.get('type')

    const [tasks, agents, activity] = await Promise.all([
      getTasks({ noCache: true }),
      getAgents({ noCache: true }),
      getAllActivity(),
    ])

    const profiles = buildSpecializations(tasks, agents, activity)
    const matrix = buildSkillMatrix(profiles)
    const recommendations = buildRoutingRecommendations(matrix)

    // Apply filters
    let filteredProfiles = Object.values(profiles)
    if (agentFilter) {
      filteredProfiles = filteredProfiles.filter(p => p.agent === agentFilter)
    }

    // If content type filter, only show agents with that specialization
    if (contentTypeFilter) {
      filteredProfiles = filteredProfiles
        .filter(p => p.specializations[contentTypeFilter])
        .map(p => ({
          ...p,
          specializations: { [contentTypeFilter]: p.specializations[contentTypeFilter] },
        }))
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      profiles: filteredProfiles,
      skillMatrix: contentTypeFilter ? { [contentTypeFilter]: matrix[contentTypeFilter] } : matrix,
      routingRecommendations: recommendations,
      contentTypes: [...new Set(tasks.map(t => t.contentType || 'General'))],
    })
  } catch (err) {
    console.error('[SPECIALIZATIONS] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
