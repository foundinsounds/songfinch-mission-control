// Content Freshness Tracker — Monitors content age and suggests refresh cycles
// Detects: aging content, stale campaigns, content types going dark
// Triggers: auto-refresh suggestions when content exceeds freshness thresholds

import { NextResponse } from 'next/server'
import { getTasks, getGoals } from '../../../../lib/airtable'

export const dynamic = 'force-dynamic'

const DAY_MS = 86400000

// Max age before content is considered stale (days)
const FRESHNESS_THRESHOLDS = {
  'Social Media Post': 3,
  'Ad Copy': 7,
  'Email Newsletter': 14,
  'Blog Post': 30,
  'Landing Page': 60,
  'Product Description': 45,
  'Video Script': 30,
  'Case Study': 90,
  'Press Release': 60,
  'SEO Article': 45,
  default: 30,
}

function analyzeContentFreshness(tasks) {
  const now = Date.now()
  const doneTasks = tasks.filter(t => t.status === 'Done')

  // Group by content type
  const byType = {}
  doneTasks.forEach(t => {
    const ct = t.contentType || 'Unknown'
    if (!byType[ct]) byType[ct] = []
    byType[ct].push(t)
  })

  const freshnessReport = []
  const refreshSuggestions = []

  Object.entries(byType).forEach(([contentType, items]) => {
    const threshold = FRESHNESS_THRESHOLDS[contentType] || FRESHNESS_THRESHOLDS.default

    // Sort by date (newest first)
    const sorted = items
      .map(t => ({
        name: t.name,
        agent: t.agent,
        campaign: t.campaign,
        completedAt: t.completedAt || t.createdAt,
        ageInDays: t.completedAt || t.createdAt
          ? Math.round((now - new Date(t.completedAt || t.createdAt).getTime()) / DAY_MS)
          : null,
      }))
      .filter(t => t.ageInDays !== null)
      .sort((a, b) => a.ageInDays - b.ageInDays)

    const newestAge = sorted.length > 0 ? sorted[0].ageInDays : null
    const oldestAge = sorted.length > 0 ? sorted[sorted.length - 1].ageInDays : null
    const avgAge = sorted.length > 0
      ? Math.round(sorted.reduce((s, t) => s + t.ageInDays, 0) / sorted.length)
      : null

    const fresh = sorted.filter(t => t.ageInDays <= threshold)
    const stale = sorted.filter(t => t.ageInDays > threshold)
    const critical = sorted.filter(t => t.ageInDays > threshold * 2)

    const freshness = newestAge !== null
      ? newestAge <= threshold ? 'fresh' : newestAge <= threshold * 1.5 ? 'aging' : 'stale'
      : 'unknown'

    freshnessReport.push({
      contentType,
      threshold,
      freshness,
      total: sorted.length,
      freshCount: fresh.length,
      staleCount: stale.length,
      criticalCount: critical.length,
      newestAge,
      oldestAge,
      avgAge,
      newestItem: sorted[0] || null,
    })

    // Generate refresh suggestions for stale types
    if (stale.length > 0 && (freshness === 'stale' || freshness === 'aging')) {
      const daysSinceLastFresh = newestAge || threshold
      const urgency = daysSinceLastFresh > threshold * 2 ? 'high' : daysSinceLastFresh > threshold ? 'medium' : 'low'

      refreshSuggestions.push({
        contentType,
        urgency,
        daysSinceLastFresh,
        threshold,
        staleItems: stale.length,
        message: `"${contentType}" needs refresh — newest is ${newestAge}d old (threshold: ${threshold}d)`,
        suggestion: `Create new ${contentType} content to maintain freshness`,
        topStaleItems: stale.slice(0, 3).map(t => ({
          name: t.name,
          age: t.ageInDays,
          campaign: t.campaign,
        })),
      })
    }
  })

  return {
    report: freshnessReport.sort((a, b) => {
      const order = { stale: 0, aging: 1, fresh: 2, unknown: 3 }
      return (order[a.freshness] ?? 4) - (order[b.freshness] ?? 4)
    }),
    suggestions: refreshSuggestions.sort((a, b) => {
      const u = { high: 0, medium: 1, low: 2 }
      return (u[a.urgency] ?? 3) - (u[b.urgency] ?? 3)
    }),
  }
}

function detectContentGaps(freshnessReport, goals) {
  const gaps = []
  const activeGoals = goals.filter(g => g.status === 'Active')
  const goalTypes = new Set(activeGoals.map(g => g.contentType).filter(Boolean))
  const reportTypes = new Set(freshnessReport.map(r => r.contentType))

  // Types in goals but never produced
  goalTypes.forEach(type => {
    if (!reportTypes.has(type)) {
      gaps.push({
        type: 'never_produced',
        severity: 'high',
        contentType: type,
        message: `"${type}" is an active goal but has never been produced`,
      })
    }
  })

  // Types produced but no active goal (may go stale without automation)
  reportTypes.forEach(type => {
    if (!goalTypes.has(type) && type !== 'Unknown') {
      const report = freshnessReport.find(r => r.contentType === type)
      if (report && report.freshness !== 'fresh') {
        gaps.push({
          type: 'no_goal_coverage',
          severity: 'medium',
          contentType: type,
          message: `"${type}" has no active goal and is ${report.freshness}`,
        })
      }
    }
  })

  return gaps
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const typeFilter = searchParams.get('type')

    const [tasks, goals] = await Promise.all([
      getTasks({ noCache: true }),
      getGoals({ noCache: true }),
    ])

    const { report, suggestions } = analyzeContentFreshness(tasks)
    const gaps = detectContentGaps(report, goals)

    let filteredReport = report
    if (typeFilter) {
      filteredReport = report.filter(r =>
        r.contentType.toLowerCase().includes(typeFilter.toLowerCase())
      )
    }

    // Overall freshness score
    const totalFresh = filteredReport.reduce((s, r) => s + r.freshCount, 0)
    const totalContent = filteredReport.reduce((s, r) => s + r.total, 0)
    const overallFreshness = totalContent > 0
      ? Math.round((totalFresh / totalContent) * 100)
      : 0

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      summary: {
        overallFreshnessPercent: overallFreshness,
        contentTypes: filteredReport.length,
        freshTypes: filteredReport.filter(r => r.freshness === 'fresh').length,
        agingTypes: filteredReport.filter(r => r.freshness === 'aging').length,
        staleTypes: filteredReport.filter(r => r.freshness === 'stale').length,
        refreshSuggestions: suggestions.length,
        contentGaps: gaps.length,
      },
      contentFreshness: filteredReport,
      refreshSuggestions: suggestions,
      contentGaps: gaps,
    })
  } catch (err) {
    console.error('[FRESHNESS] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
