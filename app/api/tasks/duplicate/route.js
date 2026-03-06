// Task Duplication API — clones a task with a new name
import { getTasks, createTask } from '../../../../lib/airtable'
import { NextResponse } from 'next/server'
import { safeJsonParse } from '../../../../lib/api-utils'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const { data: body, error } = await safeJsonParse(request)
    if (error) return error
    const { taskId } = body
    if (!taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 })
    }

    // Fetch all tasks, find the source
    const allTasks = await getTasks({ noCache: true })
    const source = allTasks.find(t => t.id === taskId)
    if (!source) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Build clone fields — reset status, keep most metadata
    const cloneFields = {
      'Task Name': `${source.name} (Copy)`,
      'Status': 'Inbox',
      'Description': source.description || '',
      'Agent': source.agent || '',
      'Content Type': source.contentType || '',
      'Priority': source.priority || 'Medium',
      'Platform': Array.isArray(source.platform) ? source.platform : [],
      'Campaign': source.campaign || '',
      // Don't copy: output, driveLink, canvaLink, scheduledDate (fresh start)
    }

    // Remove empty string fields (keep arrays even if empty)
    Object.keys(cloneFields).forEach(k => {
      if (cloneFields[k] === '' || cloneFields[k] === null) delete cloneFields[k]
    })

    const result = await createTask(cloneFields)

    return NextResponse.json({
      success: true,
      id: result?.records?.[0]?.id,
      name: cloneFields['Task Name'],
      message: `Cloned "${source.name}" → "${cloneFields['Task Name']}"`,
    })
  } catch (err) {
    console.error('[DUPLICATE] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
