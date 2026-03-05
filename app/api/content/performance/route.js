// Content Performance Tracking — feedback loop for agent learning
// Tracks: views, engagement, conversions, quality scores per content piece
// Feeds back into agent memory for continuous improvement

import { NextResponse } from 'next/server'

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_NAME = 'Content Performance'

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

// ---- Performance Scoring Engine ----

function calculatePerformanceScore(metrics) {
  const weights = {
    engagement: 0.3,
    quality: 0.25,
    reach: 0.2,
    conversion: 0.15,
    timeliness: 0.1,
  }

  let score = 0
  if (metrics.engagementRate) score += (metrics.engagementRate / 10) * weights.engagement * 100
  if (metrics.qualityScore) score += metrics.qualityScore * weights.quality
  if (metrics.reachMultiplier) score += Math.min(metrics.reachMultiplier * 20, 100) * weights.reach
  if (metrics.conversionRate) score += (metrics.conversionRate / 5) * weights.conversion * 100
  if (metrics.onTime !== undefined) score += (metrics.onTime ? 100 : 50) * weights.timeliness

  return Math.round(Math.min(score, 100) * 10) / 10
}

function deriveInsight(metrics, contentType) {
  const insights = []

  if (metrics.engagementRate > 5) {
    insights.push(`High engagement (${metrics.engagementRate}%) — this ${contentType} resonated well`)
  } else if (metrics.engagementRate < 1) {
    insights.push(`Low engagement (${metrics.engagementRate}%) — consider stronger hooks for ${contentType}`)
  }

  if (metrics.qualityScore >= 80) {
    insights.push('Quality score is excellent — maintain this approach')
  } else if (metrics.qualityScore < 50) {
    insights.push('Quality needs improvement — review agent prompts and templates')
  }

  if (metrics.conversionRate > 3) {
    insights.push(`Strong conversion (${metrics.conversionRate}%) — effective CTA strategy`)
  }

  return insights.join('. ') || 'Insufficient data for insights'
}

// GET — Retrieve performance data with optional aggregation
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const agent = searchParams.get('agent')
    const contentType = searchParams.get('contentType')
    const campaign = searchParams.get('campaign')
    const period = searchParams.get('period') || '30' // days
    const aggregate = searchParams.get('aggregate') === 'true'

    let filterFormula = ''
    const filters = []
    if (agent) filters.push(`{Agent}='${agent}'`)
    if (contentType) filters.push(`{Content Type}='${contentType}'`)
    if (campaign) filters.push(`{Campaign}='${campaign}'`)

    // Date filter
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(period, 10))
    filters.push(`IS_AFTER({Created}, '${cutoffDate.toISOString().split('T')[0]}')`)

    if (filters.length > 0) {
      filterFormula = filters.length === 1 ? filters[0] : `AND(${filters.join(',')})`
    }

    const params = new URLSearchParams()
    if (filterFormula) params.set('filterByFormula', filterFormula)
    params.set('sort[0][field]', 'Performance Score')
    params.set('sort[0][direction]', 'desc')
    params.set('maxRecords', '100')

    const data = await airtableRequest(`${BASE_URL}?${params.toString()}`)

    const records = data.records.map(r => ({
      id: r.id,
      taskId: r.fields['Task ID'] || '',
      agent: r.fields['Agent'] || '',
      contentType: r.fields['Content Type'] || '',
      campaign: r.fields['Campaign'] || '',
      platform: r.fields['Platform'] || '',
      engagementRate: r.fields['Engagement Rate'] || 0,
      qualityScore: r.fields['Quality Score'] || 0,
      reachMultiplier: r.fields['Reach Multiplier'] || 0,
      conversionRate: r.fields['Conversion Rate'] || 0,
      performanceScore: r.fields['Performance Score'] || 0,
      insight: r.fields['Insight'] || '',
      feedback: r.fields['Feedback'] || '',
      createdAt: r.createdTime,
    }))

    // Aggregation mode — return summary stats
    if (aggregate && records.length > 0) {
      const byAgent = {}
      const byContentType = {}
      const byPlatform = {}

      records.forEach(r => {
        // By agent
        if (!byAgent[r.agent]) byAgent[r.agent] = { count: 0, totalScore: 0, scores: [] }
        byAgent[r.agent].count++
        byAgent[r.agent].totalScore += r.performanceScore
        byAgent[r.agent].scores.push(r.performanceScore)

        // By content type
        if (!byContentType[r.contentType]) byContentType[r.contentType] = { count: 0, totalScore: 0 }
        byContentType[r.contentType].count++
        byContentType[r.contentType].totalScore += r.performanceScore

        // By platform
        if (r.platform) {
          if (!byPlatform[r.platform]) byPlatform[r.platform] = { count: 0, totalScore: 0 }
          byPlatform[r.platform].count++
          byPlatform[r.platform].totalScore += r.performanceScore
        }
      })

      // Calculate averages
      const agentSummary = Object.entries(byAgent).map(([name, data]) => ({
        agent: name,
        count: data.count,
        avgScore: Math.round((data.totalScore / data.count) * 10) / 10,
        trend: data.scores.length >= 3
          ? data.scores.slice(-3).reduce((a, b) => a + b, 0) / 3 > data.scores.slice(0, 3).reduce((a, b) => a + b, 0) / 3
            ? 'improving' : 'declining'
          : 'stable',
      })).sort((a, b) => b.avgScore - a.avgScore)

      const contentTypeSummary = Object.entries(byContentType).map(([type, data]) => ({
        contentType: type,
        count: data.count,
        avgScore: Math.round((data.totalScore / data.count) * 10) / 10,
      })).sort((a, b) => b.avgScore - a.avgScore)

      const platformSummary = Object.entries(byPlatform).map(([platform, data]) => ({
        platform,
        count: data.count,
        avgScore: Math.round((data.totalScore / data.count) * 10) / 10,
      })).sort((a, b) => b.avgScore - a.avgScore)

      return NextResponse.json({
        summary: {
          totalRecords: records.length,
          avgScore: Math.round((records.reduce((a, r) => a + r.performanceScore, 0) / records.length) * 10) / 10,
          topPerformer: agentSummary[0]?.agent || 'N/A',
          byAgent: agentSummary,
          byContentType: contentTypeSummary,
          byPlatform: platformSummary,
        },
        period: `${period} days`,
      })
    }

    return NextResponse.json({ records, total: records.length })
  } catch (error) {
    console.error('[PERFORMANCE] GET error:', error.message)
    return NextResponse.json({ records: [], error: error.message })
  }
}

