import { getAgents, getTasks, getActivityFeed } from '../../../lib/airtable'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [agents, tasks, activity] = await Promise.all([
      getAgents(),
      getTasks(),
      getActivityFeed(),
    ])

    return NextResponse.json({
      agents,
      tasks,
      activity,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Airtable fetch error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
