// Smart Content Calendar — Maps content production timeline with gap detection
// Detects: coverage gaps, overproduction periods, content type imbalances
// Projects: upcoming output based on current pipeline velocity

import { NextResponse } from 'next/server'
import { getTasks, getGoals } from '../../../../lib/airtable'

export const dynamic = 'force-dynamic'

const DAY_MS = 86400000
const WEEK_MS = DAY_MS * 7

function buildCalendar(tasks, goals) {
  const now = Date.now()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Build weekly buckets for the last 8 weeks + next 4 weeks
  const weeks = []
  for (let i = -8; i <= 3; i++) {
    const weekStart = new Date(today.getTime() + i * WEEK_MS)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // start on Sunday
    const weekEnd = new Date(weekStart.getTime() + WEEK_MS)

    weeks.push({
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      weekLabel: `W${getWeekNumber(weekStart)}`,
      isPast: weekEnd.getTime() < now,
      isCurrent: weekStart.getTime() <= now && now < weekEnd.getTime(),
      isFuture: weekStart.getTime() > now,
      completed: [],
      inProgress: [],
      planned: [],
      byContentType: {},
      byAgent: {},
      totalOutput: 0,
    })
  }

  // Place completed tasks by completion date (or created date as fallback)
  const doneTasks = tasks.filter(t => t.status === 'Done')
  doneTasks.forEach(t => {
    const date = t.completedAt ? new Date(t.completedAt).getTime()
      : t.createdAt ? new Date(t.createdAt).getTime() : 0
    if (!date) return

    const week = weeks.find(w =>
      date >= new Date(w.weekStart).getTime() && date < new Date(w.weekEnd).getTime()
    )
    if (week) {
      week.completed.push({ name: t.name, type: t.contentType, agent: t.agent })
      week.totalOutput++
      const ct = t.contentType || 'Other'
      week.byContentType[ct] = (week.byContentType[ct] || 0) + 1
      if (t.agent) week.byAgent[t.agent] = (week.byAgent[t.agent] || 0) + 1
    }
  })

  // Place in-progress tasks in current week
  const activeTasks = tasks.filter(t => ['Assigned', 'In Progress', 'Review'].includes(t.status))
  const currentWeek = weeks.find(w => w.isCurrent)
  if (currentWeek) {
    activeTasks.forEach(t => {
      currentWeek.inProgress.push({ name: t.name, type: t.contentType, agent: t.agent, status: t.status })
    })
  }

  // Project future weeks based on active goals and velocity
  const avgWeeklyOutput = computeAvgWeeklyOutput(weeks.filter(w => w.isPast))
  const activeGoals = goals.filter(g => g.status === 'Active')

  weeks.filter(w => w.isFuture).forEach(w => {
    activeGoals.forEach(g => {
      const shouldFire = shouldGoalFire(g, w.weekStart)
      if (shouldFire) {
        w.planned.push({ goal: g.name, type: g.contentType, campaign: g.campaign })
        const ct = g.contentType || 'Other'
        w.byContentType[ct] = (w.byContentType[ct] || 0) + 1
      }
    })
    w.totalOutput = w.planned.length || avgWeeklyOutput
  })

  return { weeks, avgWeeklyOutput }
}

function shouldGoalFire(goal, weekStartStr) {
  switch (goal.frequency) {
    case 'Daily': return true
    case 'Weekly': return true
    case 'Bi-Weekly': {
      const weekNum = getWeekNumber(new Date(weekStartStr))
      return weekNum % 2 === 0
    }
    case 'Monthly': {
      const d = new Date(weekStartStr)
      return d.getDate() <= 7 // first week of month
    }
    default: return true
  }
}

function computeAvgWeeklyOutput(pastWeeks) {
  const nonEmpty = pastWeeks.filter(w => w.totalOutput > 0)
  if (nonEmpty.length === 0) return 0
  return Math.round((nonEmpty.reduce((s, w) => s + w.totalOutput, 0) / nonEmpty.length) * 10) / 10
}

function getWeekNumber(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const yearStart = new Date(d.getFullYear(), 0, 4)
  return Math.ceil((((d - yearStart) / DAY_MS) + yearStart.getDay() + 1) / 7)
}

