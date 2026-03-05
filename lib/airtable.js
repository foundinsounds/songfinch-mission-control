// Airtable API client for King Claude base
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID

const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`

async function airtableFetch(tableName, options = {}) {
  const params = new URLSearchParams()
  if (options.maxRecords) params.set('maxRecords', options.maxRecords)
  if (options.sort) {
    options.sort.forEach((s, i) => {
      params.set(`sort[${i}][field]`, s.field)
      params.set(`sort[${i}][direction]`, s.direction || 'desc')
    })
  }
  if (options.filterByFormula) params.set('filterByFormula', options.filterByFormula)

  const url = `${BASE_URL}/${encodeURIComponent(tableName)}?${params.toString()}`

  const fetchOptions = {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    },
  }
  // Allow callers to bypass cache (e.g., agent runner needs fresh data)
  if (options.noCache) {
    fetchOptions.cache = 'no-store'
  } else {
    fetchOptions.next = { revalidate: 10 }
  }

  const res = await fetch(url, fetchOptions)

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Airtable error: ${res.status} - ${error}`)
  }

  return res.json()
}

async function createRecord(tableName, fields) {
  const url = `${BASE_URL}/${encodeURIComponent(tableName)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: [{ fields }] }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Airtable create error: ${res.status} - ${error}`)
  }

  return res.json()
}

async function updateRecord(tableName, recordId, fields) {
  const url = `${BASE_URL}/${encodeURIComponent(tableName)}/${recordId}`

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Airtable update error: ${res.status} - ${error}`)
  }

  return res.json()
}

// ---- Data fetchers ----

export async function getAgents({ noCache } = {}) {
  const data = await airtableFetch('Agents', { noCache })
  return data.records.map(r => ({
    id: r.id,
    name: r.fields['Name'] || '',
    role: r.fields['Role'] || '',
    type: r.fields['Type'] || 'SPC',
    status: r.fields['Status'] || 'Idle',
    color: r.fields['Color'] || '#666',
    emoji: r.fields['Emoji'] || '\u{1F916}',
    tasksCompleted: r.fields['Tasks Completed'] || 0,
    description: r.fields['Description'] || '',
    model: r.fields['Model'] || 'claude-sonnet-4-6',
    temperature: r.fields['Temperature'] != null ? r.fields['Temperature'] : 0.7,
    systemPrompt: r.fields['System Prompt'] || '',
  }))
}

export async function getTasks({ noCache } = {}) {
  const data = await airtableFetch('Mission Queue', {
    sort: [{ field: 'Priority', direction: 'asc' }],
    noCache,
  })
  return data.records.map(r => ({
    id: r.id,
    name: r.fields['Task Name'] || '',
    description: r.fields['Description'] || '',
    agent: r.fields['Agent'] || null,
    status: r.fields['Status'] || 'Inbox',
    contentType: r.fields['Content Type'] || '',
    platform: r.fields['Platform'] || [],
    campaign: r.fields['Campaign'] || '',
    priority: r.fields['Priority'] || 'Medium',
    tags: (r.fields['Emotional Pillar'] || []).map(p => p.toLowerCase()),
    output: r.fields['Output'] || '',
    createdAt: r.createdTime,
    scheduledDate: r.fields['Scheduled Date'] || null,
    driveLink: r.fields['Google Drive Link'] || '',
    canvaLink: r.fields['Canva Link'] || '',
  }))
}

export async function getContentLibrary() {
  const data = await airtableFetch('Content Library', {
    sort: [{ field: 'Title', direction: 'asc' }]
  })
  return data.records.map(r => ({
    id: r.id,
    title: r.fields['Title'] || '',
    contentType: r.fields['Content Type'] || '',
    body: r.fields['Content Body'] || '',
    platform: r.fields['Platform'] || '',
    status: r.fields['Status'] || 'Draft',
    agent: r.fields['Agent'] || '',
    campaign: r.fields['Campaign'] || '',
    pillar: r.fields['Emotional Pillar'] || '',
    headline: r.fields['Headline'] || '',
    cta: r.fields['CTA'] || '',
  }))
}

export async function getActivityFeed({ maxRecords = 20 } = {}) {
  const data = await airtableFetch('Activity Feed', {
    maxRecords,
    sort: [{ field: 'Agent', direction: 'desc' }]
  })
  return data.records.map(r => ({
    id: r.id,
    agent: r.fields['Agent'] || '',
    action: r.fields['Action'] || '',
    task: r.fields['Task'] || '',
    details: r.fields['Details'] || '',
    type: r.fields['Type'] || 'Comment',
    timestamp: r.createdTime,
  }))
}

// Full activity fetch for intelligence analytics — gets ALL records via pagination
export async function getAllActivity() {
  const allRecords = []
  let offset = null

  do {
    const params = new URLSearchParams()
    params.set('pageSize', '100')
    if (offset) params.set('offset', offset)

    const url = `${BASE_URL}/${encodeURIComponent('Activity Feed')}?${params.toString()}`
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` },
      cache: 'no-store',
    })

    if (!res.ok) break

    const data = await res.json()
    allRecords.push(...data.records)
    offset = data.offset || null
  } while (offset)

  return allRecords.map(r => ({
    id: r.id,
    agent: r.fields['Agent'] || '',
    action: r.fields['Action'] || '',
    task: r.fields['Task'] || '',
    details: r.fields['Details'] || '',
    type: r.fields['Type'] || 'Comment',
    timestamp: r.createdTime,
  }))
}

export async function createTask(fields) {
  return createRecord('Mission Queue', fields)
}

export async function updateTask(recordId, fields) {
  return updateRecord('Mission Queue', recordId, fields)
}

export async function updateAgent(recordId, fields) {
  return updateRecord('Agents', recordId, fields)
}

export async function addActivity(fields) {
  return createRecord('Activity Feed', fields)
}

export async function addContent(fields) {
  return createRecord('Content Library', fields)
}
