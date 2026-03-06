// Pipeline Execution History — Logs and retrieves pipeline run history
// GET: Returns recent execution history from activity feed
// POST: Logs a new pipeline execution event

import { NextResponse } from 'next/server'
import { getAllActivity, addActivity } from '../../../../lib/airtable'
import { safeJsonParse } from '../../../../lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const type = searchParams.get('type') // 'cron' | 'manual' | 'review' | all

    const activity = await getAllActivity()

    // Filter to pipeline-related events
    const pipelineActions = new Set([
      'cron cycle', 'review cycle', 'auto-assigned', 'auto-planned',
      'manual_trigger', 'pipeline_error', 'stall_recovery',
      'auto-refill', 'aggressive_planning',
    ])

    let pipelineEvents = activity.filter(a => {
      // Match by action or by agent being system-level
      const isPipelineAction = pipelineActions.has(a.action)
      const isSystemAgent = ['CHIEF', 'CMO', 'SYSTEM'].includes(a.agent)
      const isCronTask = a.task === 'Cron Cycle' || a.task === 'Auto-Review' || a.task === 'Pipeline'
      return isPipelineAction || (isSystemAgent && isCronTask)
    })

    // Optional type filter
    if (type) {
      const typeMap = {
        cron: ['cron cycle'],
        manual: ['manual_trigger'],
        review: ['review cycle', 'approved', 'revision requested'],
        error: ['pipeline_error', 'error'],
      }
      const matchActions = typeMap[type]
      if (matchActions) {
        pipelineEvents = pipelineEvents.filter(a => matchActions.includes(a.action))
      }
    }

    // Limit results
    const events = pipelineEvents.slice(0, limit).map(a => ({
      id: a.id,
      timestamp: a.timestamp,
      action: a.action,
      agent: a.agent,
      task: a.task,
      details: a.details?.substring(0, 500),
      type: a.type,
    }))

    // Compute summary stats
    const now = Date.now()
    const last24h = events.filter(e => (now - new Date(e.timestamp).getTime()) < 86400000)
    const lastHour = events.filter(e => (now - new Date(e.timestamp).getTime()) < 3600000)

    return NextResponse.json({
      events,
      total: events.length,
      summary: {
        last24h: last24h.length,
        lastHour: lastHour.length,
        lastRun: events[0]?.timestamp || null,
        lastAction: events[0]?.action || null,
      },
    })
  } catch (err) {
    console.error('[HISTORY] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { data: body, error: parseErr } = await safeJsonParse(request)
    if (parseErr) return parseErr
    const { type, mode, agent, results, durationMs, error } = body

    await addActivity({
      'Agent': agent || 'SYSTEM',
      'Action': type || 'pipeline_event',
      'Task': 'Pipeline',
      'Details': JSON.stringify({
        mode,
        results: results ? {
          approved: results.review?.results?.approved?.length,
          revised: results.review?.results?.revised?.length,
          planned: results.plan?.planned,
          processed: results.process?.processed,
          error: error,
        } : null,
        durationMs,
      }).substring(0, 5000),
      'Type': 'Comment',
    })

    return NextResponse.json({ logged: true })
  } catch (err) {
    console.error('[HISTORY] Log error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
