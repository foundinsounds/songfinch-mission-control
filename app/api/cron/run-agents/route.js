// Agent Runner — Cron endpoint that processes tasks autonomously
// Called by Vercel Cron every 15 min or manually via dashboard
// Full pipeline: Auto-plan → Auto-assign → Process → Self-check → Auto-review → Learn
// Target: 30+ pieces of content per day

import { getActionableTasks, getAgents, updateTask, addActivity, addContent, getAllActivity, getTasksByCampaign, getCampaignNames, createTask } from '../../../../lib/airtable'
import { callAI } from '../../../../lib/ai'
import {
  sortByPriorityTier,
  assignPriorityTier,
  buildCampaignContext,
  formatCampaignContextForPrompt,
  shouldCMOPlan,
  suggestContentGaps,
  needsCreativeDirection,
  createCreativeDirectionTask,
  needsMuseQA,
} from '../../../../lib/orchestration'
import { generateImage, autoPreset, extractVisualPrompt } from '../../../../lib/hf-image'
import { uploadImage } from '../../../../lib/blob-upload'
import { generateVideo, generateVideoFromText, buildVideoPrompt } from '../../../../lib/ltx'
import { FRAMEWORK_BRIEF } from '../../../../lib/framework'
import { buildDesignContext, isFigmaConfigured } from '../../../../lib/figma'
import { notifyCronCycle, notifyPipelineAlert } from '../../../../lib/slack'
import { exportToDrive, isDriveConfigured } from '../../../../lib/drive'
import { NextResponse } from 'next/server'

// ---- AUTO-ASSIGNMENT ENGINE ----
// Maps content types and task keywords to the best agent

const AGENT_ROUTING = {
  'ad_copy': 'HOOK', 'ad copy': 'HOOK', 'Ad Copy': 'HOOK',
  'social_post': 'PULSE', 'social post': 'PULSE', 'Social Post': 'PULSE',
  'video_script': 'LENS', 'video script': 'LENS', 'Video Script': 'LENS',
  'blog_post': 'STORY', 'blog post': 'STORY', 'Blog Post': 'STORY',
  'seo': 'FLOW', 'SEO': 'FLOW',
  'landing_page': 'FLOW', 'landing page': 'FLOW', 'Landing Page': 'FLOW',
  'strategy': 'CMO', 'Strategy': 'CMO',
  'research': 'SCOUT', 'Research': 'SCOUT',
  'report': 'CHIEF', 'Report': 'CHIEF',
  'design': 'PIXEL', 'Design': 'PIXEL',
  'image': 'LENS', 'Image': 'LENS',
  'video': 'LENS', 'Video': 'LENS',
  'artist_spotlight': 'STORY', 'Artist Spotlight': 'STORY',
  'General': 'MUSE',
}

const KEYWORD_ROUTING = [
  { patterns: ['ad', 'copy', 'cta', 'headline', 'retarget', 'facebook ad', 'instagram ad'], agent: 'HOOK' },
  { patterns: ['social', 'post', 'tiktok', 'instagram', 'twitter', 'thread', 'carousel', 'reel'], agent: 'PULSE' },
  { patterns: ['video', 'script', 'storyboard', 'reel script', 'commercial'], agent: 'LENS' },
  { patterns: ['blog', 'article', 'story', 'spotlight', 'long-form', 'content write'], agent: 'STORY' },
  { patterns: ['seo', 'landing', 'page', 'conversion', 'keyword'], agent: 'FLOW' },
  { patterns: ['strategy', 'campaign', 'plan', 'quarterly', 'budget', 'audience'], agent: 'CMO' },
  { patterns: ['research', 'competitor', 'trend', 'monitor', 'intel', 'audit'], agent: 'SCOUT' },
  { patterns: ['report', 'daily', 'status', 'performance', 'pipeline'], agent: 'CHIEF' },
  { patterns: ['design', 'wireframe', 'layout', 'figma', 'mockup', 'ui', 'image', 'visual', 'graphic', 'photo'], agent: 'PIXEL' },
  { patterns: ['creative', 'brief', 'direction', 'brand'], agent: 'MUSE' },
]

// ---- WORKLOAD BALANCING ----
// Computes agent load scores and redistributes when imbalanced

function getAgentWorkloads(tasks, agents) {
  const workloads = {}
  agents.forEach(a => {
    const agentTasks = tasks.filter(t => t.agent === a.name && t.status !== 'Done')
    // "active" = only Assigned + In Progress. Review tasks are async and shouldn't
    // block the agent from picking up new work.
    const activeTasks = agentTasks.filter(t => t.status === 'Assigned' || t.status === 'In Progress')
    workloads[a.name] = {
      assigned: agentTasks.filter(t => t.status === 'Assigned').length,
      inProgress: agentTasks.filter(t => t.status === 'In Progress').length,
      review: agentTasks.filter(t => t.status === 'Review').length,
      total: activeTasks.length, // Only count active work toward WIP limits
    }
  })
  return workloads
}

const MAX_AGENT_QUEUE = 5 // Max queued tasks per agent before redistributing

// GLOBAL WIP LIMIT — Total Assigned + In Progress tasks across ALL agents.
// User target: 10-20 active tasks at any time. Set to 15 as sweet spot.
// The cron processes 8-12 tasks/cycle (every 15 min), so 15 WIP means
// roughly 1 full cycle of work queued — no more, no less.
const MAX_GLOBAL_WIP = 15

function findBestAgent(task, agents, allTasks, skillData) {
  const workloads = allTasks ? getAgentWorkloads(allTasks, agents) : null

  // Primary: content-type routing
  if (task.contentType && AGENT_ROUTING[task.contentType]) {
    const name = AGENT_ROUTING[task.contentType]
    const agent = agents.find(a => a.name === name)
    if (agent) {
      // Check if primary agent is overloaded
      if (workloads && workloads[name]?.total >= MAX_AGENT_QUEUE) {
        // Try to find a skill-aware capable alternative with lower load
        const alt = findAlternativeAgent(task, agents, workloads, name, skillData)
        if (alt) {
          console.log(`[BALANCE] ${name} overloaded (${workloads[name].total} tasks), routing "${task.name}" to ${alt}`)
          return alt
        }
      }
      return name
    }
  }

  // Secondary: keyword routing with load awareness
  const text = `${task.name} ${task.description}`.toLowerCase()
  for (const route of KEYWORD_ROUTING) {
    for (const pattern of route.patterns) {
      if (text.includes(pattern)) {
        const agent = agents.find(a => a.name === route.agent)
        if (agent) {
          if (workloads && workloads[route.agent]?.total >= MAX_AGENT_QUEUE) {
            const alt = findAlternativeAgent(task, agents, workloads, route.agent, skillData)
            if (alt) return alt
          }
          return route.agent
        }
      }
    }
  }

  return 'MUSE'
}

