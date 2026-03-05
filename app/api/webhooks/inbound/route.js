// Inbound Webhook — Accepts external events and routes them into the pipeline
// Supports: task creation, campaign triggers, priority overrides, status updates
// Auth: Bearer token or x-webhook-secret header matching CRON_SECRET

import { NextResponse } from 'next/server'
import { createTask, updateTask, getTasks, addActivity } from '../../../../lib/airtable'

export const dynamic = 'force-dynamic'

const VALID_ACTIONS = ['create_task', 'update_status', 'boost_priority', 'trigger_campaign', 'log_event']

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')?.replace('Bearer ', '')
  const headerSecret = request.headers.get('x-webhook-secret')
  return auth === secret || headerSecret === secret
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action, payload } = body

    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({
        error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`,
      }, { status: 400 })
    }

    let result

    switch (action) {
      case 'create_task': {
        const { name, description, contentType, priority, platform, scheduledDate, agent } = payload || {}
        if (!name) return NextResponse.json({ error: 'payload.name is required' }, { status: 400 })

        const fields = {
          'Task Name': name,
          'Description': description || '',
          'Status': 'Inbox',
          'Content Type': contentType || 'General',
          'Priority': ['High', 'Medium', 'Low'].includes(priority) ? priority : 'Medium',
        }
        if (agent) fields['Agent'] = agent
        if (scheduledDate) fields['Scheduled Date'] = scheduledDate

        await createTask(fields)
        await addActivity({
          'Agent': 'Webhook',
          'Action': 'task_created',
          'Task': name,
          'Details': `External webhook created task. Type: ${contentType || 'General'}, Priority: ${priority || 'Medium'}`,
          'Type': 'Task Created',
        }).catch(() => {})

        result = { created: name, status: 'Inbox' }
        break
      }

      case 'update_status': {
        const { taskName, status } = payload || {}
        if (!taskName || !status) {
          return NextResponse.json({ error: 'payload.taskName and payload.status required' }, { status: 400 })
        }

        const validStatuses = ['Inbox', 'Assigned', 'Review', 'Done']
        if (!validStatuses.includes(status)) {
          return NextResponse.json({ error: `Invalid status. Must be: ${validStatuses.join(', ')}` }, { status: 400 })
        }

        const tasks = await getTasks({ noCache: true })
        const task = tasks.find(t => t.name === taskName)
        if (!task) return NextResponse.json({ error: `Task "${taskName}" not found` }, { status: 404 })

        await updateTask(task.id, { 'Status': status })
        result = { updated: taskName, newStatus: status }
        break
      }

      case 'boost_priority': {
        const { taskName, priority } = payload || {}
        if (!taskName) return NextResponse.json({ error: 'payload.taskName required' }, { status: 400 })

        const tasks = await getTasks({ noCache: true })
        const task = tasks.find(t => t.name === taskName)
        if (!task) return NextResponse.json({ error: `Task "${taskName}" not found` }, { status: 404 })

        await updateTask(task.id, { 'Priority': priority || 'High' })
        result = { boosted: taskName, priority: priority || 'High' }
        break
      }

      case 'trigger_campaign': {
        const { weeks } = payload || {}
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000'

        const res = await fetch(`${baseUrl}/api/campaigns/plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weeksAhead: weeks || 1 }),
        })
        const data = await res.json()
        result = { triggered: true, ...data }
        break
      }

      case 'log_event': {
        const { agent, message, type } = payload || {}
        await addActivity({
          'Agent': agent || 'External',
          'Action': 'webhook_event',
          'Task': 'Webhook',
          'Details': (message || 'External event logged').substring(0, 1000),
          'Type': type || 'Comment',
        })
        result = { logged: true }
        break
      }
    }

    return NextResponse.json({ success: true, action, result })
  } catch (err) {
    console.error('[WEBHOOK] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET: Returns webhook documentation
export async function GET() {
  return NextResponse.json({
    name: 'Songfinch Mission Control Webhook',
    version: '1.0',
    auth: 'Bearer token or x-webhook-secret header (use CRON_SECRET)',
    actions: {
      create_task: {
        description: 'Create a new content task in the pipeline',
        payload: { name: 'required', description: 'optional', contentType: 'optional', priority: 'High|Medium|Low', platform: 'optional', scheduledDate: 'YYYY-MM-DD', agent: 'optional' },
      },
      update_status: {
        description: 'Update a task status',
        payload: { taskName: 'required', status: 'Inbox|Assigned|Review|Done' },
      },
      boost_priority: {
        description: 'Escalate task priority',
        payload: { taskName: 'required', priority: 'High|Medium|Low' },
      },
      trigger_campaign: {
        description: 'Trigger CMO campaign planning',
        payload: { weeks: 'number (default: 1)' },
      },
      log_event: {
        description: 'Log an external event to the activity feed',
        payload: { agent: 'optional', message: 'required', type: 'optional' },
      },
    },
  })
}
