// Campaign Analytics Summary — aggregated metrics across the system
// Provides: task throughput, agent productivity, campaign performance, content pipeline health

import { NextResponse } from 'next/server'
import { getTasks, getAgents, getContentLibrary, getAllActivity } from '../../../lib/airtable'

export const dynamic = 'force-dynamic'

function calculateTrend(recent, older) {
  if (older === 0) return recent > 0 ? 'up' : 'stable'
  const change = ((recent - older) / older) * 100
  if (change > 10) return 'up'
  if (change < -10) return 'down'
  return 'stable'
}

function timeAgo(dateStr) {
  if (!dateStr) return null
  const ms = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(ms / (1000 * 60 * 60))
  if (hours < 1) return `${Math.floor(ms / (1000 * 60))}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7' // days
    const periodDays = parseInt(period, 10)

    // Fetch all data in parallel
    const [tasks, agents, content, activity] = await Promise.all([
      getTasks({ noCache: true }),
      getAgents({ noCache: true }),
      getContentLibrary(),
      getAllActivity(),
    ])

    const now = Date.now()
    const periodMs = periodDays * 24 * 60 * 60 * 1000
    const halfPeriodMs = periodMs / 2

    // ---- PIPELINE HEALTH ----
    const pipeline = {
      total: tasks.length,
      inbox: tasks.filter(t => t.status === 'Inbox').length,
      assigned: tasks.filter(t => t.status === 'Assigned').length,
      inProgress: tasks.filter(t => t.status === 'In Progress').length,
      review: tasks.filter(t => t.status === 'Review').length,
      done: tasks.filter(t => t.status === 'Done').length,
      bottleneck: null,
    }
    // Detect bottleneck: where are tasks piling up?
    const stages = [
      { name: 'Inbox', count: pipeline.inbox },
      { name: 'Review', count: pipeline.review },
      { name: 'Assigned', count: pipeline.assigned },
    ]
    stages.sort((a, b) => b.count - a.count)
    if (stages[0].count > 3) {
      pipeline.bottleneck = { stage: stages[0].name, count: stages[0].count }
    }

    // ---- AGENT PRODUCTIVITY ----
    const agentStats = agents.map(agent => {
      const agentTasks = tasks.filter(t => t.agent === agent.name)
      const doneTasks = agentTasks.filter(t => t.status === 'Done')
      const activeTasks = agentTasks.filter(t => t.status !== 'Done')
      const agentActivity = activity.filter(a => a.agent === agent.name)

      // Recent activity count
      const recentActivity = agentActivity.filter(a =>
        (now - new Date(a.timestamp).getTime()) < periodMs
      ).length

      const olderActivity = agentActivity.filter(a => {
        const age = now - new Date(a.timestamp).getTime()
        return age >= periodMs && age < periodMs * 2
      }).length

      return {
        name: agent.name,
        role: agent.role,
        emoji: agent.emoji,
        status: agent.status,
        model: agent.model,
        tasksCompleted: doneTasks.length,
        tasksActive: activeTasks.length,
        recentActivity,
        trend: calculateTrend(recentActivity, olderActivity),
        avgOutputLength: doneTasks.length > 0
          ? Math.round(doneTasks.reduce((sum, t) => sum + (t.output?.length || 0), 0) / doneTasks.length)
          : 0,
        lastActive: agentActivity.length > 0 ? timeAgo(agentActivity[0]?.timestamp) : 'Never',
      }
    }).sort((a, b) => b.tasksCompleted - a.tasksCompleted)

    // ---- CONTENT METRICS ----
    const contentByType = {}
    const contentByStatus = {}
    const contentByCampaign = {}

    content.forEach(c => {
      const type = c.contentType || 'Unknown'
      const status = c.status || 'Draft'
      const campaign = c.campaign || 'Untagged'

      contentByType[type] = (contentByType[type] || 0) + 1
      contentByStatus[status] = (contentByStatus[status] || 0) + 1
      contentByCampaign[campaign] = (contentByCampaign[campaign] || 0) + 1
    })

    // ---- THROUGHPUT ----
    // Tasks completed recently vs. previous period
    const recentCompletions = activity.filter(a =>
      a.action === 'completed' && (now - new Date(a.timestamp).getTime()) < periodMs
    ).length

    const olderCompletions = activity.filter(a => {
      const age = now - new Date(a.timestamp).getTime()
      return a.action === 'completed' && age >= periodMs && age < periodMs * 2
    }).length

    const throughput = {
      current: recentCompletions,
      previous: olderCompletions,
      trend: calculateTrend(recentCompletions, olderCompletions),
      dailyAvg: Math.round((recentCompletions / periodDays) * 10) / 10,
      projectedMonthly: Math.round((recentCompletions / periodDays) * 30),
    }

    // ---- CAMPAIGN BREAKDOWN ----
    const campaigns = {}
    tasks.forEach(t => {
      const camp = t.campaign || 'Uncategorized'
      if (!campaigns[camp]) campaigns[camp] = { total: 0, done: 0, active: 0, review: 0 }
      campaigns[camp].total++
      if (t.status === 'Done') campaigns[camp].done++
      else if (t.status === 'Review') campaigns[camp].review++
      else campaigns[camp].active++
    })

    const campaignSummary = Object.entries(campaigns)
      .map(([name, data]) => ({
        name,
        ...data,
        completionRate: data.total > 0 ? Math.round((data.done / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)

    // ---- ACTIVITY TIMELINE ----
    // Group activity by day for the period
    const timeline = {}
    activity.forEach(a => {
      const age = now - new Date(a.timestamp).getTime()
      if (age > periodMs) return
      const day = new Date(a.timestamp).toISOString().split('T')[0]
      if (!timeline[day]) timeline[day] = { completions: 0, assignments: 0, reviews: 0, errors: 0 }
      if (a.action === 'completed') timeline[day].completions++
      else if (a.action === 'auto-assigned') timeline[day].assignments++
      else if (a.action === 'auto-reviewed' || a.action === 'approved') timeline[day].reviews++
      else if (a.action === 'error') timeline[day].errors++
    })

    return NextResponse.json({
      period: `${periodDays} days`,
      generatedAt: new Date().toISOString(),
      pipeline,
      throughput,
      agents: agentStats,
      content: {
        total: content.length,
        byType: contentByType,
        byStatus: contentByStatus,
        byCampaign: contentByCampaign,
      },
      campaigns: campaignSummary,
      timeline: Object.entries(timeline)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    })
  } catch (err) {
    console.error('[ANALYTICS] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
