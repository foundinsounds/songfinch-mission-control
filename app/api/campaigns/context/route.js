// Campaign Context API — exposes campaign-level intelligence
// Used by dashboard and agents to get campaign status, squad recommendations,
// context threads, and content gap analysis for any campaign or all campaigns.
//
// GET /api/campaigns/context           → all campaigns board + overview
// GET /api/campaigns/context?name=X    → deep context for campaign X

import { getTasks, getAgents, getAllActivity, getTasksByCampaign, getCampaignNames, getContentByCampaign } from '../../../../lib/airtable'
import {
  getCampaignBoard,
  buildCampaignContext,
  recommendSquad,
  suggestContentGaps,
  shouldCMOPlan,
  SQUAD_TEMPLATES,
} from '../../../../lib/orchestration'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function safeFetch(fn, label) {
  try {
    return await fn()
  } catch (err) {
    console.warn(`[campaigns/context] ${label} failed: ${err.message}`)
    return null
  }
}

export async function GET(request) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const campaignName = searchParams.get('name')

    // ── SINGLE CAMPAIGN DEEP DIVE ──
    if (campaignName) {
      const [campaignTasks, activity, content] = await Promise.all([
        getTasksByCampaign(campaignName, { noCache: true }).catch(() => []),
        getAllActivity().catch(() => []),
        getContentByCampaign(campaignName).catch(() => []),
      ])

      if (campaignTasks.length === 0) {
        return NextResponse.json({
          error: `Campaign "${campaignName}" not found or has no tasks`,
        }, { status: 404 })
      }

      // Build deep campaign context
      const context = buildCampaignContext(campaignName, campaignTasks, activity)

      // Recommend squad based on content types in this campaign
      const contentTypes = [...new Set(campaignTasks.map(t => t.contentType).filter(Boolean))]
      const squad = recommendSquad(contentTypes)

      // Task breakdown by status
      const byStatus = {}
      for (const task of campaignTasks) {
        const s = task.status || 'Unknown'
        if (!byStatus[s]) byStatus[s] = []
        byStatus[s].push({
          id: task.id,
          name: task.name,
          agent: task.agent,
          contentType: task.contentType,
          priority: task.priority,
        })
      }

      // Agent involvement
      const agentBreakdown = {}
      for (const task of campaignTasks) {
        const agent = task.agent || 'Unassigned'
        if (!agentBreakdown[agent]) agentBreakdown[agent] = { total: 0, done: 0, active: 0 }
        agentBreakdown[agent].total++
        if (task.status === 'Done') agentBreakdown[agent].done++
        else agentBreakdown[agent].active++
      }

      return NextResponse.json({
        campaign: campaignName,
        status: context.status,
        progress: {
          total: context.totalTasks,
          completed: context.completedTasks,
          percent: context.totalTasks > 0
            ? Math.round((context.completedTasks / context.totalTasks) * 100)
            : 0,
        },
        strategicBrief: context.strategicBrief,
        creativeDirection: context.creativeDirection,
        squad: {
          recommended: squad.name,
          agents: squad.agents,
          description: squad.description,
        },
        tasksByStatus: byStatus,
        agentBreakdown,
        contentTypes,
        contentLibrary: content.length,
        handoffs: context.handoffs,
        pendingAgents: context.pendingAgents,
        completedWork: context.completedWork.map(w => ({
          agent: w.agent,
          contentType: w.contentType,
          taskName: w.taskName,
        })),
        duration: `${Date.now() - startTime}ms`,
      })
    }

    // ── ALL CAMPAIGNS OVERVIEW ──
    const [tasks, activity] = await Promise.all([
      safeFetch(() => getTasks({ noCache: true }), 'tasks'),
      safeFetch(() => getAllActivity(), 'activity'),
    ])

    if (!tasks) {
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }

    // Campaign board — status for every campaign
    const board = getCampaignBoard(tasks)

    // Pipeline health
    const pipelineNeedsPlanning = shouldCMOPlan(tasks)
    const contentGaps = suggestContentGaps(tasks, activity || [])

    // Campaign summary sorted by activity (most active first)
    const campaigns = Object.values(board)
      .filter(c => c.name !== 'Uncategorized')
      .sort((a, b) => {
        // Active campaigns first, then by progress
        const statusOrder = { 'In Production': 0, 'In Review': 1, 'Revision': 2, 'Queued': 3, 'Done': 4 }
        const sa = statusOrder[a.status] ?? 5
        const sb = statusOrder[b.status] ?? 5
        if (sa !== sb) return sa - sb
        return b.taskCount - a.taskCount
      })
      .map(c => ({
        name: c.name,
        status: c.status,
        taskCount: c.taskCount,
        completedCount: c.completedCount,
        progress: c.progress,
        agents: [...new Set(c.tasks.map(t => t.agent).filter(Boolean))],
        contentTypes: [...new Set(c.tasks.map(t => t.contentType).filter(Boolean))],
      }))

    // Uncategorized tasks
    const uncategorized = board['Uncategorized']

    return NextResponse.json({
      campaigns,
      uncategorized: uncategorized ? {
        taskCount: uncategorized.taskCount,
        completedCount: uncategorized.completedCount,
      } : null,
      pipeline: {
        needsPlanning: pipelineNeedsPlanning,
        contentGaps,
        totalTasks: tasks.length,
        activeTasks: tasks.filter(t => t.status !== 'Done').length,
      },
      squads: Object.entries(SQUAD_TEMPLATES).map(([key, squad]) => ({
        key,
        name: squad.name,
        agents: squad.agents,
        use: squad.use,
      })),
      timestamp: new Date().toISOString(),
      duration: `${Date.now() - startTime}ms`,
    })

  } catch (err) {
    console.error('[campaigns/context] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
