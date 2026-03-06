import { updateAgent } from '../../../../lib/airtable'
import { safeJsonParse, badRequest, successResponse, apiError } from '../../../../lib/api-utils'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const { data: body, error } = await safeJsonParse(request)
    if (error) return error
    const { recordId, fields } = body

    if (!recordId) {
      return badRequest('recordId is required')
    }

    if (!fields || Object.keys(fields).length === 0) {
      return badRequest('fields object is required and must not be empty')
    }

    // Map frontend field names to Airtable field names
    // Only include fields that have values to avoid Airtable errors with undefined
    const airtableFields = {}
    if (fields.status !== undefined && fields.status !== null) {
      airtableFields['Status'] = fields.status
    }
    if (fields.model !== undefined && fields.model !== null) {
      airtableFields['Model'] = fields.model
    }
    if (fields.temperature !== undefined && fields.temperature !== null) {
      airtableFields['Temperature'] = parseFloat(fields.temperature)
    }
    if (fields.systemPrompt !== undefined && fields.systemPrompt !== null) {
      airtableFields['System Prompt'] = fields.systemPrompt
    }

    console.log(`[AGENT UPDATE] Updating ${recordId}:`, Object.keys(airtableFields))

    const result = await updateAgent(recordId, airtableFields)

    return successResponse({
      success: true,
      record: result,
    })
  } catch (error) {
    return apiError('AGENT_UPDATE', error)
  }
}