// Skill-aware alternative finder — prefers agents with proven quality
// at the content type when redistributing overloaded work
function findAlternativeAgent(task, agents, workloads, excludeAgent, skillData) {
  // All creative agents can potentially handle overflow
  const candidates = ['MUSE', 'STORY', 'PULSE', 'HOOK', 'FLOW', 'LENS', 'SCOUT']

  const ct = task.contentType || 'General'
  let bestAgent = null
  let bestScore = -Infinity

  for (const name of candidates) {
    if (name === excludeAgent) continue
    const agent = agents.find(a => a.name === name)
    if (!agent) continue
    const load = workloads[name]?.total || 0
    if (load >= MAX_AGENT_QUEUE) continue // Skip overloaded agents

    // Composite score: lower load is better, proven skill is a bonus
    let score = (MAX_AGENT_QUEUE - load) * 10 // Load factor (0-50)

    // Skill bonus from historical specialization data
    if (skillData?.[name]?.[ct]) {
      const skill = skillData[name][ct]
      score += (skill.avgScore || 0) * 5       // Quality bonus (0-25)
      score += (skill.approvalRate || 0) / 10   // Approval rate bonus (0-10)
      if (skill.reviews >= 3) score += 10       // Confidence bonus
    }

    if (score > bestScore) {
      bestScore = score
      bestAgent = name
    }
  }

  // Only redirect if alternative has meaningfully less load
  if (bestAgent && (workloads[bestAgent]?.total || 0) < MAX_AGENT_QUEUE - 1) {
    return bestAgent
  }
  return null
}

// Build lightweight skill lookup for routing decisions (cached per cycle)
function buildSkillLookup(tasks, activity) {
  const lookup = {} // { agentName: { contentType: { avgScore, approvalRate, reviews } } }

  const scored = activity.filter(a =>
    (a.action === 'approved' || a.action === 'revision requested') && a.details
  )

  scored.forEach(event => {
    const task = tasks.find(t => t.name === event.task)
    if (!task?.agent) return

    const ct = task.contentType || 'General'
    if (!lookup[task.agent]) lookup[task.agent] = {}
    if (!lookup[task.agent][ct]) lookup[task.agent][ct] = { scores: [], approvals: 0, reviews: 0 }

    const entry = lookup[task.agent][ct]
    entry.reviews++
    if (event.action === 'approved') entry.approvals++

    const match = event.details.match(/\((\d+\.?\d*)\/5\)/)
    if (match) entry.scores.push(parseFloat(match[1]))
  })

  // Compute averages
  Object.values(lookup).forEach(agentData => {
    Object.values(agentData).forEach(entry => {
      entry.avgScore = entry.scores.length > 0
        ? Math.round((entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length) * 10) / 10
        : null
      entry.approvalRate = entry.reviews > 0 ? Math.round((entry.approvals / entry.reviews) * 100) : null
      delete entry.scores
    })
  })

  return lookup
}

// Smart priority scoring — determines processing order for the pipeline
// Higher score = processed first. Considers: explicit priority, deadline urgency,
// age in queue (prevents starvation), and content type importance.
function priorityScore(task) {
  let score = 0

  // Explicit priority weight
  const priorityWeight = { High: 30, Medium: 15, Low: 5 }
  score += priorityWeight[task.priority] || 15

  // Deadline urgency — tasks with upcoming scheduled dates get boosted
  if (task.scheduledDate) {
    const daysUntil = (new Date(task.scheduledDate).getTime() - Date.now()) / 86400000
    if (daysUntil < 0) score += 50       // Overdue — highest urgency
    else if (daysUntil < 1) score += 40   // Due today
    else if (daysUntil < 3) score += 25   // Due within 3 days
    else if (daysUntil < 7) score += 10   // Due this week
  }

  // Age bonus — prevents tasks from sitting forever (anti-starvation)
  if (task.createdAt) {
    const ageHours = (Date.now() - new Date(task.createdAt).getTime()) / 3600000
    score += Math.min(Math.floor(ageHours / 6), 20) // +1 per 6 hours, cap at 20
  }

  // Content type importance — ads and time-sensitive content first
  const typeBoost = { 'Ad Copy': 8, 'Landing Page': 6, 'Strategy': 5, 'Social Post': 3 }
  score += typeBoost[task.contentType] || 0

  // A/B variants should be processed together — boost B variants if A exists
  if (task.name?.includes('[B]')) score += 5

  return score
}

async function autoAssignInboxTasks(tasks, agents, skillData, activity) {
  // Use Roundtable priority tiers (P1 > P2 > P3) with fallback to legacy scoring
  const inboxTasks = activity
    ? sortByPriorityTier(tasks.filter(t => t.status === 'Inbox'), activity)
    : tasks.filter(t => t.status === 'Inbox').sort((a, b) => priorityScore(b) - priorityScore(a))
  const assigned = []

  // GLOBAL WIP CHECK — Stop assigning once we hit the cap.
  // Count current active tasks (Assigned + In Progress) before assigning more.
  const currentWIP = tasks.filter(t => t.status === 'Assigned' || t.status === 'In Progress').length

  if (currentWIP >= MAX_GLOBAL_WIP) {
    console.log(`[RUNNER] Global WIP at ${currentWIP}/${MAX_GLOBAL_WIP} — skipping auto-assign (${inboxTasks.length} inbox tasks waiting)`)
    return assigned
  }

  // Only assign enough to reach the WIP cap, not all inbox tasks
  const slotsAvailable = MAX_GLOBAL_WIP - currentWIP

  for (const task of inboxTasks.slice(0, slotsAvailable)) {
    const agentName = task.agent || findBestAgent(task, agents, tasks, skillData)
    try {
      await updateTask(task.id, { 'Status': 'Assigned', 'Agent': agentName })
      await addActivity({
        'Agent': 'Council',
        'Action': 'auto-assigned',
        'Task': task.name,
        'Details': `Auto-assigned to ${agentName} (WIP ${currentWIP + assigned.length + 1}/${MAX_GLOBAL_WIP}). Content type: ${task.contentType || 'keyword match'}`,
        'Type': 'Task Created',
      })
      assigned.push({ task: task.name, agent: agentName })
      task.status = 'Assigned'
      task.agent = agentName
    } catch (err) {
      console.warn(`[RUNNER] Failed to auto-assign "${task.name}":`, err.message)
    }
  }

  if (inboxTasks.length > slotsAvailable) {
    console.log(`[RUNNER] WIP cap: assigned ${assigned.length}/${inboxTasks.length} inbox tasks (${inboxTasks.length - slotsAvailable} held back)`)
  }

  return assigned
}

