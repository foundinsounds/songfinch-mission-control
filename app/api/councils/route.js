// Council Management API — Multi-council architecture
// Stores council configs in Airtable "Councils" table
// Each council = separate set of agents, tasks, and activity

import { NextResponse } from 'next/server'
import { safeJsonParse } from '../../../lib/api-utils'

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_NAME = 'Councils'

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

// GET — List all councils
export async function GET() {
  try {
    const data = await airtableRequest(BASE_URL)

    const councils = data.records.map(r => ({
      id: r.id,
      name: r.fields['Name'] || '',
      org: r.fields['Organization'] || '',
      description: r.fields['Description'] || '',
      icon: r.fields['Icon'] || '\u{1F3DB}',
      color: r.fields['Color'] || '#FF6B35',
      isActive: r.fields['Active'] !== false,
      agentCount: r.fields['Agent Count'] || 0,
      taskCount: r.fields['Task Count'] || 0,
      createdAt: r.createdTime,
    }))

    // If no councils exist, return the default Marketing Council
    if (councils.length === 0) {
      return NextResponse.json({
        councils: [{
          id: 'default',
          name: 'Marketing Council',
          org: 'Songfinch',
          description: 'AI-powered marketing team managing content, campaigns, and brand strategy',
          icon: '\u{1F3AF}',
          color: '#FF6B35',
          isActive: true,
          agentCount: 9,
          taskCount: 0,
        }]
      })
    }

    return NextResponse.json({ councils })
  } catch (error) {
    console.error('[COUNCILS] GET error:', error.message)
    // Return default council on any error
    return NextResponse.json({
      councils: [{
        id: 'default',
        name: 'Marketing Council',
        org: 'Songfinch',
        description: 'AI-powered marketing team',
        icon: '\u{1F3AF}',
        color: '#FF6B35',
        isActive: true,
        agentCount: 9,
        taskCount: 0,
      }]
    })
  }
}

// POST — Create a new council
export async function POST(request) {
  try {
    const { data: body, error: parseErr } = await safeJsonParse(request)
    if (parseErr) return parseErr
    const { name, org, description, icon, color } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const fields = {
      'Name': name,
      'Organization': org || '',
      'Description': description || '',
      'Icon': icon || '\u{1F3DB}',
      'Color': color || '#FF6B35',
      'Active': true,
    }

    const data = await airtableRequest(BASE_URL, {
      method: 'POST',
      body: JSON.stringify({ records: [{ fields }] }),
    })

    return NextResponse.json({ success: true, council: data.records?.[0] })
  } catch (error) {
    console.error('[COUNCILS] POST error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
