// Task Archive — Move tasks to Done/Archived state
// Supports single task or bulk archive

import { archiveTask, archiveTasks, addActivity } from '../../../../lib/airtable'
import { safeJsonParse, badRequest, validateRequired, successResponse, apiError } from '../../../../lib/api-utils'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const { data: body, error } = await safeJsonParse(request)
  if (error) return error

  try {
    // Bulk archive: { taskIds: ['recXXX', 'recYYY'] }
    if (body.taskIds && Array.isArray(body.taskIds)) {
      if (body.taskIds.length === 0) {
        return badRequest('taskIds array is empty')
      }
      if (body.taskIds.length > 50) {
        return badRequest('Maximum 50 tasks per bulk archive')
      }

      const results = await archiveTasks(body.taskIds)

      // Log bulk archive to activity
      await addActivity({
        'Action': 'archived',
        'Details': `Bulk archived ${results.succeeded} tasks (${results.failed} failed)`,
        'Timestamp': new Date().toISOString(),
      }).catch(err => console.warn('[ARCHIVE] Failed to log bulk activity:', err.message))

      return successResponse({
        message: `Archived ${results.succeeded} of ${results.total} tasks`,
        ...results,
      })
    }

    // Single archive: { taskId: 'recXXX' }
    const missing = validateRequired(body, ['taskId'])
    if (missing) return missing

    await archiveTask(body.taskId)

    // Log to activity feed
    await addActivity({
      'Action': 'archived',
      'Details': `Task archived from inbox: ${body.taskId}`,
      'Task': [body.taskId],
      'Timestamp': new Date().toISOString(),
    }).catch(err => console.warn('[ARCHIVE] Failed to log activity:', err.message))

    return successResponse({
      message: 'Task archived',
      taskId: body.taskId,
    })
  } catch (err) {
    return apiError('ARCHIVE', err)
  }
}