// ---- INTERNAL FETCH HELPER ----
// Vercel serverless self-fetch is fragile: VERCEL_URL may be a preview/deployment URL,
// not the production domain. Use VERCEL_PROJECT_PRODUCTION_URL first (guaranteed production),
// then fall back through other options. Add timeout to prevent hanging.

function getBaseUrl() {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

async function internalFetch(path, options = {}) {
  const url = `${getBaseUrl()}${path}`
  const timeout = options.timeout || 120000 // 2 min default, up from Node default
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

// ---- MEMORY HELPERS ----

async function getAgentMemories(agentName, taskContext = {}) {
  try {
    const params = new URLSearchParams({
      agent: agentName,
      ranked: 'true',
      limit: '10',
    })
    // Context-aware retrieval: pass task details for relevance scoring
    if (taskContext.contentType) params.set('contentType', taskContext.contentType)
    if (taskContext.query) params.set('query', taskContext.query)
    if (taskContext.territory) params.set('territory', taskContext.territory)

    const res = await internalFetch(`/api/memory?${params.toString()}`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.memories || []
  } catch {
    return []
  }
}

// Count past error events for a task from the activity feed (durable retry tracking)
async function countTaskErrors(taskName) {
  try {
    const { getAllActivity } = await import('../../../../lib/airtable')
    const activity = await getAllActivity()
    return activity.filter(a => a.action === 'error' && a.task === taskName).length
  } catch {
    return 0 // Fail open — assume no prior errors
  }
}

async function saveMemory({ agent, type, content, source, importance, taskContext }) {
  try {
    await internalFetch(`/api/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, type, content, source, importance, taskContext }),
    })
  } catch {
    // Non-critical
  }
}

// ---- AUTO-REVIEW TRIGGER ----

async function triggerAutoReview() {
  try {
    const res = await internalFetch(`/api/review/auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 25 }),
      timeout: 180000, // 3 min — reviews can be slow with MUSE QA gate
    })
    const data = await res.json()
    return data
  } catch (err) {
    console.warn('[RUNNER] Auto-review trigger failed:', err.message)
    return null
  }
}

// ---- AGGRESSIVE PLANNING ----

