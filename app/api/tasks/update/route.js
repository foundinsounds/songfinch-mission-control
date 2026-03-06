import { updateTask, addActivity, addContent } from '../../../../lib/airtable'
import { safeJsonParse, badRequest, successResponse, apiError } from '../../../../lib/api-utils'

export async function POST(request) {
  try {
    const { data: body, error } = await safeJsonParse(request)
    if (error) return error
    const { recordId, fields, taskContext } = body

    if (!recordId || !fields) {
      return badRequest('recordId and fields are required')
    }

    // Map frontend field names to Airtable field names
    const airtableFields = {}
    if (fields.Status) {
      airtableFields['Status'] = fields.Status
      // Stamp completion timestamp when marking as Done
      if (fields.Status === 'Done') {
        airtableFields['Completed At'] = new Date().toISOString()
      }
    }
    if (fields.Agent) airtableFields['Agent'] = fields.Agent
    if (fields.Priority) airtableFields['Priority'] = fields.Priority
    if (fields.Description) airtableFields['Description'] = fields.Description
    if (fields['Task Name']) airtableFields['Task Name'] = fields['Task Name']
    if (fields['Content Type']) airtableFields['Content Type'] = fields['Content Type']
    if (fields.Campaign) airtableFields['Campaign'] = fields.Campaign

    const result = await updateTask(recordId, airtableFields)

    // If task was approved (status changed to Done), auto-publish to Content Library
    if (fields.Status === 'Done') {
      try {
        await addActivity({
          'Agent': 'Council',
          'Action': 'approved',
          'Task': result.fields?.['Task Name'] || 'Task',
          'Details': 'Task approved and moved to Done via Council',
          'Type': 'Approved',
        })

        // Auto-publish: update Content Library status from Draft to Published
        if (taskContext?.output && taskContext?.contentType) {
          try {
            await addContent({
              'Title': result.fields?.['Task Name'] || 'Untitled',
              'Content Body': getCleanOutput(taskContext.output),
              'Content Type': sanitizeContentType(taskContext.contentType),
              'Platform': taskContext.platform || '',
              'Agent': taskContext.agent || '',
              'Campaign': taskContext.campaign || '',
              'Status': 'Published',
            })

            await addActivity({
              'Agent': 'Council',
              'Action': 'published',
              'Task': result.fields?.['Task Name'] || 'Task',
              'Details': `Auto-published ${taskContext.contentType} to Content Library`,
              'Type': 'Content Generated',
            })
          } catch (pubErr) {
            console.warn('Auto-publish failed:', pubErr.message)
          }
        }
      } catch (activityErr) {
        console.warn('Failed to log approval activity:', activityErr)
      }
    }

    return successResponse({ success: true, record: result })
  } catch (error) {
    return apiError('TASK_UPDATE', error)
  }
}

// Strip revision metadata from output
function getCleanOutput(raw) {
  if (!raw) return ''
  if (raw.startsWith('[REVISION REQUESTED]')) return ''
  const idx = raw.indexOf('---PREVIOUS OUTPUT')
  return idx >= 0 ? raw.substring(0, idx).trim() : raw.trim()
}

const VALID_CONTENT_TYPES = new Set([
  'Ad Copy', 'Social Post', 'Video Script', 'Blog Post',
  'Landing Page', 'Artist Spotlight', 'Strategy', 'General',
])

function sanitizeContentType(type) {
  if (!type) return 'General'
  if (VALID_CONTENT_TYPES.has(type)) return type
  const lower = type.toLowerCase()
  if (lower.includes('ad') || lower.includes('copy')) return 'Ad Copy'
  if (lower.includes('social')) return 'Social Post'
  if (lower.includes('video') || lower.includes('script')) return 'Video Script'
  if (lower.includes('blog') || lower.includes('seo') || lower.includes('article')) return 'Blog Post'
  if (lower.includes('landing')) return 'Landing Page'
  if (lower.includes('strategy') || lower.includes('audit') || lower.includes('report')) return 'Strategy'
  return 'General'
}
