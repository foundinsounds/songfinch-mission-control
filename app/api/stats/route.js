// Enhanced Stats API — velocity, quality, territory coverage, agent performance
// Computes real-time analytics from Airtable data for the dashboard

import { getTasks, getAgents, getActivityFeed } from '../../../lib/airtable'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [tasks, agents, activity] = await Promise.all([
      getTasks({ noCache: true }),
      getAgents({ noCache: true }),
      getActivityFeed(),
    ])

    const now = new Date()

    // ── VELOCITY METRICS ──────────────────────────────
    const doneTasks = tasks.filter(t => t.status === 'Done')
    const createdDates = tasks.map(t => t.createdAt).filter(Boolean).sort()
    const firstTaskDate = createdDates.length > 0 ? new Date(createdDates[0]) : now
    const daysActive = Math.max(1, Math.ceil((now - firstTaskDate) / (1000 * 60 * 60 * 24)))

    // Daily velocity (tasks completed / days active)
    const velocityPerDay = daysActive > 0 ? (doneTasks.length / daysActive).toFixed(1) : 0

    // Weekly velocity
    const velocityPerWeek = daysActive > 0 ? ((doneTasks.length / daysActive) * 7).toFixed(1) : 0

    // Tasks created in last 7 days
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
    const createdThisWeek = tasks.filter(t => t.createdAt && new Date(t.createdAt) >= weekAgo).length
    // Use completedAt if available, fall back to createdAt for legacy tasks
    const completedThisWeek = doneTasks.filter(t => {
      const ts = t.completedAt || t.createdAt
      return ts && new Date(ts) >= weekAgo
    }).length

    // Per-24h velocity (tasks completed in last 24 hours)
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000)
    const completedLast24h = doneTasks.filter(t => {
      const ts = t.completedAt || t.createdAt
      return ts && new Date(ts) >= dayAgo
    }).length

    // Pipeline throughput — tasks moving from Inbox to Done
    const pipelineStages = {
      inbox: tasks.filter(t => t.status === 'Inbox').length,
      assigned: tasks.filter(t => t.status === 'Assigned').length,
      inProgress: tasks.filter(t => t.status === 'In Progress').length,
      review: tasks.filter(t => t.status === 'Review').length,
      done: doneTasks.length,
    }
    const activePipeline = pipelineStages.assigned + pipelineStages.inProgress + pipelineStages.review

    // ── QUALITY METRICS ──────────────────────────────
    // Parse quality scores from activity feed (CHIEF reviews include scores)
    const reviewActivities = activity.filter(a =>
      a.agent === 'CHIEF' && (a.action === 'reviewed' || a.action === 'auto-reviewed' || a.details?.includes('Score:'))
    )

    const qualityScores = []
    const revisionTasks = []

    reviewActivities.forEach(a => {
      // Extract score from details like "Score: 3.8/5" or "scored 4.2"
      const scoreMatch = a.details?.match(/(?:Score|scored)[:\s]*(\d+\.?\d*)/i)
      if (scoreMatch) {
        qualityScores.push({
          score: parseFloat(scoreMatch[1]),
          task: a.task,
          agent: a.agent,
        })
      }
      // Check for revisions
      if (a.details?.includes('revision') || a.details?.includes('Sent back') || a.action === 'requested revision') {
        revisionTasks.push(a.task)
      }
    })

    const avgQualityScore = qualityScores.length > 0
      ? (qualityScores.reduce((sum, q) => sum + q.score, 0) / qualityScores.length).toFixed(1)
      : null

    // Revision rate
    const tasksReviewed = new Set(reviewActivities.map(a => a.task)).size
    const revisionRate = tasksReviewed > 0
      ? Math.round((revisionTasks.length / tasksReviewed) * 100)
      : 0

    // ── TERRITORY COVERAGE ────────────────────────────
    const territories = { Celebration: 0, Gratitude: 0, Memory: 0, Identity: 0, Tribute: 0 }
    const territoryDone = { Celebration: 0, Gratitude: 0, Memory: 0, Identity: 0, Tribute: 0 }

    tasks.forEach(t => {
      // Extract territory from description metadata
      const territoryMatch = t.description?.match(/Territory:\s*(Celebration|Gratitude|Memory|Identity|Tribute)/i)
      if (territoryMatch) {
        const terr = territoryMatch[1]
        territories[terr] = (territories[terr] || 0) + 1
        if (t.status === 'Done') {
          territoryDone[terr] = (territoryDone[terr] || 0) + 1
        }
      }
    })

    const totalTerritoryTasks = Object.values(territories).reduce((a, b) => a + b, 0)
    const territoryCoverage = Object.entries(territories).map(([name, count]) => ({
      name,
      total: count,
      done: territoryDone[name] || 0,
      percentage: totalTerritoryTasks > 0 ? Math.round((count / totalTerritoryTasks) * 100) : 0,
    }))

    // ── AGENT PERFORMANCE ─────────────────────────────
    const agentPerformance = agents.map(agent => {
      const agentTasks = tasks.filter(t => t.agent === agent.name)
      const agentDone = agentTasks.filter(t => t.status === 'Done')
      const agentReview = agentTasks.filter(t => t.status === 'Review')
      const agentActive = agentTasks.filter(t => t.status === 'In Progress' || t.status === 'Assigned')

      // Agent's quality scores from reviews
      const agentScores = qualityScores.filter(q =>
        agentTasks.some(t => t.name === q.task)
      )
      const agentAvgScore = agentScores.length > 0
        ? (agentScores.reduce((sum, q) => sum + q.score, 0) / agentScores.length).toFixed(1)
        : null

      // Output volume (total chars of completed content)
      const outputVolume = agentDone
        .filter(t => t.output)
        .reduce((sum, t) => sum + t.output.length, 0)

      // Content types this agent works on
      const contentTypes = [...new Set(agentTasks.map(t => t.contentType).filter(Boolean))]

      return {
        name: agent.name,
        emoji: agent.emoji,
        role: agent.role,
        status: agent.status,
        model: agent.model,
        totalTasks: agentTasks.length,
        completed: agentDone.length,
        inReview: agentReview.length,
        active: agentActive.length,
        completionRate: agentTasks.length > 0
          ? Math.round((agentDone.length / agentTasks.length) * 100)
          : 0,
        avgQualityScore: agentAvgScore,
        outputVolume,
        contentTypes,
      }
    }).sort((a, b) => b.completed - a.completed)

    // ── CONTENT MIX ───────────────────────────────────
    const contentTypes = {}
    tasks.forEach(t => {
      const ct = t.contentType || 'General'
      if (!contentTypes[ct]) contentTypes[ct] = { total: 0, done: 0, inProgress: 0 }
      contentTypes[ct].total++
      if (t.status === 'Done') contentTypes[ct].done++
      if (t.status === 'In Progress') contentTypes[ct].inProgress++
    })

    // ── PLATFORM DISTRIBUTION ─────────────────────────
    const platforms = {}
    tasks.forEach(t => {
      const plats = Array.isArray(t.platform) ? t.platform : (t.platform ? [t.platform] : [])
      plats.forEach(p => {
        if (!platforms[p]) platforms[p] = { total: 0, done: 0 }
        platforms[p].total++
        if (t.status === 'Done') platforms[p].done++
      })
    })

    // ── CAMPAIGN HEALTH ───────────────────────────────
    const campaigns = {}
    tasks.forEach(t => {
      const c = t.campaign || 'Uncategorized'
      if (!campaigns[c]) campaigns[c] = { total: 0, done: 0, review: 0, active: 0 }
      campaigns[c].total++
      if (t.status === 'Done') campaigns[c].done++
      if (t.status === 'Review') campaigns[c].review++
      if (t.status === 'In Progress' || t.status === 'Assigned') campaigns[c].active++
    })

    // ── VISUAL ASSETS ────────────────────────────────
    const imageActivities = activity.filter(a =>
      a.action === 'generated image' || a.action === 'auto-generated image'
    )
    const imageTasks = tasks.filter(t => t.contentType === 'Image')
    const visualAssets = {
      generated: imageActivities.length,
      imageTasks: imageTasks.length,
      imageTasksDone: imageTasks.filter(t => t.status === 'Done').length,
    }

    // ── CONTENT CALENDAR ────────────────────────────
    const scheduledTasks = tasks
      .filter(t => t.scheduledDate && t.status !== 'Done')
      .map(t => ({
        name: t.name,
        date: t.scheduledDate,
        contentType: t.contentType,
        agent: t.agent,
        status: t.status,
        platform: t.platform,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // ── RESPONSE ──────────────────────────────────────
    return NextResponse.json({
      velocity: {
        perDay: parseFloat(velocityPerDay),
        perWeek: parseFloat(velocityPerWeek),
        per24h: completedLast24h,
        createdThisWeek,
        completedThisWeek,
        daysActive,
      },
      quality: {
        avgScore: avgQualityScore ? parseFloat(avgQualityScore) : null,
        totalReviewed: tasksReviewed,
        revisionRate,
        scores: qualityScores.slice(0, 20),
      },
      pipeline: pipelineStages,
      activePipeline,
      territoryCoverage,
      agentPerformance,
      contentTypes,
      platforms,
      campaigns,
      visualAssets,
      calendar: scheduledTasks.slice(0, 30),
      totals: {
        tasks: tasks.length,
        done: doneTasks.length,
        agents: agents.length,
        agentsActive: agents.filter(a => a.status === 'Working' || a.status === 'Active').length,
        imagesGenerated: imageActivities.length,
      },
    })
  } catch (err) {
    console.error('[STATS] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