async function triggerAggressivePlanning(tasks, activity) {
  const now = new Date()
  const twoWeeksOut = new Date(now)
  twoWeeksOut.setDate(twoWeeksOut.getDate() + 14)

  // Count tasks in the WORKING pipeline (Inbox + Assigned + In Progress).
  // Review tasks are async — they shouldn't slow down new content creation.
  const workingTasks = tasks.filter(t => t.status === 'Inbox' || t.status === 'Assigned' || t.status === 'In Progress')
  const inboxOrAssigned = tasks.filter(t => t.status === 'Inbox' || t.status === 'Assigned')
  const reviewCount = tasks.filter(t => t.status === 'Review').length

  // Roundtable v4.0: Use orchestration-level intelligence on whether CMO should plan
  const orchestrationSaysPlan = shouldCMOPlan(tasks)

  // WIP-AWARE PLANNING: Only create new tasks when the pipeline is running low.
  // With MAX_GLOBAL_WIP = 15, plan when Inbox is nearly empty so the WIP cap
  // has room to pull tasks through. Don't flood Inbox with hundreds of briefs.
  const inboxCount = tasks.filter(t => t.status === 'Inbox').length
  const activeWIP = tasks.filter(t => t.status === 'Assigned' || t.status === 'In Progress').length

  // Skip planning if we still have a healthy Inbox buffer OR WIP is at capacity
  if (!orchestrationSaysPlan && (inboxCount >= 10 || activeWIP >= MAX_GLOBAL_WIP)) {
    console.log(`[RUNNER] Pipeline stocked: ${inboxCount} inbox, ${activeWIP} active WIP (cap ${MAX_GLOBAL_WIP}), ${reviewCount} review. Skipping plan.`)
    return null
  }

  try {
    console.log(`[RUNNER] Pipeline needs fuel: ${inboxCount} inbox, ${activeWIP} active WIP, ${reviewCount} review, orchestration=${orchestrationSaysPlan}. Triggering CMO planner...`)

    // Roundtable v4.0: Inject content gap analysis into planning context
    let gapContext = ''
    if (activity) {
      const gaps = suggestContentGaps(tasks, activity)
      if (gaps.length > 0) {
        gapContext = gaps.map(g => `${g.type}: ${g.gap} (${g.count} existing)`).join('; ')
        console.log(`[RUNNER] Content gaps detected: ${gapContext}`)
      }
    }

    console.log(`[RUNNER] Calling plan endpoint at: ${getBaseUrl()}/api/campaigns/plan`)
    const planRes = await internalFetch(`/api/campaigns/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weeksAhead: 2, // Always plan 2 weeks ahead
        contentGaps: gapContext || undefined,
      }),
      timeout: 180000, // 3 min — CMO planning involves AI calls
    })
    if (!planRes.ok) {
      const errText = await planRes.text().catch(() => 'unknown')
      console.warn(`[RUNNER] Plan endpoint returned ${planRes.status}: ${errText.slice(0, 200)}`)
      return null
    }
    const planData = await planRes.json()
    if (planData.tasksCreated > 0) {
      console.log(`[RUNNER] CMO planned ${planData.tasksCreated} new tasks for "${planData.campaign}"`)
    }
    return planData
  } catch (planErr) {
    console.warn('[RUNNER] Campaign planner failed:', planErr.message)
    return null
  }
}

// ---- MUSE CREATIVE DIRECTION AUTO-CREATION ----
// Roundtable v4.0: Two-Stage Brief — After CMO plans strategy, MUSE adds creative direction

async function autoCreateCreativeDirection(tasks, activity) {
  const created = []
  try {
    const campaignNames = [...new Set(tasks.filter(t => t.campaign).map(t => t.campaign))]

    for (const campaign of campaignNames) {
      if (needsCreativeDirection(campaign, activity)) {
        // Find the most recent CMO brief for this campaign
        const cmoBriefs = activity.filter(a =>
          a.agent === 'CMO' && a.task?.includes(campaign) &&
          (a.action === 'completed' || a.action === 'generated')
        )
        const latestBrief = cmoBriefs[0]?.details || `Strategy brief for ${campaign}`

        const taskFields = createCreativeDirectionTask(campaign, latestBrief)
        await createTask(taskFields)
        await addActivity({
          'Agent': 'Council',
          'Action': 'creative-direction-queued',
          'Task': taskFields['Task Name'],
          'Details': `Two-stage brief: MUSE creative direction auto-created for campaign "${campaign}"`,
          'Type': 'Task Created',
        })
        created.push({ campaign, task: taskFields['Task Name'] })
        console.log(`[RUNNER] 🎨 Created MUSE creative direction task for "${campaign}"`)
      }
    }
  } catch (err) {
    console.warn('[RUNNER] Creative direction auto-creation failed:', err.message)
  }
  return created
}

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Vercel Pro: up to 300s for sequential AI calls

/**
 * Verify cron authorization
 */
function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true

  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${cronSecret}`) return true

  const url = new URL(request.url)
  if (url.searchParams.get('key') === cronSecret) return true

  return false
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const results = { processed: [], skipped: [], errors: [], autoAssigned: [], reviewResults: null, planResults: null }

  try {
    // 1. Fetch tasks, agents, and activity history in parallel
    // Activity is now top-level — used by priority tiers, campaign context, and planning
    const [tasks, agents, activity] = await Promise.all([
      getActionableTasks({ noCache: true }),
      getAgents({ noCache: true }),
      getAllActivity().catch(() => []),
    ])

    // 2. AUTO-REVIEW FIRST: Clear the Review queue before doing anything else.
    // This lets agents pick up revised tasks and keeps content flowing to Done.
    const preReviewData = await triggerAutoReview()
    results.reviewResults = preReviewData
    if (preReviewData?.results) {
      const approved = preReviewData.results.approved?.length || 0
      const revised = preReviewData.results.revised?.length || 0
      if (approved + revised > 0) {
        console.log(`[RUNNER] Pre-review: ${approved} approved, ${revised} revised`)
        // Re-fetch tasks after review to get updated statuses
        const freshPostReview = await getActionableTasks({ noCache: true })
        tasks.length = 0
        tasks.push(...freshPostReview)
      }
    }

    // 3. AGGRESSIVE AUTO-PLAN: Keep the pipeline full (now with content gap intelligence)
    const planData = await triggerAggressivePlanning(tasks, activity)
    results.planResults = planData
    if (planData?.tasksCreated > 0) {
      // Re-fetch tasks to pick up new ones
      const freshTasks = await getActionableTasks({ noCache: true })
      tasks.length = 0
      tasks.push(...freshTasks)
    }

    // 3b. MUSE CREATIVE DIRECTION: Two-stage brief — auto-create MUSE tasks
    // for campaigns where CMO has briefed strategy but MUSE hasn't added creative direction
    const creativeDirectionTasks = await autoCreateCreativeDirection(tasks, activity)
    if (creativeDirectionTasks.length > 0) {
      results.creativeDirection = creativeDirectionTasks
      // Re-fetch tasks to include newly created MUSE tasks
      const freshTasks = await getActionableTasks({ noCache: true })
      tasks.length = 0
      tasks.push(...freshTasks)
    }

    // 4. BUILD SKILL DATA for intelligent routing (one-time per cycle)
    let skillData = null
    try {
      skillData = buildSkillLookup(tasks, activity)
    } catch { /* Non-critical: routing falls back to load-only balancing */ }

    // 4b. WIP DRAIN: Move excess Assigned tasks back to Inbox to enforce global WIP limit.
    // This is the one-time cleanup for the 700+ task backlog. On subsequent runs it's a no-op
    // because auto-assign respects the cap.
    const assignedTasks_preDrain = tasks.filter(t => t.status === 'Assigned')
    if (assignedTasks_preDrain.length > MAX_GLOBAL_WIP) {
      // Keep the highest-priority tasks assigned, drain the rest back to Inbox
      const sortedAssigned = activity
        ? sortByPriorityTier(assignedTasks_preDrain, activity)
        : assignedTasks_preDrain.sort((a, b) => priorityScore(b) - priorityScore(a))

      const toKeep = sortedAssigned.slice(0, MAX_GLOBAL_WIP)
      const toDrain = sortedAssigned.slice(MAX_GLOBAL_WIP)

      // Batch drain — cap at 50 per cycle to avoid Airtable rate limits
      const drainBatch = toDrain.slice(0, 50)
      let drained = 0

      for (const task of drainBatch) {
        try {
          await updateTask(task.id, { 'Status': 'Inbox' })
          task.status = 'Inbox'
          drained++
        } catch (err) {
          console.warn(`[RUNNER] Failed to drain "${task.name}":`, err.message)
        }
      }

      if (drained > 0) {
        console.log(`[RUNNER] 🔽 WIP drain: moved ${drained}/${toDrain.length} excess Assigned tasks back to Inbox (keeping top ${toKeep.length})`)
        results.wipDrained = drained
        results.wipRemaining = toDrain.length - drained

        await addActivity({
          'Agent': 'Council',
          'Action': 'wip-drain',
          'Task': 'Pipeline',
          'Details': `WIP limit enforced: drained ${drained} excess Assigned tasks back to Inbox. Target: ${MAX_GLOBAL_WIP} max active tasks. ${toDrain.length - drained} more to drain in subsequent cycles.`,
          'Type': 'Comment',
        }).catch(err => console.warn('[CRON] WIP-drain activity log failed:', err.message))
      }
    }

    // 5. AUTO-ASSIGN: Move Inbox tasks to Assigned (skill-aware, priority-tiered, WIP-capped)
    const autoAssigned = await autoAssignInboxTasks(tasks, agents, skillData, activity)
    results.autoAssigned = autoAssigned
    if (autoAssigned.length > 0) {
      console.log(`[RUNNER] Auto-assigned ${autoAssigned.length} tasks`)
    }

    // 4. STALL RECOVERY: Unstick tasks stranded in "In Progress"
    // The cron runner is the ONLY thing that sets "In Progress" and it processes
    // synchronously. So ANY task still "In Progress" at the start of a new run
    // is a leftover from a failed previous run — reset it to "Assigned" for retry.
    const stalledTasks = tasks.filter(t => t.status === 'In Progress')

    for (const stalled of stalledTasks) {
      try {
        await updateTask(stalled.id, { 'Status': 'Assigned' })
        stalled.status = 'Assigned' // Update in-memory so it gets picked up below
        console.log(`[RUNNER] 🔄 Unstalled: "${stalled.name}" was stuck In Progress → reset to Assigned`)
        await addActivity({
          'Agent': 'Council',
          'Action': 'stall-recovery',
          'Task': stalled.name,
          'Details': `Task was stuck in "In Progress" from a previous failed run. Reset to Assigned for retry.`,
          'Type': 'Comment',
        }).catch(err => console.warn('[CRON] Stall recovery activity log failed:', err.message))
      } catch (err) {
        console.warn(`[RUNNER] Stall recovery failed for "${stalled.name}":`, err.message)
      }
    }

    if (stalledTasks.length > 0) {
      console.log(`[RUNNER] 🔄 Recovered ${stalledTasks.length} stalled tasks`)
      results.recovered = stalledTasks.map(t => t.name)

      // Alert via Slack
      notifyPipelineAlert({
        type: 'stall_recovery',
        message: `Recovered ${stalledTasks.length} stalled tasks`,
        details: stalledTasks.map(t => `• "${t.name}" (${t.agent})`).join('\n'),
      }).catch(err => console.warn('[CRON] Slack stall alert failed:', err.message))
    }

    // 5. STALE TASK RECYCLER: Tasks assigned for 24h+ without progress get reassigned
    // Reduced from 48h — with 15-min CRON cycles, tasks should show progress within hours.
    // 24h gives agents plenty of time while preventing multi-day stalls (e.g., PIXEL stuck 17h).
    const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24 hours
    const staleCandidates = tasks.filter(t => {
      if (t.status !== 'Assigned') return false
      if (!t.createdAt) return false
      const age = Date.now() - new Date(t.createdAt).getTime()
      return age > STALE_THRESHOLD_MS
    })

    const recycled = []
    for (const task of staleCandidates.slice(0, 5)) { // Cap at 5 per cycle
      const newAgent = findBestAgent(task, agents, tasks, skillData)
      if (newAgent && newAgent !== task.agent) {
        const oldAgent = task.agent
        await updateTask(task.id, { 'Agent': newAgent, 'Status': 'Assigned' }).catch(err => console.warn('[CRON] Stale task reassign failed:', err.message))
        task.agent = newAgent
        recycled.push({ task: task.name, from: oldAgent, to: newAgent })
        await addActivity({
          'Agent': 'Council',
          'Action': 'stale-recycled',
          'Task': task.name,
          'Details': `Task stale for 48h+ with ${oldAgent}. Reassigned to ${newAgent} for fresh attempt.`,
          'Type': 'Comment',
        }).catch(err => console.warn('[CRON] Stale recycle activity log failed:', err.message))
      }
    }

    if (recycled.length > 0) {
      console.log(`[RUNNER] ♻️ Recycled ${recycled.length} stale tasks`)
      results.recycled = recycled
    }

    // 6. Process assigned tasks — PARALLEL execution for higher throughput
    // Default 8 tasks/cycle × 4 cycles/hour = 32/hour = 768/day theoretical max
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '8', 10)
    // Use Roundtable priority tiers for processing order (P1 revisions > P2 standard > P3 new briefs)
    const allAssigned = activity
      ? sortByPriorityTier(tasks.filter(t => t.status === 'Assigned' && t.agent), activity)
      : tasks.filter(t => t.status === 'Assigned' && t.agent).sort((a, b) => priorityScore(b) - priorityScore(a))
    const assignedTasks = allAssigned.slice(0, limit)

    if (assignedTasks.length === 0 && autoAssigned.length === 0) {
      // Auto-review already ran at top of cycle
      return NextResponse.json({
        message: 'No tasks to process. Auto-review ran at start of cycle.',
        results,
        duration: `${Date.now() - startTime}ms`,
        stats: buildStats(tasks),
      })
    }

    // 7. PRE-FETCH: Batch-load agent memories with task-aware relevance scoring
    // Each agent gets memories ranked by relevance to their current task context
    const memoryCache = {}
    await Promise.all(
      assignedTasks.map(async (task) => {
        if (!task.agent) return
        // Build context from the task for relevance-scored retrieval
        const territory = task.tags?.length > 0 ? task.tags[0] : undefined
        const queryHint = `${task.name} ${task.contentType || ''} ${task.campaign || ''}`.trim()
        const cacheKey = `${task.agent}::${task.id}`
        memoryCache[cacheKey] = await getAgentMemories(task.agent, {
          contentType: task.contentType,
          query: queryHint,
          territory,
        })
      })
    )

    // 8. Mark all tasks "In Progress" first (batch status update)
    // Cap per cycle to avoid Vercel function timeout (300s max)
    const MAX_TASKS_PER_CYCLE = 12
    const validTasks = []
    for (const task of assignedTasks) {
      if (validTasks.length >= MAX_TASKS_PER_CYCLE) {
        results.skipped.push({ task: task.name, reason: `Cycle cap reached (${MAX_TASKS_PER_CYCLE})` })
        continue
      }
      const agent = agents.find(a => a.name === task.agent)
      if (!agent) {
        results.skipped.push({ task: task.name, reason: `Agent "${task.agent}" not found` })
        continue
      }
      if (agent.status === 'Idle') {
        results.skipped.push({ task: task.name, reason: `${agent.name} is Idle` })
        continue
      }
      validTasks.push({ task, agent })
    }

    // Mark all valid tasks as In Progress (parallel)
    await Promise.all(
      validTasks.map(({ task, agent }) =>
        Promise.all([
          updateTask(task.id, { 'Status': 'In Progress' }),
          addActivity({
            'Agent': agent.name,
            'Action': 'started',
            'Task': task.name,
            'Details': `Processing ${task.contentType || 'content'} with ${agent.model}`,
            'Type': 'Task Created',
          }),
        ]).catch(err => console.warn('[CRON] Task start status update failed:', err.message))
      )
    )

    // 9. BATCHED PROCESSING: Execute tasks in small batches to avoid rate limits
    // Batches of 4 with 10s delays — prevents 429s on Anthropic's 30K tokens/min limit
    const TASK_BATCH_SIZE = 4
    const TASK_BATCH_DELAY_MS = 5000
    const taskResults = []

    for (let bi = 0; bi < validTasks.length; bi += TASK_BATCH_SIZE) {
      const batch = validTasks.slice(bi, bi + TASK_BATCH_SIZE)

      if (bi > 0) {
        console.log(`[RUNNER] Waiting ${TASK_BATCH_DELAY_MS / 1000}s before next batch (${bi}/${validTasks.length})...`)
        await new Promise(r => setTimeout(r, TASK_BATCH_DELAY_MS))
      }

      const batchResults = await Promise.allSettled(
        batch.map(({ task, agent }) => processTask(task, agent, memoryCache, activity))
      )
      taskResults.push(...batchResults.map((r, i) => ({ result: r, task: batch[i].task })))
    }

    // Collect results
    for (const { task, result } of taskResults) {
      if (result.status === 'fulfilled') {
        results.processed.push(result.value)
        console.log(`[RUNNER] ✅ Completed: "${task.name}" (${result.value.outputLength} chars)`)
      } else {
        const err = result.reason
        console.error(`[RUNNER] ❌ Error on "${task.name}":`, err?.message || err)
        results.errors.push({ task: task.name, error: err?.message || 'Unknown error' })

        // Count past failures from activity feed for durable retry tracking
        const pastErrors = await countTaskErrors(task.name)
        const retries = pastErrors + 1
        const maxRetries = 5

        // Exponential backoff: after repeated failures, escalate
        // 1-2 failures → Assigned (retry next cycle)
        // 3 failures → stays Assigned but gets lower priority
        // 4-5 failures → Review (needs human attention)
        const revertStatus = retries >= 4 ? 'Review' : 'Assigned'
        const failNote = retries >= maxRetries
          ? `[GENERATION FAILED after ${retries} attempts — max retries exceeded]\nLast error: ${err?.message}\n\nThis task needs manual review or reassignment.`
          : null

        await updateTask(task.id, {
          'Status': revertStatus,
          ...(failNote ? { 'Output': failNote } : {}),
        }).catch(err => console.warn('[CRON] Task revert failed:', err.message))

        console.log(`[RUNNER] ↩️ Reverted "${task.name}" to ${revertStatus} (attempt ${retries}/${maxRetries})`)

        await addActivity({
          'Agent': task.agent || 'System',
          'Action': 'error',
          'Task': task.name,
          'Details': `Failed (attempt ${retries}/${maxRetries}): ${err?.message}. Status → ${revertStatus}.${retries >= 3 ? ' Consider reassigning agent.' : ''}`,
          'Type': 'Comment',
        }).catch(err => console.warn('[CRON] Error activity log failed:', err.message))
      }
    }

    // 8. POST-PROCESS REVIEW: Run auto-review again to catch newly completed tasks
    const postReviewData = await triggerAutoReview()
    if (postReviewData?.results) {
      // Merge post-review results into the pre-review results
      const pre = results.reviewResults?.results || {}
      results.reviewResults = {
        ...results.reviewResults,
        results: {
          approved: [...(pre.approved || []), ...(postReviewData.results.approved || [])],
          revised: [...(pre.revised || []), ...(postReviewData.results.revised || [])],
          errors: [...(pre.errors || []), ...(postReviewData.results.errors || [])],
        },
      }
    }

    const reviewData = results.reviewResults
    const duration = Date.now() - startTime

    // Log run summary
    await addActivity({
      'Agent': 'Council',
      'Action': 'completed run',
      'Task': 'Agent Runner',
      'Details': `Processed ${results.processed.length}/${assignedTasks.length} tasks in ${duration}ms. Reviewed: ${reviewData?.results?.approved?.length || 0} approved, ${reviewData?.results?.revised?.length || 0} revised. ${results.errors.length} errors.`,
      'Type': 'Comment',
    }).catch(err => console.warn('[CRON] Run summary activity log failed:', err.message))

    // Slack notification for cron cycle
    notifyCronCycle({
      processed: results.processed.length,
      assigned: results.autoAssigned.length,
      planned: results.planResults?.tasksCreated || 0,
      reviewed: (reviewData?.results?.approved?.length || 0) + (reviewData?.results?.revised?.length || 0),
      errors: results.errors.length,
      duration: `${duration}ms`,
    }).catch(err => console.warn('[CRON] Slack cron notify failed:', err.message))

    // Pipeline health alerts
    const inboxCount = tasks.filter(t => t.status === 'Inbox').length
    if (inboxCount > 15) {
      notifyPipelineAlert({
        type: 'low_queue',
        message: `${inboxCount} unassigned tasks piling up in Inbox`,
        details: 'Consider running campaign planner or manually assigning tasks.',
      }).catch(err => console.warn('[CRON] Slack pipeline alert failed:', err.message))
    }

    return NextResponse.json({
      message: `Processed ${results.processed.length} tasks, reviewed ${(reviewData?.results?.approved?.length || 0) + (reviewData?.results?.revised?.length || 0)}`,
      duration: `${duration}ms`,
      results,
      stats: buildStats(tasks),
    })

  } catch (err) {
    console.error('[RUNNER] Fatal error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * Process a single task — runs AI generation, saves output, logs activity.
 * Designed to be called concurrently via Promise.allSettled.
 */
async function processTask(task, agent, memoryCache, activity) {
  console.log(`[RUNNER] Processing: "${task.name}" → ${agent.name} (${agent.model})`)

  // Check revision context
  const isRevision = task.output && task.output.startsWith('[REVISION REQUESTED]')
  let feedbackContext = null
  let previousOutput = null

  if (isRevision) {
    const feedbackMatch = task.output.match(/^(?:\[REVISION REQUESTED\])\nFeedback: ([\s\S]*?)\n\n---PREVIOUS OUTPUT/)
    feedbackContext = feedbackMatch ? feedbackMatch[1].trim() : null
    const prevMatch = task.output.match(/---PREVIOUS OUTPUT \(v\d+\)---\n([\s\S]*?)(?=\n---PREVIOUS OUTPUT|$)/)
    previousOutput = prevMatch ? prevMatch[1].trim() : null
  }

  // Use pre-fetched memories from task-specific cache (relevance-scored)
  const cacheKey = `${agent.name}::${task.id}`
  const memories = memoryCache[cacheKey] || memoryCache[agent.name] || []
  const memoryContext = memories.length > 0
    ? '\n\n## Agent Memory (Relevance-Scored Learnings)\n' + memories.slice(0, 10).map(m =>
        `- [${m.type}${m.relevanceScore ? ` ★${m.relevanceScore}` : ''}] ${m.content}`
      ).join('\n')
    : ''

  // Figma context for PIXEL
  let figmaContext = ''
  if (agent.name === 'PIXEL' && isFigmaConfigured()) {
    const figmaUrlMatch = (task.description || '').match(/(https?:\/\/[^\s]*figma\.com\/[^\s]+)/)
    if (figmaUrlMatch) {
      try {
        const ctx = await buildDesignContext(figmaUrlMatch[1])
        if (ctx) figmaContext = '\n\n' + ctx
      } catch (err) {
        console.warn(`[RUNNER] Figma context failed: ${err.message}`)
      }
    }
  }

  // Roundtable v4.0: Campaign context injection — gives agents awareness of related tasks,
  // handoffs, and campaign status so they can produce contextually coherent content
  let campaignContext = ''
  if (task.campaign && activity?.length > 0) {
    try {
      const campaignTasks = (await getTasksByCampaign(task.campaign, { noCache: true })).catch?.(() => []) || []
      const ctx = buildCampaignContext(task.campaign, campaignTasks.length > 0 ? campaignTasks : [], activity)
      campaignContext = formatCampaignContextForPrompt(ctx)
    } catch (err) {
      console.warn(`[RUNNER] Campaign context failed for "${task.campaign}":`, err.message)
    }
  }

  // Build prompt with FRAMEWORK injection + campaign context
  const userPrompt = (isRevision
    ? buildRevisionPrompt(task, feedbackContext, previousOutput)
    : buildTaskPrompt(task)) + campaignContext + memoryContext + figmaContext

  let output

  // IMAGE TASKS: Route to FLUX.1 (HF) → Gemini fallback
  if (task.contentType === 'Image' && (process.env.HF_TOKEN || process.env.GOOGLE_AI_KEY || process.env.GOOGLE_AI_API_KEY)) {
    const territory = task.description?.match(/Territory:\s*(Celebration|Gratitude|Memory|Identity|Tribute)/i)?.[1]
    const platform = Array.isArray(task.platform) ? task.platform[0] : task.platform
    const preset = autoPreset(task.contentType, platform)
    const imagePrompt = extractVisualPrompt(task.name, task.description, territory)

    console.log(`[RUNNER] Image task: "${task.name}" → FLUX.1/Gemini (${preset})`)

    const imageResult = await generateImage({
      prompt: imagePrompt,
      preset,
      territory,
      contentType: 'Image',
      taskName: task.name,
    })

    // Upload base64 to Vercel Blob for permanent HTTP URL (Airtable gallery compatible)
    const permanentUrl = await uploadImage(imageResult.url, task.name || 'songfinch-image')
    if (permanentUrl !== imageResult.url) {
      console.log(`[RUNNER] Image uploaded to Blob: ${permanentUrl}`)
      imageResult.url = permanentUrl
    }

    output = `IMAGE GENERATED\n\nURL: ${imageResult.url}\n\nRevised Prompt: ${imageResult.revisedPrompt || 'N/A'}\n\nPreset: ${preset}\nSize: ${imageResult.size}\nTerritory: ${territory || 'N/A'}\nOriginal Prompt: ${imagePrompt}`
  }
  // VIDEO TASKS: Route to LTX-2 for video generation
  else if (task.contentType === 'Video Script' && process.env.HF_TOKEN) {
    // Check if the task already has text output (a completed video script from LENS agent)
    const scriptText = task.output && !task.output.startsWith('[REVISION REQUESTED]')
      ? task.output
      : task.description || task.name

    const videoPrompt = buildVideoPrompt(scriptText)
    const numFrames = 121 // ~5 seconds at 25fps
    const fps = 25

    console.log(`[RUNNER] 🎬 Video task: "${task.name}" → LTX-2 (${numFrames} frames, ${fps}fps)`)

    try {
      const videoResult = await generateVideoFromText({
        prompt: videoPrompt,
        numFrames,
        fps,
      })

      output = `VIDEO GENERATED\n\nURL: ${videoResult.url}\nPrompt: ${videoPrompt}\nFrames: ${numFrames}\nFPS: ${fps}`
    } catch (videoErr) {
      console.warn(`[RUNNER] 🎬 LTX-2 failed for "${task.name}": ${videoErr.message}. Falling back to text AI.`)

      // Fall back to standard text AI generation (produces a script instead)
      output = await callAI({
        model: agent.model,
        temperature: agent.temperature,
        systemPrompt: agent.systemPrompt || `You are ${agent.name}, the ${agent.role} for Songfinch.`,
        userPrompt,
      })
    }
  } else {
    // TEXT TASKS: Standard AI generation
    output = await callAI({
      model: agent.model,
      temperature: agent.temperature,
      systemPrompt: agent.systemPrompt || `You are ${agent.name}, the ${agent.role} for Songfinch.`,
      userPrompt,
    })
  }

  // Preserve revision history
  let finalOutput = output.substring(0, 80000)
  if (isRevision && task.output) {
    const historyStart = task.output.indexOf('---PREVIOUS OUTPUT')
    if (historyStart >= 0) {
      const history = task.output.substring(historyStart)
      finalOutput = finalOutput + '\n\n' + history
    }
  }

  // Save output → Review + Content Library + Google Drive (parallel writes)
  const taskUpdateFields = {
    'Status': 'Review',
    'Output': finalOutput.substring(0, 100000),
  }

  // Google Drive export (non-blocking — runs alongside Airtable saves)
  const driveExportPromise = isDriveConfigured()
    ? exportToDrive({
        name: task.name,
        output: output,
        contentType: task.contentType,
        campaign: task.campaign,
        agent: agent.name,
      }).then(driveResult => {
        if (driveResult?.url) {
          console.log(`[RUNNER] 📁 Exported to Drive: "${task.name}" → ${driveResult.url}`)
          // Update task with Drive link (fire-and-forget)
          updateTask(task.id, { 'Google Drive Link': driveResult.url }).catch(err => console.warn('[CRON] Drive link update failed:', err.message))
          return driveResult.url
        }
        return null
      }).catch(driveErr => {
        console.warn(`[RUNNER] 📁 Drive export failed for "${task.name}": ${driveErr.message}`)
        return null
      })
    : Promise.resolve(null)

  await Promise.all([
    updateTask(task.id, taskUpdateFields),
    addContent({
      'Title': task.name,
      'Content Body': output,
      'Content Type': sanitizeContentType(task.contentType),
      'Platform': Array.isArray(task.platform) ? task.platform.join(', ') : (task.platform || ''),
      'Agent': agent.name,
      'Campaign': task.campaign || '',
      'Status': 'Draft',
    }).catch(contentErr => {
      console.warn(`[RUNNER] Content Library save failed for "${task.name}": ${contentErr.message}`)
    }),
    driveExportPromise,
  ])

  // Extract metadata from output
  const whyMatch = output.match(/(?:^|\n)\s*WHY:\s*(.+?)(?=\n\s*(?:IMPACT|LINKS)|$)/is)
  const impactMatch = output.match(/(?:^|\n)\s*IMPACT:\s*(.+?)(?=\n\s*LINKS|$)/is)

  let completionDetails = isRevision
    ? `Revised ${task.contentType || 'content'} based on feedback (${output.length} chars). Ready for review.`
    : `Generated ${task.contentType || 'content'} (${output.length} chars). Ready for review.`
  if (whyMatch) completionDetails += `\nWHY: ${whyMatch[1].trim()}`
  if (impactMatch) completionDetails += `\nIMPACT: ${impactMatch[1].trim()}`

  // Activity log + revision learning (parallel)
  await Promise.all([
    addActivity({
      'Agent': agent.name,
      'Action': 'completed',
      'Task': task.name,
      'Details': completionDetails.substring(0, 5000),
      'Type': 'Content Generated',
    }),
    (isRevision && feedbackContext)
      ? saveMemory({
          agent: agent.name,
          type: 'feedback',
          content: `Received feedback on "${task.name}": ${feedbackContext.substring(0, 500)}`,
          source: 'revision',
          importance: 'High',
          taskContext: task.contentType || 'content',
        })
      : Promise.resolve(),
  ])

  return {
    task: task.name,
    agent: agent.name,
    model: agent.model,
    outputLength: output.length,
  }
}

function buildStats(tasks) {
  return {
    total: tasks.length,
    inbox: tasks.filter(t => t.status === 'Inbox').length,
    assigned: tasks.filter(t => t.status === 'Assigned').length,
    inProgress: tasks.filter(t => t.status === 'In Progress').length,
    review: tasks.filter(t => t.status === 'Review').length,
    done: tasks.filter(t => t.status === 'Done').length,
  }
}

/**
 * Build the task prompt — now with FRAMEWORK injection
 */
function buildTaskPrompt(task) {
  const sections = [
    `# Task: ${task.name}`,
    '',
    `## ${FRAMEWORK_BRIEF}`,
    '',
  ]

  if (task.description) {
    sections.push(`## Brief`, task.description, '')
  }

  if (task.contentType) {
    sections.push(`**Content Type:** ${task.contentType}`)
  }

  if (task.campaign) {
    sections.push(`**Campaign:** ${task.campaign}`)
  }

  if (task.platform && task.platform.length > 0) {
    sections.push(`**Target Platforms:** ${task.platform.join(', ')}`)
  }

  if (task.tags && task.tags.length > 0) {
    sections.push(`**Emotional Pillars:** ${task.tags.join(', ')}`)
  }

  sections.push(
    '',
    '## Creative Workflow (MANDATORY)',
    '1. First define the EMOTIONAL MOMENT being depicted',
    '2. Then articulate the HUMAN INSIGHT behind the moment',
    '3. Then write the IMPACT STATEMENT (what the experience unlocks)',
    '4. Then introduce SONGFINCH as the enabling mechanism',
    '',
    '## Instructions',
    '- Complete this task according to your role and the output format in your system prompt.',
    '- Follow the Narrative Ladder: Emotion → Insight → Impact → Songfinch (LAST).',
    '- NEVER lead with product features. NEVER use generic gift language.',
    '- Make the audience FEEL something specific before mentioning the product.',
    '- Be vivid, specific, emotionally charged, and production-ready.',
    '- Include A/B variations when relevant.',
    '',
    '## Required Output Sections',
    'At the END of your output, include:',
    '',
    'WHY: 1-2 sentences on your strategic approach and how it follows the Narrative Ladder.',
    '',
    'IMPACT: Expected business impact — who it reaches and measurable outcomes.',
  )

  return sections.join('\n')
}

/**
 * Build revision prompt with framework context
 */
function buildRevisionPrompt(task, feedback, previousOutput) {
  const sections = [
    `# REVISION REQUEST: ${task.name}`,
    '',
    `## ${FRAMEWORK_BRIEF}`,
    '',
    '## Original Brief',
    task.description || '(no description)',
    '',
  ]

  if (task.contentType) sections.push(`**Content Type:** ${task.contentType}`)
  if (task.campaign) sections.push(`**Campaign:** ${task.campaign}`)
  if (task.platform && task.platform.length > 0) {
    sections.push(`**Target Platforms:** ${task.platform.join(', ')}`)
  }

  sections.push(
    '',
    '## Previous Output',
    '```',
    (previousOutput || '').substring(0, 10000),
    '```',
    '',
    '## Feedback from CHIEF Reviewer',
    feedback || '(no specific feedback provided)',
    '',
    '## Revision Instructions',
    '- Carefully address ALL feedback points.',
    '- Ensure the Narrative Ladder is followed: Emotion → Insight → Impact → Songfinch.',
    '- Keep what was good. Fix what was criticized.',
    '- The output should be a COMPLETE replacement.',
    '- Make the audience FEEL before they THINK about the product.',
    '',
    'WHY: Explain what you changed and why.',
    'IMPACT: Expected business impact of this revision.',
  )

  return sections.join('\n')
}

// Only values that actually exist in Airtable's Content Type Single Select dropdown
const VALID_CONTENT_TYPES = new Set([
  'Ad Copy', 'Social Post', 'Video Script', 'Blog Post', 'Landing Page',
])

function sanitizeContentType(type) {
  if (!type) return 'Social Post'
  if (VALID_CONTENT_TYPES.has(type)) return type
  const lower = type.toLowerCase()
  if (lower.includes('ad') || lower.includes('copy')) return 'Ad Copy'
  if (lower.includes('social')) return 'Social Post'
  if (lower.includes('video') || lower.includes('script')) return 'Video Script'
  if (lower.includes('blog') || lower.includes('seo') || lower.includes('article')) return 'Blog Post'
  if (lower.includes('landing')) return 'Landing Page'
  if (lower.includes('strategy') || lower.includes('audit') || lower.includes('report')) return 'Ad Copy'
  if (lower.includes('image') || lower.includes('visual') || lower.includes('graphic') || lower.includes('photo')) return 'Social Post'
  return 'Social Post'
}
