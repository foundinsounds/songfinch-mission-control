// Agent Memory System — persistent learning across runs
// Stores: feedback patterns, successful strategies, content preferences, learnings

import { NextResponse } from 'next/server'

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_NAME = 'Agent Memory'

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
    // If table doesn't exist, return empty gracefully
    if (res.status === 404 || error.includes('TABLE_NOT_FOUND') || error.includes('NOT_FOUND')) {
      return { records: [] }
    }
    throw new Error(`Airtable error: ${res.status} - ${error}`)
  }

  return res.json()
}

// GET — Retrieve memories for an agent (or all agents)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentName = searchParams.get('agent')
    const type = searchParams.get('type') // learning, feedback, strategy, preference

    let filterFormula = ''
    const filters = []
    if (agentName) filters.push(`{Agent}='${agentName}'`)
    if (type) filters.push(`{Type}='${type}'`)
    if (filters.length > 0) {
      filterFormula = filters.length === 1 ? filters[0] : `AND(${filters.join(',')})`
    }

    const params = new URLSearchParams()
    if (filterFormula) params.set('filterByFormula', filterFormula)
    params.set('sort[0][field]', 'Agent')
    params.set('sort[0][direction]', 'asc')
    params.set('maxRecords', '100')

    const data = await airtableRequest(`${BASE_URL}?${params.toString()}`)

    const memories = data.records.map(r => ({
      id: r.id,
      agent: r.fields['Agent'] || '',
      type: r.fields['Type'] || 'learning',
      content: r.fields['Content'] || '',
      source: r.fields['Source'] || '',
      importance: r.fields['Importance'] || 'Medium',
      taskContext: r.fields['Task Context'] || '',
      createdAt: r.createdTime,
    }))

    return NextResponse.json({ memories })
  } catch (error) {
    console.error('[MEMORY] GET error:', error.message)
    return NextResponse.json({ memories: [], error: error.message })
  }
}

// POST — Add a new memory
export async function POST(request) {
  try {
    const body = await request.json()
    const { agent, type, content, source, importance, taskContext } = body

    if (!agent || !content) {
      return NextResponse.json({ error: 'agent and content are required' }, { status: 400 })
    }

    const fields = {
      'Agent': agent,
      'Type': type || 'learning',
      'Content': content.substring(0, 5000),
      'Source': source || '',
      'Importance': importance || 'Medium',
      'Task Context': taskContext || '',
    }

    const data = await airtableRequest(BASE_URL, {
      method: 'POST',
      body: JSON.stringify({ records: [{ fields }] }),
    })

    return NextResponse.json({ success: true, record: data.records?.[0] })
  } catch (error) {
    console.error('[MEMORY] POST error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
