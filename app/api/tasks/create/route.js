import { createTask, addActivity } from '../../../../lib/airtable'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()
    const { name, description, agent, contentType, priority, status } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const fields = {
      'Task Name': name,
      'Description': description || '',
      'Status': status || (agent ? 'Assigned' : 'Inbox'),
      'Content Type': contentType || 'General',
      'Priority': priority || 'Medium',
    }

    if (agent) {
      fields['Agent'] = agent
    }

    const result = await createTask(fields)

    // Log activity
    await addActivity({
      'Agent': agent || 'Council',
      'Action': agent ? 'assigned' : 'created',
      'Task': name,
      'Details': `Task created via calendar${agent ? ` and assigned to ${agent}` : ''}`,
      'Type': 'Task Created',
    }).catch(() => {})

    return NextResponse.json({ success: true, record: result.records?.[0] })
  } catch (error) {
    console.error('Task create error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create task' }, { status: 500 })
  }
}
