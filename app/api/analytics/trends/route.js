// Analytics Trends — Quality scores, velocity, and throughput over time
// Returns daily/weekly aggregated data for dashboard charts and trend analysis

import { NextResponse } from 'next/server'
import { getTasks, getAllActivity } from '../../../../lib/airtable'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90)
    const granularity = searchParams.get('granularity') || 'daily' // daily | weekly

    const [tasks, activity] = await Promise.all([
      getTasks({ noCache: true }),
      getAllActivity(),
    ])

    const now = Date.now()
    const cutoff = now - days * 86400000

    // ---- QUALITY TRENDS ----
    // Extract scores from approval activities
    const approvals = activity.filter(a =>
      a.action === 'approved' && a.details && new Date(a.timestamp).getTime() > cutoff
    )

    const qualityByDay = {}
    approvals.forEach(a => {
      const day = bucketDate(a.timestamp, granularity)
      if (!qualityByDay[day]) qualityByDay[day] = { scores: [], count: 0 }
      const match = a.details.match(/\((\d+\.?\d*)\/5\)/)
      if (match) {
        qualityByDay[day].scores.push(parseFloat(match[1]))
      }
      qualityByDay[day].count++
    })

    const qualityTrend = Object.entries(qualityByDay)
      .map(([date, data]) => ({
        date,
        avgScore: data.scores.length > 0
          ? Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10
          : null,
        approvalCount: data.count,
        minScore: data.scores.length > 0 ? Math.min(...data.scores) : null,
        maxScore: data.scores.length > 0 ? Math.max(...data.scores) : null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // ---- VELOCITY TRENDS ----
    // Tasks completed per time bucket
    const completionActivity = activity.filter(a =>
      (a.action === 'approved' || a.action === 'completed') &&
      new Date(a.timestamp).getTime() > cutoff
    )

    const velocityByDay = {}
    completionActivity.forEach(a => {
      const day = bucketDate(a.timestamp, granularity)
      if (!velocityByDay[day]) velocityByDay[day] = { completed: 0, revised: 0, errors: 0 }
      velocityByDay[day].completed++
    })

    // Add revision counts
    activity.filter(a =>
      a.action === 'revision requested' && new Date(a.timestamp).getTime() > cutoff
    ).forEach(a => {
      const day = bucketDate(a.timestamp, granularity)
      if (!velocityByDay[day]) velocityByDay[day] = { completed: 0, revised: 0, errors: 0 }
      velocityByDay[day].revised++
    })

    // Add error counts
    activity.filter(a =>
      (a.action === 'error' || a.action === 'pipeline_error') &&
      new Date(a.timestamp).getTime() > cutoff
    ).forEach(a => {
      const day = bucketDate(a.timestamp, granularity)
      if (!velocityByDay[day]) velocityByDay[day] = { completed: 0, revised: 0, errors: 0 }
      velocityByDay[day].errors++
    })

    const velocityTrend = Object.entries(velocityByDay)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // ---- PIPELINE FLOW ----
    // Tasks created vs completed per day to show pipeline throughput
    const creationByDay = {}
    tasks.forEach(t => {
      if (!t.createdAt || new Date(t.createdAt).getTime() < cutoff) return
      const day = bucketDate(t.createdAt, granularity)
      creationByDay[day] = (creationByDay[day] || 0) + 1
    })

    const flowTrend = []
    const allDays = new Set([...Object.keys(creationByDay), ...Object.keys(velocityByDay)])
    allDays.forEach(day => {
      flowTrend.push({
        date: day,
        created: creationByDay[day] || 0,
        completed: velocityByDay[day]?.completed || 0,
        netChange: (creationByDay[day] || 0) - (velocityByDay[day]?.completed || 0),
      })
    })
    flowTrend.sort((a, b) => a.date.localeCompare(b.date))

    // ---- CONTENT TYPE DISTRIBUTION OVER TIME ----
    const typeByDay = {}
    completionActivity.forEach(a => {
      const day = bucketDate(a.timestamp, granularity)
      // Try to find the task to get content type
      const task = tasks.find(t => t.name === a.task)
      const contentType = task?.contentType || 'Unknown'
      if (!typeByDay[day]) typeByDay[day] = {}
      typeByDay[day][contentType] = (typeByDay[day][contentType] || 0) + 1
    })

    // ---- SUMMARY STATS ----
    const allScores = approvals
      .map(a => {
        const m = a.details.match(/\((\d+\.?\d*)\/5\)/)
        return m ? parseFloat(m[1]) : null
      })
      .filter(Boolean)

    const recentScores = allScores.slice(0, Math.ceil(allScores.length / 2))
    const olderScores = allScores.slice(Math.ceil(allScores.length / 2))
    const recentAvg = recentScores.length > 0
      ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 0
    const olderAvg = olderScores.length > 0
      ? olderScores.reduce((a, b) => a + b, 0) / olderScores.length : 0

    const totalCompleted = Object.values(velocityByDay).reduce((sum, d) => sum + d.completed, 0)
    const totalRevised = Object.values(velocityByDay).reduce((sum, d) => sum + d.revised, 0)

    return NextResponse.json({
      period: `${days} days`,
      granularity,
      generatedAt: new Date().toISOString(),
      summary: {
        avgQuality: allScores.length > 0
          ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
          : null,
        qualityTrend: recentAvg > olderAvg ? 'improving' : recentAvg < olderAvg ? 'declining' : 'stable',
        totalCompleted,
        totalRevised,
        approvalRate: totalCompleted + totalRevised > 0
          ? Math.round((totalCompleted / (totalCompleted + totalRevised)) * 100)
          : null,
        dailyAvgVelocity: Math.round((totalCompleted / days) * 10) / 10,
      },
      quality: qualityTrend,
      velocity: velocityTrend,
      flow: flowTrend,
      contentTypes: typeByDay,
    })
  } catch (err) {
    console.error('[TRENDS] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function bucketDate(dateStr, granularity) {
  const d = new Date(dateStr)
  if (granularity === 'weekly') {
    // ISO week start (Monday)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d)
    monday.setDate(diff)
    return monday.toISOString().split('T')[0]
  }
  return d.toISOString().split('T')[0]
}
