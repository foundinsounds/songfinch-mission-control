import { createTask, addActivity } from '../../../../lib/airtable'
import { safeJsonParse, badRequest, successResponse, apiError } from '../../../../lib/api-utils'

export async function POST(request) {
  try {
    const { data: body, error } = await safeJsonParse(request)
    if (error) return error
    const { name, description, agent, contentType, priority, status, scheduledDate, campaign, platform } = body

    if (!name) {
      return badRequest('name is required')
    }

    const fields = {
      'Task Name': name,
      'Description': description || '',
      'Status': status || (agent ? 'Assigned' : 'Inbox'),
      'Content Type': contentType || 'General',
      'Priority': priority || 'Medium',
    }

    if (agent) fields['Agent'] = agent
    if (scheduledDate) fields['Scheduled Date'] = scheduledDate
    if (campaign) fields['Campaign'] = campaign
    if (platform) fields['Platform'] = Array.isArray(platform) ? platform : [platform]

    const result = await createTask(fields)

    // Log activity
    await addActivity({
      'Agent': agent || 'Council',
      'Action': agent ? 'assigned' : 'created',
      'Task': name,
      'Details': `Task created${scheduledDate ? ` for ${scheduledDate}` : ''}${agent ? ` and assigned to ${agent}` : ''}`,
      'Type': 'Task Created',
    }).catch(err => console.warn('[TASKS] Activity log failed:', err.message))

    return successResponse({ success: true, record: result.records?.[0] })
  } catch (error) {
    return apiError('TASK_CREATE', error)
  }
}
