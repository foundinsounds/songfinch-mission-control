// Agent Memory System — persistent learning across runs
// Enhanced: relevance scoring, context-based retrieval, importance decay
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
    if (res.status === 404 || error.includes('TABLE_NOT_FOUND') || error.includes('NOT_FOUND')) {
      return { records: [] }
    }
    throw new Error(`Airtable error: ${res.status} - ${error}`)
  }

  return res.json()
}

// ---- RELEVANCE SCORING ENGINE ----
// Scores memories based on: recency, importance, context match, type match

const IMPORTANCE_WEIGHTS = { 'Critical': 5, 'High': 3, 'Medium': 1.5, 'Low': 0.5 }
const TYPE_WEIGHTS = { 'feedback': 3, 'strategy': 2.5, 'learning': 2, 'preference': 1.5 }

function scoreMemory(memory, context = {}) {
  let score = 0

  // 1. Importance weight
  score += IMPORTANCE_WEIGHTS[memory.importance] || 1

  // 2. Recency decay — memories lose value over time
  const ageMs = Date.now() - new Date(memory.createdAt).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  const recencyMultiplier = Math.max(0.1, 1 - (ageDays / 90)) // Full decay over 90 days
  score *= recencyMultiplier

  // 3. Type relevance boost
  score *= TYPE_WEIGHTS[memory.type] || 1

  // 4. Context matching — boost memories relevant to current task
  if (context.contentType && memory.taskContext) {
    if (memory.taskContext.toLowerCase().includes(context.contentType.toLowerCase())) {
      score *= 2.5 // Strong match: same content type
    }
  }

  if (context.query) {
    const queryWords = context.query.toLowerCase().split(/\s+/)
    const contentLower = memory.content.toLowerCase()
    const matchCount = queryWords.filter(w => w.length > 3 && contentLower.includes(w)).length
    if (matchCount > 0) {
      score *= 1 + (matchCount * 0.5) // Each keyword match boosts 50%
    }
  }

  if (context.territory && memory.content.toLowerCase().includes(context.territory.toLowerCase())) {
    score *= 1.8 // Territory match
  }

  return Math.round(score * 100) / 100
}

function rankMemories(memories, context = {}, limit = 10) {
  return memories
    .map(m => ({ ...m, relevanceScore: scoreMemory(m, context) }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit)
}

// GET — Retrieve memories with optional relevance scoring
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentName = searchParams.get('agent')
    const type = searchParams.get('type')
    const contentType = searchParams.get('contentType') // For context-based retrieval
    const query = searchParams.get('query') // Free-text relevance query
    const territory = searchParams.get('territory') // Emotional territory filter
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const ranked = searchParams.get('ranked') === 'true' // Enable relevance scoring

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
    params.set('maxRecords', '100') // Fetch more for ranking, then trim

    const data = await airtableRequest(`${BASE_URL}?${params.toString()}`)

    let memories = data.records.map(r => ({
      id: r.id,
      agent: r.fields['Agent'] || '',
      type: r.fields['Type'] || 'learning',
      content: r.fields['Content'] || '',
      source: r.fields['Source'] || '',
      importance: r.fields['Importance'] || 'Medium',
      taskContext: r.fields['Task Context'] || '',
      createdAt: r.createdTime,
    }))

    // Apply relevance scoring if requested or if context filters are provided
    if (ranked || contentType || query || territory) {
      memories = rankMemories(memories, { contentType, query, territory }, limit)
    } else {
      memories = memories.slice(0, limit)
    }

    return NextResponse.json({ memories, total: data.records.length, ranked: ranked || !!contentType || !!query })
  } catch (error) {
    console.error('[MEMORY] GET error:', error.message)
    return NextResponse.json({ memories: [], error: error.message })
  }
}

// POST — Add a new memory (with deduplication)
export async function POST(request) {
  try {
    const body = await request.json()
    const { agent, type, content, source, importance, taskContext } = body

    if (!agent || !content) {
      return NextResponse.json({ error: 'agent and content are required' }, { status: 400 })
    }

    // Deduplication: check if a very similar memory already exists
    // Use a simple content-prefix check (first 100 chars) to avoid exact duplicates
    const contentPrefix = content.substring(0, 100).replace(/'/g, "\\'")
    const dedupeParams = new URLSearchParams()
    dedupeParams.set('filterByFormula', `AND({Agent}='${agent}',SEARCH("${contentPrefix.substring(0, 50)}",{Content})>0)`)
    dedupeParams.set('maxRecords', '1')

    try {
      const existing = await airtableRequest(`${BASE_URL}?${dedupeParams.toString()}`)
      if (existing.records?.length > 0) {
        return NextResponse.json({
          success: true,
          deduplicated: true,
          message: 'Similar memory already exists, skipping',
          existing: existing.records[0].id,
        })
      }
    } catch {
      // Dedup check failed, proceed with creation anyway
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

// DELETE — Prune old low-importance memories (memory hygiene)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const agent = searchParams.get('agent')
    const maxAgeDays = parseInt(searchParams.get('maxAgeDays') || '60', 10)

    if (!agent) {
      return NextResponse.json({ error: 'agent is required' }, { status: 400 })
    }

    // Fetch all memories for this agent
    const params = new URLSearchParams()
    params.set('filterByFormula', `{Agent}='${agent}'`)
    params.set('maxRecords', '100')

    const data = await airtableRequest(`${BASE_URL}?${params.toString()}`)

    // Find prunable memories: old + low importance
    const now = Date.now()
    const prunable = data.records.filter(r => {
      const importance = r.fields['Importance'] || 'Medium'
      const age = now - new Date(r.createdTime).getTime()
      const ageDays = age / (1000 * 60 * 60 * 24)

      // Keep Critical and High importance forever
      if (importance === 'Critical' || importance === 'High') return false
      // Prune Medium after maxAgeDays, Low after half
      if (importance === 'Medium' && ageDays > maxAgeDays) return true
      if (importance === 'Low' && ageDays > maxAgeDays / 2) return true
      return false
    })

    // Delete in batches of 10 (Airtable limit)
    let deleted = 0
    for (let i = 0; i < prunable.length; i += 10) {
      const batch = prunable.slice(i, i + 10)
      const ids = batch.map(r => `records[]=${r.id}`).join('&')
      try {
        await airtableRequest(`${BASE_URL}?${ids}`, { method: 'DELETE' })
        deleted += batch.length
      } catch (err) {
        console.warn(`[MEMORY] Prune batch failed:`, err.message)
      }
    }

    return NextResponse.json({
      success: true,
      agent,
      pruned: deleted,
      total: data.records.length,
      remaining: data.records.length - deleted,
    })
  } catch (error) {
    console.error('[MEMORY] DELETE error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
