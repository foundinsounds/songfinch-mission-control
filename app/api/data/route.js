import { getAgents, getTasks, getActivityFeed } from '../../../lib/airtable'
import { successResponse } from '../../../lib/api-utils'

export const dynamic = 'force-dynamic'

async function safeFetch(fn, label) {
  try {
    return await fn({ noCache: true })
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

  return successResponse({
    agents,
    tasks,
    activity,
    partial: agents.length === 0 || tasks.length === 0,
  })
}