function detectGaps(weeks, goals) {
  const gaps = []
  const pastWeeks = weeks.filter(w => w.isPast)

  // 1. Production gaps — weeks with zero output
  pastWeeks.forEach(w => {
    if (w.totalOutput === 0) {
      gaps.push({
        type: 'production_gap',
        severity: 'high',
        week: w.weekLabel,
        weekStart: w.weekStart,
        message: `No content produced in ${w.weekLabel} (${w.weekStart})`,
      })
    }
  })

  // 2. Content type gaps — types not covered recently
  const allContentTypes = [...new Set(goals.map(g => g.contentType).filter(Boolean))]
  const recentWeeks = pastWeeks.slice(-4) // last 4 weeks
  const recentTypes = new Set()
  recentWeeks.forEach(w => Object.keys(w.byContentType).forEach(ct => recentTypes.add(ct)))

  allContentTypes.forEach(ct => {
    if (!recentTypes.has(ct)) {
      gaps.push({
        type: 'content_type_gap',
        severity: 'medium',
        contentType: ct,
        message: `No "${ct}" content produced in the last 4 weeks`,
      })
    }
  })

  // 3. Velocity drops — significant week-over-week decline
  for (let i = 1; i < pastWeeks.length; i++) {
    const prev = pastWeeks[i - 1].totalOutput
    const curr = pastWeeks[i].totalOutput
    if (prev > 0 && curr < prev * 0.5 && prev >= 3) {
      gaps.push({
        type: 'velocity_drop',
        severity: 'medium',
        week: pastWeeks[i].weekLabel,
        message: `Output dropped ${Math.round((1 - curr / prev) * 100)}% in ${pastWeeks[i].weekLabel} (${curr} vs ${prev})`,
      })
    }
  }

  // 4. Agent coverage gaps — agents not producing recently
  const recentAgents = new Set()
  recentWeeks.forEach(w => Object.keys(w.byAgent).forEach(a => recentAgents.add(a)))
  const allAgents = new Set()
  pastWeeks.forEach(w => Object.keys(w.byAgent).forEach(a => allAgents.add(a)))

  allAgents.forEach(agent => {
    if (!recentAgents.has(agent)) {
      gaps.push({
        type: 'agent_inactive',
        severity: 'low',
        agent,
        message: `${agent} has not produced content in the last 4 weeks`,
      })
    }
  })

  // 5. Overproduction warning — spikes that may indicate quality issues
  const avgOutput = computeAvgWeeklyOutput(pastWeeks)
  pastWeeks.forEach(w => {
    if (w.totalOutput > avgOutput * 2.5 && avgOutput >= 2) {
      gaps.push({
        type: 'overproduction',
        severity: 'low',
        week: w.weekLabel,
        message: `Unusually high output in ${w.weekLabel} (${w.totalOutput} vs avg ${avgOutput}) — check quality`,
      })
    }
  })

  return gaps.sort((a, b) => {
    const sev = { high: 3, medium: 2, low: 1 }
    return (sev[b.severity] || 0) - (sev[a.severity] || 0)
  })
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const weeksBack = parseInt(searchParams.get('weeks') || '8')
    const contentTypeFilter = searchParams.get('type')

    const [tasks, goals] = await Promise.all([
      getTasks({ noCache: true }),
      getGoals({ noCache: true }),
    ])

    const { weeks, avgWeeklyOutput } = buildCalendar(tasks, goals)
    const gaps = detectGaps(weeks, goals)

    // Apply content type filter if provided
    let filteredWeeks = weeks
    if (contentTypeFilter) {
      filteredWeeks = weeks.map(w => ({
        ...w,
        completed: w.completed.filter(t => t.type === contentTypeFilter),
        inProgress: w.inProgress.filter(t => t.type === contentTypeFilter),
        planned: w.planned.filter(t => t.type === contentTypeFilter),
        totalOutput: (w.byContentType[contentTypeFilter] || 0),
      }))
    }

    // Condensed timeline view
    const timeline = filteredWeeks.map(w => ({
      week: w.weekLabel,
      start: w.weekStart,
      status: w.isCurrent ? 'current' : w.isPast ? 'past' : 'projected',
      output: w.totalOutput,
      completed: w.completed.length,
      inProgress: w.inProgress.length,
      planned: w.planned.length,
      contentTypes: w.byContentType,
      topAgent: Object.entries(w.byAgent).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    }))

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      summary: {
        avgWeeklyOutput,
        totalGaps: gaps.length,
        highSeverityGaps: gaps.filter(g => g.severity === 'high').length,
        activeGoals: goals.filter(g => g.status === 'Active').length,
        projectedNextWeek: filteredWeeks.find(w => w.isFuture)?.totalOutput || 0,
      },
      timeline,
      gaps,
      details: filteredWeeks,
    })
  } catch (err) {
    console.error('[CALENDAR] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
