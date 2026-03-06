// Task Comments / Notes System — threaded discussion on tasks
// Supports: adding notes, feedback, revision context per task
// Stored in Airtable 'Task Comments' table

import { safeJsonParse, badRequest, successResponse, apiError } from '../../../../lib/api-utils'

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_NAME = 'Task Comments'

const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`

async function airtableRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const error = await res.text()
    if (res.status === 404 || error.includes('TABLE_NOT_FOUND') || error.includes('NOT_FOUND')) {
      return { records: [] }
    }
    throw new Error(`Airtable error: ${res.status} - ${error}`)
  }

  return res.json()
}

// GET — Retrieve comments for a task
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    const taskName = searchParams.get('taskName')
    const agent = searchParams.get('agent')

    const filters = []
    if (taskId) filters.push(`{Task ID}='${taskId}'`)
    if (taskName) filters.push(`{Task Name}='${taskName}'`)
    if (agent) filters.push(`{Author}='${agent}'`)

    let filterFormula = ''
    if (filters.length > 0) {
      filterFormula = filters.length === 1 ? filters[0] : `AND(${filters.join(',')})`
    }

    const params = new URLSearchParams()
    if (filterFormula) params.set('filterByFormula', filterFormula)
    params.set('sort[0][field]', 'Created', )
    params.set('sort[0][direction]', 'desc')
    params.set('maxRecords', '50')

    const data = await airtableRequest(`${BASE_URL}?${params.toString()}`)

    const comments = data.records.map(r => ({
      id: r.id,
      taskId: r.fields['Task ID'] || '',
      taskName: r.fields['Task Name'] || '',
      author: r.fields['Author'] || 'System',
      type: r.fields['Type'] || 'note', // note, feedback, revision, approval, system
      content: r.fields['Content'] || '',
      sentiment: r.fields['Sentiment'] || 'neutral', // positive, negative, neutral
      createdAt: r.createdTime,
    }))

    return successResponse({ comments, total: comments.length })
  } catch (error) {
    return apiError('COMMENTS_GET', error)
  }
}

// POST — Add a comment to a task
export async function POST(request) {
  try {
    const { data: body, error: parseErr } = await safeJsonParse(request)
    if (parseErr) return parseErr
    const { taskId, taskName, author, type, content } = body

    if (!content) {
      return badRequest('content is required')
    }

    // Auto-detect sentiment from content
    const lowerContent = content.toLowerCase()
    let sentiment = 'neutral'
    const positiveWords = ['great', 'excellent', 'perfect', 'love', 'amazing', 'approved', 'well done', 'good', 'nice']
    const negativeWords = ['bad', 'wrong', 'fix', 'issue', 'problem', 'fail', 'reject', 'weak', 'poor', 'redo']

    const posCount = positiveWords.filter(w => lowerContent.includes(w)).length
    const negCount = negativeWords.filter(w => lowerContent.includes(w)).length
    if (posCount > negCount) sentiment = 'positive'
    else if (negCount > posCount) sentiment = 'negative'

    const fields = {
      'Task ID': taskId || '',
      'Task Name': taskName || '',
      'Author': author || 'User',
      'Type': type || 'note',
      'Content': content.substring(0, 5000),
      'Sentiment': sentiment,
    }

    const data = await airtableRequest(BASE_URL, {
      method: 'POST',
      body: JSON.stringify({ records: [{ fields }] }),
    })

    return successResponse({
      success: true,
      comment: data.records?.[0],
      sentiment,
    })
  } catch (error) {
    return apiError('COMMENTS_POST', error)
  }
}
