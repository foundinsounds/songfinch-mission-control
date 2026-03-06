// Autonomous Goal Pursuit — Standing objectives that agents work toward
// Goals = long-term objectives that auto-generate tasks when triggered
// Each goal has conditions, frequency, and assigned agent(s)

import { NextResponse } from 'next/server'
import { safeJsonParse, successResponse, apiError } from '../../../lib/api-utils'

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_NAME = 'Goals'

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

// GET — List all goals
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const agent = searchParams.get('agent')
    const status = searchParams.get('status') // active, paused, completed

    let filterFormula = ''
    const filters = []
    if (agent) filters.push(`{Agent}='${agent}'`)
    if (status) filters.push(`{Status}='${status}'`)
    if (filters.length > 0) {
      filterFormula = filters.length === 1 ? filters[0] : `AND(${filters.join(',')})`
    }

    const params = new URLSearchParams()
    if (filterFormula) params.set('filterByFormula', filterFormula)
    params.set('sort[0][field]', 'Priority')
    params.set('sort[0][direction]', 'desc')

    const data = await airtableRequest(`${BASE_URL}?${params.toString()}`)

    const goals = data.records.map(r => ({
      id: r.id,
      name: r.fields['Name'] || '',
      description: r.fields['Description'] || '',
      agent: r.fields['Agent'] || '',
      status: r.fields['Status'] || 'Active',
      priority: r.fields['Priority'] || 'Medium',
      frequency: r.fields['Frequency'] || 'Weekly',
      contentType: r.fields['Content Type'] || 'General',
      campaign: r.fields['Campaign'] || '',
      lastTriggered: r.fields['Last Triggered'] || null,
      tasksGenerated: r.fields['Tasks Generated'] || 0,
      createdAt: r.createdTime,
    }))

    // Return default goals if none exist
    if (goals.length === 0) {
      return NextResponse.json({
        goals: [
          {
            id: 'default-1',
            name: 'Weekly Social Content',
            description: 'Generate fresh social media content for all active platforms each week',
            agent: 'HOOK',
            status: 'Active',
            priority: 'High',
            frequency: 'Weekly',
            contentType: 'Social Post',
            campaign: 'Ongoing',
            lastTriggered: null,
            tasksGenerated: 0,
          },
          {
            id: 'default-2',
            name: 'Monthly Blog Post',
            description: 'Research and draft a long-form blog post on trending emotional gifting topics',
            agent: 'FLOW',
            status: 'Active',
            priority: 'Medium',
            frequency: 'Monthly',
            contentType: 'Blog Post',
            campaign: 'SEO',
            lastTriggered: null,
            tasksGenerated: 0,
          },
          {
            id: 'default-3',
            name: 'Campaign Performance Review',
            description: 'Analyze current campaign metrics and generate optimization recommendations',
            agent: 'PULSE',
            status: 'Active',
            priority: 'Medium',
            frequency: 'Weekly',
            contentType: 'Strategy',
            campaign: 'All',
            lastTriggered: null,
            tasksGenerated: 0,
          },
        ]
      })
    }

    return successResponse({ goals })
  } catch (error) {
    return apiError('GOALS', error)
  }
}

// PATCH — Update a goal (e.g., Last Triggered, Tasks Generated, Status)
export async function PATCH(request) {
  try {
    const { data: body, error: parseErr } = await safeJsonParse(request)
    if (parseErr) return parseErr
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Map camelCase to Airtable field names
    const fields = {}
    if (updates.lastTriggered !== undefined) fields['Last Triggered'] = updates.lastTriggered
    if (updates.tasksGenerated !== undefined) fields['Tasks Generated'] = updates.tasksGenerated
    if (updates.status !== undefined) fields['Status'] = updates.status
    if (updates.name !== undefined) fields['Name'] = updates.name
    if (updates.description !== undefined) fields['Description'] = updates.description
    if (updates.priority !== undefined) fields['Priority'] = updates.priority
    if (updates.frequency !== undefined) fields['Frequency'] = updates.frequency
    if (updates.contentType !== undefined) fields['Content Type'] = updates.contentType
    if (updates.campaign !== undefined) fields['Campaign'] = updates.campaign
    if (updates.agent !== undefined) fields['Agent'] = updates.agent

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const url = `${BASE_URL}/${id}`
    const data = await airtableRequest(url, {
      method: 'PATCH',
      body: JSON.stringify({ fields }),
    })

    return successResponse({ success: true, goal: data })
  } catch (error) {
    return apiError('GOALS', error)
  }
}

// POST — Create a new goal
export async function POST(request) {
  try {
    const { data: body, error: parseErr } = await safeJsonParse(request)
    if (parseErr) return parseErr
    const { name, description, agent, priority, frequency, contentType, campaign } = body

    if (!name || !agent) {
      return NextResponse.json({ error: 'name and agent are required' }, { status: 400 })
    }

    const fields = {
      'Name': name,
      'Description': description || '',
      'Agent': agent,
      'Status': 'Active',
      'Priority': priority || 'Medium',
      'Frequency': frequency || 'Weekly',
      'Content Type': contentType || 'General',
      'Campaign': campaign || '',
      'Tasks Generated': 0,
    }

    const data = await airtableRequest(BASE_URL, {
      method: 'POST',
      body: JSON.stringify({ records: [{ fields }] }),
    })

    return successResponse({ success: true, goal: data.records?.[0] })
  } catch (error) {
    return apiError('GOALS', error)
  }
}
