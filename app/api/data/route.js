import { getAgents, getTasks, getActivityFeed } from '../../../lib/airtable'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function safeFetch(fn, label) {
  try {
    return await fn()
  } catch (err) {
    console.warn(`[data] ${label} failed: ${err.message}`)
    return []
  }
}

export async function GET() {
  const [agents, tasks, activity] = await Promise.all([
    safeFetch(getAgents, 'agents'),
    safeFetch(getTasks, 'tasks'),
    safeFetch(getActivityFeed, 'activity'),
  ])

  return NextResponse.json({
    agents,
    tasks,
    activity,
    timestamp: new Date().toISOString(),
    partial: agents.length === 0 || tasks.length === 0,
  })
}
