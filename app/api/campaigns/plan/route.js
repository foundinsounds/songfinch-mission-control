// Campaign Planner — CMO agent autonomously generates content plans
// Uses the Impact-First Advertising Framework and Emotional Territories
// Called by cron runner (aggressive auto-planning) or manually from dashboard

import { getTasks, getAgents, addActivity, createTask, getGoals, updateGoal } from '../../../../lib/airtable'
import { callAI } from '../../../../lib/ai'
import { EMOTIONAL_TERRITORIES, FRAMEWORK_BRIEF } from '../../../../lib/framework'
import { notifyCampaignPlanned } from '../../../../lib/slack'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Vercel Pro: CMO planning can take time

const PLATFORMS = ['Instagram', 'Facebook', 'TikTok', 'Email', 'Blog', 'YouTube']

// Aggressive content mix — designed for 30+ pieces/week velocity
const CONTENT_MIX = [
  { type: 'Social Post', frequency: 5, platforms: ['Instagram', 'Facebook', 'TikTok'] },
  { type: 'Ad Copy', frequency: 4, platforms: ['Facebook', 'Instagram', 'TikTok'] },
  { type: 'Blog Post', frequency: 2, platforms: ['Blog'] },
  { type: 'Video Script', frequency: 2, platforms: ['TikTok', 'YouTube', 'Instagram'] },
  { type: 'Image', frequency: 3, platforms: ['Instagram', 'Facebook', 'TikTok'] },
  { type: 'Landing Page', frequency: 1, platforms: ['Blog'] },
  { type: 'Strategy', frequency: 1, platforms: ['Email'] },
  { type: 'Research', frequency: 1, platforms: ['Blog'] },
]

// Planning thresholds — keep the pipeline FULL
const MIN_PIPELINE_TASKS = 20 // Skip planning if 20+ non-Done tasks exist
const TASKS_PER_PLAN = 12     // Generate 10-12 tasks per planning cycle
const MAX_TASKS_PER_PLAN = 15 // Hard cap per plan

// ---- GOAL FREQUENCY ENGINE ----
// Determines if a goal is "due" based on its frequency and last triggered date

const FREQUENCY_MS = {
  'Daily': 1 * 24 * 60 * 60 * 1000,
  'Weekly': 7 * 24 * 60 * 60 * 1000,
  'Biweekly': 14 * 24 * 60 * 60 * 1000,
  'Monthly': 30 * 24 * 60 * 60 * 1000,
  'Quarterly': 90 * 24 * 60 * 60 * 1000,
}

function isGoalDue(goal) {
  if (goal.status !== 'Active') return false
  if (!goal.lastTriggered) return true // Never triggered = always due

  const lastTime = new Date(goal.lastTriggered).getTime()
  const intervalMs = FREQUENCY_MS[goal.frequency] || FREQUENCY_MS['Weekly']
  const now = Date.now()

  return (now - lastTime) >= intervalMs
}

async function fetchDueGoals() {
  try {
    const goals = await getGoals({ noCache: true, status: 'Active' })
    return goals.filter(isGoalDue)
  } catch (err) {
    console.warn('[PLANNER] Failed to fetch goals:', err.message)
    return []
  }
}

function buildGoalDirectives(dueGoals) {
  if (dueGoals.length === 0) return ''

  const lines = dueGoals.map(g => {
    const parts = [`- **${g.name}**`]
    if (g.agent) parts.push(`(Assigned to: ${g.agent})`)
    if (g.contentType && g.contentType !== 'General') parts.push(`[${g.contentType}]`)
    if (g.frequency) parts.push(`Frequency: ${g.frequency}`)
    if (g.description) parts.push(`\n  Brief: ${g.description}`)
    return parts.join(' ')
  })

  return `\n## Standing Goals (MUST generate tasks for these)\nThese are active standing objectives that are DUE for content generation.\nYou MUST create at least one task per goal below. These take priority.\n\n${lines.join('\n')}\n`
}

