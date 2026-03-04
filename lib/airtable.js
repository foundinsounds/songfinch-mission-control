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

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    },
    next: { revalidate: 10 }, // Cache for 10 seconds
  })

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

export async function getAgents() {
  const data = await airtableFetch('Agents')
  return data.records.map(r => ({
    id: r.id,
    name: r.fields['Name'] || '',
    role: r.fields['Role'] || '',
    type: r.fields['Type'] || 'SPC',
    status: r.fields['Status'] || 'Idle',
    color: r.fields['Color'] || '#666',
    emoji: r.fields['Emoji'] || '🤖',
    tasksCompleted: r.fields['Tasks Completed'] || 0,
    description: r.fields['Description'] || '',
  }))
}

export async function getTasks() {
  const data = await airtableFetch('Mission Queue', {
    sort: [{ field: 'Priority', direction: 'asc' }]
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

export async function getActivityFeed() {
  const data = await airtableFetch('Activity Feed', {
    maxRecords: 20,
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

export async function createTask(fields) {
  return createRecord('Mission Queue', fields)
}

export async function updateTask(recordId, fields) {
  return updateRecord('Mission Queue', recordId, fields)
}

export async function addActivity(fields) {
  return createRecord('Activity Feed', fields)
}

export async function addContent(fields) {
  return createRecord('Content Library', fields)
}
