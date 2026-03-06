import { getContentLibrary } from '../../../lib/airtable'
import { successResponse, apiError } from '../../../lib/api-utils'

export async function GET() {
  try {
    const content = await getContentLibrary()
    return successResponse({ content })
  } catch (err) {
    return apiError('CONTENT', err)
  }
}