// POST — Record content performance + auto-generate feedback for agent memory
export async function POST(request) {
  try {
    const body = await request.json()
    const {
      taskId, agent, contentType, campaign, platform,
      engagementRate, qualityScore, reachMultiplier, conversionRate, onTime,
      feedback,
    } = body

    if (!taskId || !agent) {
      return NextResponse.json({ error: 'taskId and agent are required' }, { status: 400 })
    }

    const metrics = { engagementRate, qualityScore, reachMultiplier, conversionRate, onTime }
    const performanceScore = calculatePerformanceScore(metrics)
    const insight = deriveInsight(metrics, contentType || 'content')

    const fields = {
      'Task ID': taskId,
      'Agent': agent,
      'Content Type': contentType || '',
      'Campaign': campaign || '',
      'Platform': platform || '',
      'Engagement Rate': engagementRate || 0,
      'Quality Score': qualityScore || 0,
      'Reach Multiplier': reachMultiplier || 0,
      'Conversion Rate': conversionRate || 0,
      'Performance Score': performanceScore,
      'Insight': insight,
      'Feedback': feedback || '',
    }

    const data = await airtableRequest(BASE_URL, {
      method: 'POST',
      body: JSON.stringify({ records: [{ fields }] }),
    })

    // Auto-feed insight back to agent memory (fire-and-forget)
    const memoryContent = `Performance feedback for ${contentType}: Score ${performanceScore}/100. ${insight}${feedback ? ` User feedback: ${feedback}` : ''}`
    const importance = performanceScore >= 80 ? 'High' : performanceScore >= 50 ? 'Medium' : 'Critical'

    fetch(`${request.url.replace('/content/performance', '/memory')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent,
        type: 'feedback',
        content: memoryContent,
        source: `Performance tracking - ${taskId}`,
        importance,
        taskContext: contentType || '',
      }),
    }).catch(() => {}) // Fire-and-forget

    return NextResponse.json({
      success: true,
      performanceScore,
      insight,
      record: data.records?.[0],
    })
  } catch (error) {
    console.error('[PERFORMANCE] POST error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