export async function POST(request) {
  const startTime = Date.now()

  try {
    const body = await request.json().catch(() => ({}))
    const weeksAhead = body.weeksAhead || 2
    const campaignName = body.campaign || generateCampaignName()

    // Fetch current state + active goals in parallel
    const [tasks, agents, dueGoals] = await Promise.all([
      getTasks({ noCache: true }),
      getAgents({ noCache: true }),
      fetchDueGoals(),
    ])

    // Find CMO agent
    const cmo = agents.find(a => a.name === 'CMO')
    if (!cmo) {
      return NextResponse.json({ error: 'CMO agent not found' }, { status: 404 })
    }

    // Check pipeline health — only skip if we have a FULL pipeline
    const activeTasks = tasks.filter(t => t.status !== 'Done')
    const inboxOrAssigned = tasks.filter(t => t.status === 'Inbox' || t.status === 'Assigned')

    if (activeTasks.length >= MIN_PIPELINE_TASKS && inboxOrAssigned.length >= 8) {
      return NextResponse.json({
        message: `Pipeline healthy: ${activeTasks.length} active tasks, ${inboxOrAssigned.length} in queue. Skipping auto-plan.`,
        activeTasks: activeTasks.length,
        queuedTasks: inboxOrAssigned.length,
        skipped: true,
      })
    }

    // Get recent completed tasks for context (avoid duplicates)
    const recentDone = tasks
      .filter(t => t.status === 'Done')
      .slice(0, 15)
      .map(t => `- ${t.name} (${t.contentType}, ${t.platform || 'no platform'})`)
      .join('\n')

    // Get existing active tasks to avoid overlap
    const existingActive = activeTasks
      .map(t => `- ${t.name} (${t.contentType}, ${t.status})`)
      .join('\n')

    // Build emotional territories string from framework module
    const territoriesStr = EMOTIONAL_TERRITORIES
      .map(t => `- **${t.name}**: ${t.hooks.join(', ')} → "${t.insight}"`)
      .join('\n')

    // Build goal directives for the prompt
    const goalDirectives = buildGoalDirectives(dueGoals)
    if (dueGoals.length > 0) {
      console.log(`[PLANNER] ${dueGoals.length} goals due: ${dueGoals.map(g => g.name).join(', ')}`)
    }

    // Ask CMO to generate a content plan
    const planPrompt = buildPlanPrompt({
      campaignName,
      weeksAhead,
      recentDone,
      existingActive,
      contentMix: CONTENT_MIX,
      territories: territoriesStr,
      platforms: PLATFORMS,
      tasksNeeded: Math.max(TASKS_PER_PLAN, MIN_PIPELINE_TASKS - activeTasks.length),
      goalDirectives,
    })

    const planOutput = await callAI({
      model: cmo.model || 'claude-sonnet-4-6',
      temperature: 0.8,
      systemPrompt: cmo.systemPrompt || `You are CMO, the Chief Marketing Officer for Songfinch. ${FRAMEWORK_BRIEF}`,
      userPrompt: planPrompt,
    })

    // Parse the plan into tasks
    const plannedTasks = parsePlan(planOutput)

    if (plannedTasks.length === 0) {
      return NextResponse.json({
        message: 'CMO generated a plan but no tasks could be parsed',
        rawPlan: planOutput.substring(0, 2000),
      })
    }

    // DEDUPLICATION: Filter out tasks too similar to existing ones
    // IMPORTANT: Only dedup against ACTIVE tasks + recent Done (last 7 days).
    // Old Done tasks should NOT block new content with similar themes —
    // otherwise the pipeline starves after completing a batch (dedup death spiral).
    const DEDUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
    const now = Date.now()
    const dedupPool = tasks.filter(t => {
      if (t.status !== 'Done') return true // Always dedup against active tasks
      // For Done tasks, only include recent ones (last 7 days)
      if (t.completedAt) {
        return (now - new Date(t.completedAt).getTime()) < DEDUP_WINDOW_MS
      }
      if (t.createdAt) {
        return (now - new Date(t.createdAt).getTime()) < DEDUP_WINDOW_MS
      }
      return false // No date info = old task, skip from dedup
    })
    const existingNames = dedupPool.map(t => t.name?.toLowerCase().trim()).filter(Boolean)
    console.log(`[PLANNER] Dedup pool: ${existingNames.length} tasks (${dedupPool.filter(t => t.status !== 'Done').length} active + ${dedupPool.filter(t => t.status === 'Done').length} recent Done) out of ${tasks.length} total`)

    const deduped = plannedTasks.filter(task => {
      const newName = task.name?.toLowerCase().trim()
      if (!newName) return false

      for (const existing of existingNames) {
        // Exact match
        if (newName === existing) {
          console.log(`[PLANNER] Dedup: exact match "${task.name}" — skipping`)
          return false
        }
        // High similarity (>80% character overlap via normalized Levenshtein)
        if (stringSimilarity(newName, existing) > 0.8) {
          console.log(`[PLANNER] Dedup: fuzzy match "${task.name}" ≈ "${existing}" — skipping`)
          return false
        }
        // Same content type + platform + scheduled date = likely duplicate concept
        if (task.contentType && task.platform && task.scheduledDate) {
          const existingTask = dedupPool.find(t => t.name?.toLowerCase().trim() === existing)
          if (existingTask &&
              existingTask.contentType === task.contentType &&
              existingTask.platform === task.platform &&
              existingTask.scheduledDate === task.scheduledDate &&
              stringSimilarity(newName, existing) > 0.5) {
            console.log(`[PLANNER] Dedup: same type/platform/date "${task.name}" — skipping`)
            return false
          }
        }
      }
      return true
    })

    const dupCount = plannedTasks.length - deduped.length
    if (dupCount > 0) {
      console.log(`[PLANNER] Deduplication removed ${dupCount} of ${plannedTasks.length} planned tasks (${deduped.length} survived)`)
    }

    // Create tasks in Airtable
    const created = []
    for (const task of deduped) {
      try {
        // Build rich description with metadata and framework context
        const metaParts = []
        if (campaignName) metaParts.push(`Campaign: ${campaignName}`)
        if (task.platform) metaParts.push(`Platform: ${task.platform}`)
        if (task.territory) metaParts.push(`Territory: ${task.territory}`)
        if (task.insight) metaParts.push(`Insight: ${task.insight}`)
        if (task.variant) metaParts.push(`Variant: ${task.variant}`)
        if (task.scheduledDate) metaParts.push(`Scheduled: ${task.scheduledDate}`)

        const fullDescription = metaParts.length > 0
          ? `${task.description}\n\n---\n${metaParts.join(' | ')}`
          : task.description

        // Core fields
        const fields = {
          'Task Name': task.name,
          'Description': fullDescription,
          'Status': 'Inbox',
          'Content Type': task.contentType,
          'Priority': task.priority || 'Medium',
        }

        // Try adding optional fields — retry without if Airtable 422s
        const optionalFields = {}
        if (task.scheduledDate) optionalFields['Scheduled Date'] = task.scheduledDate
        if (campaignName) optionalFields['Campaign'] = campaignName

        try {
          await createTask({ ...fields, ...optionalFields })
        } catch (optErr) {
          console.warn(`[PLANNER] Retry without optional fields for "${task.name}":`, optErr.message)
          await createTask(fields)
        }

        created.push(task)
      } catch (err) {
        console.warn(`[PLANNER] Failed to create task "${task.name}":`, err.message)
      }
    }

    // Update goal tracking — mark goals as triggered and increment task count
    if (dueGoals.length > 0 && created.length > 0) {
      const now = new Date().toISOString().split('T')[0]
      await Promise.all(
        dueGoals.map(goal =>
          updateGoal(goal.id, {
            'Last Triggered': now,
            'Tasks Generated': (goal.tasksGenerated || 0) + created.length,
          }).catch(err => {
            console.warn(`[PLANNER] Failed to update goal "${goal.name}":`, err.message)
          })
        )
      )
      console.log(`[PLANNER] Updated ${dueGoals.length} goals: ${dueGoals.map(g => g.name).join(', ')}`)
    }

    // Log activity
    await addActivity({
      'Agent': 'CMO',
      'Action': 'planned campaign',
      'Task': campaignName,
      'Details': `Auto-generated ${created.length} content tasks for ${weeksAhead} week(s). Campaign: ${campaignName}. Pipeline: ${activeTasks.length} active → ${activeTasks.length + created.length} active.`,
      'Type': 'Content Generated',
    }).catch(() => {})

    // Slack notification for campaign planning
    const contentTypesCreated = [...new Set(created.map(t => t.contentType).filter(Boolean))]
    const territoriesCreated = [...new Set(created.map(t => {
      const m = t.description?.match(/Territory:\s*(Celebration|Gratitude|Memory|Identity|Tribute)/i)
      return m ? m[1] : null
    }).filter(Boolean))]

    notifyCampaignPlanned({
      campaign: campaignName,
      tasksCreated: created.length,
      contentTypes: contentTypesCreated,
      territories: territoriesCreated,
    }).catch(() => {})

    return NextResponse.json({
      message: `CMO planned ${created.length} tasks for "${campaignName}"`,
      campaign: campaignName,
      tasksCreated: created.length,
      tasks: created,
      goalsTriggered: dueGoals.map(g => ({ name: g.name, frequency: g.frequency, agent: g.agent })),
      pipelineHealth: {
        before: activeTasks.length,
        after: activeTasks.length + created.length,
        queued: inboxOrAssigned.length + created.length,
      },
      duration: `${Date.now() - startTime}ms`,
    })

  } catch (err) {
    console.error('[PLANNER] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Also support GET for easy manual trigger
export async function GET(request) {
  return POST(request)
}

function generateCampaignName() {
  const now = new Date()
  const weekNum = getWeekNumber(now)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[now.getMonth()]} Week ${weekNum} Impact`
}

function getWeekNumber(date) {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
  return Math.ceil((date.getDate() + startOfMonth.getDay()) / 7)
}

function buildPlanPrompt({ campaignName, weeksAhead, recentDone, existingActive, contentMix, territories, platforms, tasksNeeded, goalDirectives }) {
  const today = new Date()
  const dates = []
  for (let i = 1; i <= 7 * weeksAhead; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    if (d.getDay() !== 0) { // skip sundays
      dates.push(d.toISOString().split('T')[0])
    }
  }

  return `# Impact-First Content Calendar

## ${FRAMEWORK_BRIEF}

## Campaign: ${campaignName}
Generate ${tasksNeeded} content tasks for the next ${weeksAhead} week(s).

## THE NARRATIVE LADDER (every task brief MUST reference this)
Every piece of content MUST follow this exact sequence:
1. EMOTIONAL MOMENT — the feeling appears first
2. HUMAN INSIGHT — the universal truth behind the feeling
3. IMPACT / TRANSFORMATION — what the experience unlocks
4. SONGFINCH — appears LAST as the mechanism that made the moment possible

## Emotional Territories (rotate through ALL of these)
${territories}

## Available Dates
${dates.join(', ')}

## Content Mix Target (per week)
${contentMix.map(c => `- ${c.type}: ${c.frequency}x/week → Platforms: ${c.platforms.join(', ')}`).join('\n')}

${goalDirectives || ''}
## Recently Completed (DO NOT duplicate these)
${recentDone || '(none yet)'}

## Currently Active (DO NOT duplicate these)
${existingActive || '(nothing active)'}

## Planning Instructions
1. Create ${tasksNeeded} specific, emotionally-driven content tasks
2. Each task brief MUST specify which EMOTIONAL TERRITORY it targets
3. Each task brief MUST include the HUMAN INSIGHT driving the content
4. Task names should be specific and evocative, NOT generic (e.g. "The Voicemail She Never Deleted" not "Social Post about Memory")
5. Rotate through ALL 5 emotional territories — don't cluster on one
6. Mix content types according to the content mix target
7. Consider seasonal/timely hooks for this time of year
8. Include a mix of platforms — especially Instagram, TikTok, Facebook
9. Vary priorities: some High (timely/urgent), mostly Medium, a few Low (evergreen)
10. Task descriptions should be rich creative briefs, not one-liners

## A/B TESTING (IMPORTANT)
For 2-3 of the Ad Copy tasks, create A/B variant PAIRS. These should:
- Share the same core insight and territory
- Have DIFFERENT hooks, angles, or emotional entry points
- Be named with "[A]" and "[B]" suffixes (e.g. "The Gift That Spoke [A]", "The Gift That Spoke [B]")
- Have the same scheduledDate and platform
- Include "variant":"A" or "variant":"B" in the JSON
- Description should note what's being tested (hook angle, CTA style, emotional intensity, etc.)

## Output Format
You MUST respond with ONLY a raw JSON array — no markdown, no code fences, no explanation. Start with [ and end with ].

Each object:
{"name":"Evocative task name","description":"Rich creative brief with emotional territory, human insight, and direction","contentType":"Social Post","scheduledDate":"YYYY-MM-DD","platform":"Instagram","territory":"Celebration","insight":"The biggest moments deserve more than a card","priority":"Medium","variant":null}

Valid contentType: Social Post, Ad Copy, Blog Post, Video Script, Image, Landing Page, Strategy, Research
Valid platform: ${platforms.join(', ')}
Valid territory: Celebration, Gratitude, Memory, Identity, Tribute
Valid priority: High, Medium, Low
Valid variant: null, "A", "B"

CRITICAL: Start your response with [ and end with ]. No other text.`
}

function parsePlan(output) {
  try {
    let jsonStr = output.trim()

    // Strip markdown code fences
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
    jsonStr = jsonStr.trim()

    // Extract JSON array if there's text before/after
    const bracketStart = jsonStr.indexOf('[')
    const bracketEnd = jsonStr.lastIndexOf(']')
    if (bracketStart !== -1 && bracketEnd > bracketStart) {
      jsonStr = jsonStr.substring(bracketStart, bracketEnd + 1)
    }

    // Clean common JSON issues: trailing commas
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')

    console.log('[PLANNER] Attempting to parse JSON, length:', jsonStr.length)

    const tasks = JSON.parse(jsonStr)
    if (!Array.isArray(tasks)) {
      console.error('[PLANNER] Parsed result is not an array:', typeof tasks)
      return []
    }

    // Validate and clean each task
    const validTypes = new Set(['Ad Copy', 'Social Post', 'Video Script', 'Blog Post', 'Landing Page', 'Strategy', 'Image', 'Research', 'General'])
    const validTerritories = new Set(['Celebration', 'Gratitude', 'Memory', 'Identity', 'Tribute'])

    const result = tasks
      .filter(t => t && typeof t === 'object' && t.name && t.scheduledDate)
      .map(t => ({
        name: String(t.name).substring(0, 200),
        description: String(t.description || '').substring(0, 2000),
        contentType: validTypes.has(t.contentType) ? t.contentType : 'General',
        scheduledDate: t.scheduledDate,
        platform: t.platform || null,
        territory: validTerritories.has(t.territory) ? t.territory : null,
        insight: t.insight ? String(t.insight).substring(0, 200) : null,
        priority: ['High', 'Medium', 'Low'].includes(t.priority) ? t.priority : 'Medium',
        variant: ['A', 'B'].includes(t.variant) ? t.variant : null,
      }))
      .slice(0, MAX_TASKS_PER_PLAN)

    console.log(`[PLANNER] Parsed ${result.length} valid tasks from ${tasks.length} objects`)
    return result
  } catch (err) {
    console.error('[PLANNER] Failed to parse plan:', err.message)
    console.error('[PLANNER] Raw output (first 1000):', output.substring(0, 1000))
    return []
  }
}

// Normalized Levenshtein similarity — returns 0.0 to 1.0 (1 = identical)
function stringSimilarity(a, b) {
  if (a === b) return 1.0
  if (!a || !b) return 0.0

  const lenA = a.length
  const lenB = b.length
  if (lenA === 0 || lenB === 0) return 0.0

  // Quick length-based rejection — strings differing by >60% length can't be >80% similar
  if (Math.abs(lenA - lenB) / Math.max(lenA, lenB) > 0.6) return 0.0

  // Levenshtein distance via two-row DP
  let prev = Array.from({ length: lenB + 1 }, (_, i) => i)
  let curr = new Array(lenB + 1)

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }

  const distance = prev[lenB]
  return 1.0 - distance / Math.max(lenA, lenB)
}
