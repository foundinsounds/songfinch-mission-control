// Agent Performance Analytics — Deep per-agent metrics and comparison
// Returns: individual agent stats, rankings, quality breakdowns, workload analysis

import { NextResponse } from 'next/server'
import { getTasks, getAgents, getAllActivity } from '../../../../lib/airtable'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90)
    const agentFilter = searchParams.get('agent') // Optional: single agent deep-dive

    const [tasks, agents, activity] = await Promise.all([
      getTasks({ noCache: true }),
      getAgents({ noCache: true }),
      getAllActivity(),
    ])

    const now = Date.now()
    const cutoff = now - days * 86400000

    const recentActivity = activity.filter(a => new Date(a.timestamp).getTime() > cutoff)

    // Build per-agent metrics
    const agentMetrics = agents
      .filter(a => !agentFilter || a.name === agentFilter)
      .map(agent => {
        const agentTasks = tasks.filter(t => t.agent === agent.name)
        const agentActivity = recentActivity.filter(a => a.agent === agent.name)

        // Task breakdown
        const done = agentTasks.filter(t => t.status === 'Done')
        const active = agentTasks.filter(t => ['Assigned', 'In Progress'].includes(t.status))
        const review = agentTasks.filter(t => t.status === 'Review')

        // Quality scores from approvals
        const approvals = recentActivity.filter(a =>
          a.action === 'approved' && a.details &&
          (a.task && agentTasks.some(t => t.name === a.task))
        )

        const scores = approvals
          .map(a => {
            const match = a.details.match(/\((\d+\.?\d*)\/5\)/)
            return match ? parseFloat(match[1]) : null
          })
          .filter(Boolean)

        const avgScore = scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : null

        // Revision rate
        const revisions = recentActivity.filter(a =>
          a.action === 'revision requested' &&
          agentTasks.some(t => t.name === a.task)
        ).length

        const totalReviewed = approvals.length + revisions
        const approvalRate = totalReviewed > 0
          ? Math.round((approvals.length / totalReviewed) * 100)
          : null

        // Content type breakdown
        const contentTypes = {}
        done.forEach(t => {
          const ct = t.contentType || 'Unknown'
          contentTypes[ct] = (contentTypes[ct] || 0) + 1
        })

        // Output quality — average length as productivity proxy
        const avgOutputLength = done.length > 0
          ? Math.round(done.reduce((sum, t) => sum + (t.output?.length || 0), 0) / done.length)
          : 0

        // Activity timeline (last 7 days)
        const recentDays = {}
        for (let i = 0; i < 7; i++) {
          const d = new Date(now - i * 86400000).toISOString().split('T')[0]
          recentDays[d] = 0
        }
        agentActivity.forEach(a => {
          const d = new Date(a.timestamp).toISOString().split('T')[0]
          if (recentDays[d] !== undefined) recentDays[d]++
        })

        // Streak: consecutive days with activity
        let streak = 0
        for (let i = 0; i < 30; i++) {
          const d = new Date(now - i * 86400000).toISOString().split('T')[0]
          const dayActivity = agentActivity.filter(a =>
            new Date(a.timestamp).toISOString().split('T')[0] === d
          )
          if (dayActivity.length > 0) streak++
          else break
        }

        // Score distribution
        const scoreDistribution = { excellent: 0, good: 0, fair: 0, poor: 0 }
        scores.forEach(s => {
          if (s >= 4.5) scoreDistribution.excellent++
          else if (s >= 3.5) scoreDistribution.good++
          else if (s >= 2.5) scoreDistribution.fair++
          else scoreDistribution.poor++
        })

        return {
          name: agent.name,
          role: agent.role,
          emoji: agent.emoji,
          status: agent.status,
          model: agent.model,
          metrics: {
            tasksCompleted: done.length,
            tasksActive: active.length,
            tasksInReview: review.length,
            totalAssigned: agentTasks.length,
            avgQualityScore: avgScore,
            approvalRate,
            revisionCount: revisions,
            avgOutputLength,
            recentActivityCount: agentActivity.length,
            streak,
          },
          contentTypes,
          scoreDistribution,
          recentActivity: Object.entries(recentDays)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date)),
          topScores: scores.sort((a, b) => b - a).slice(0, 5),
          lastActive: agentActivity[0]?.timestamp || null,
        }
      })

    // Rankings
    const rankings = {
      byQuality: [...agentMetrics]
        .filter(a => a.metrics.avgQualityScore !== null)
        .sort((a, b) => b.metrics.avgQualityScore - a.metrics.avgQualityScore)
        .map(a => ({ agent: a.name, score: a.metrics.avgQualityScore })),
      byProductivity: [...agentMetrics]
        .sort((a, b) => b.metrics.tasksCompleted - a.metrics.tasksCompleted)
        .map(a => ({ agent: a.name, completed: a.metrics.tasksCompleted })),
      byApprovalRate: [...agentMetrics]
        .filter(a => a.metrics.approvalRate !== null)
        .sort((a, b) => b.metrics.approvalRate - a.metrics.approvalRate)
        .map(a => ({ agent: a.name, rate: a.metrics.approvalRate })),
      byStreak: [...agentMetrics]
        .sort((a, b) => b.metrics.streak - a.metrics.streak)
        .map(a => ({ agent: a.name, streak: a.metrics.streak })),
    }

    return NextResponse.json({
      period: `${days} days`,
      generatedAt: new Date().toISOString(),
      agents: agentMetrics,
      rankings,
      totalAgents: agentMetrics.length,
    })
  } catch (err) {
    console.error('[AGENT-ANALYTICS] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
