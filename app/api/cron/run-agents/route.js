// Agent Runner — Cron endpoint that processes tasks autonomously
// Called by Vercel Cron every 15 min or manually via dashboard
// Full pipeline: Auto-plan → Auto-assign → Process → Self-check → Auto-review → Learn
// Target: 30+ pieces of content per day

import { getTasks, getAgents, updateTask, addActivity, addContent } from '../../../../lib/airtable'
import { callAI } from '../../../../lib/ai'
import { generateImage, autoPreset, extractVisualPrompt } from '../../../../lib/dalle'
import { FRAMEWORK_BRIEF } from '../../../../lib/framework'
import { buildDesignContext, isFigmaConfigured } from '../../../../lib/figma'
import { notifyCronCycle, notifyPipelineAlert } from '../../../../lib/slack'
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
  'image': 'PIXEL', 'Image': 'PIXEL',
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
    workloads[a.name] = {
      assigned: agentTasks.filter(t => t.status === 'Assigned').length,
      inProgress: agentTasks.filter(t => t.status === 'In Progress').length,
      review: agentTasks.filter(t => t.status === 'Review').length,
      total: agentTasks.length,
    }
  })
  return workloads
}

const MAX_AGENT_QUEUE = 5 // Max queued tasks per agent before redistributing

function findBestAgent(task, agents, allTasks) {
  const workloads = allTasks ? getAgentWorkloads(allTasks, agents) : null

  // Primary: content-type routing
  if (task.contentType && AGENT_ROUTING[task.contentType]) {
    const name = AGENT_ROUTING[task.contentType]
    const agent = agents.find(a => a.name === name)
    if (agent) {
      // Check if primary agent is overloaded
      if (workloads && workloads[name]?.total >= MAX_AGENT_QUEUE) {
        // Try to find a capable alternative with lower load
        const alt = findAlternativeAgent(task, agents, workloads, name)
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
            const alt = findAlternativeAgent(task, agents, workloads, route.agent)
            if (alt) return alt
          }
          return route.agent
        }
      }
    }
  }

  return 'MUSE'
}

function findAlternativeAgent(task, agents, workloads, excludeAgent) {
  // Creative/generalist agents that can handle overflow
  const generalists = ['MUSE', 'STORY', 'PULSE', 'HOOK']

  // Find the least-loaded generalist
  let bestAgent = null
  let bestLoad = Infinity

  for (const name of generalists) {
    if (name === excludeAgent) continue
    const agent = agents.find(a => a.name === name)
    if (!agent) continue
    const load = workloads[name]?.total || 0
    if (load < bestLoad) {
      bestLoad = load
      bestAgent = name
    }
  }

  // Only redirect if the alternative has meaningfully less load
  if (bestAgent && bestLoad < MAX_AGENT_QUEUE - 1) {
    return bestAgent
  }
  return null // All agents are busy, stick with primary
}

async function autoAssignInboxTasks(tasks, agents) {
  const inboxTasks = tasks.filter(t => t.status === 'Inbox')
  const assigned = []

  for (const task of inboxTasks) {
    const agentName = task.agent || findBestAgent(task, agents, tasks)
    try {
      await updateTask(task.id, { 'Status': 'Assigned', 'Agent': agentName })
      await addActivity({
        'Agent': 'Council',
        'Action': 'auto-assigned',
        'Task': task.name,
        'Details': `Auto-assigned to ${agentName} (load-balanced). Content type: ${task.contentType || 'keyword match'}`,
        'Type': 'Task Created',
      })
      assigned.push({ task: task.name, agent: agentName })
      task.status = 'Assigned'
      task.agent = agentName
    } catch (err) {
      console.warn(`[RUNNER] Failed to auto-assign "${task.name}":`, err.message)
    }
  }

  return assigned
}

// ---- MEMORY HELPERS ----

async function getAgentMemories(agentName) {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/memory?agent=${encodeURIComponent(agentName)}`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.memories || []
  } catch {
    return []
  }
}

async function saveMemory({ agent, type, content, source, importance, taskContext }) {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    await fetch(`${baseUrl}/api/memory`, {
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
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/review/auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 5 }),
    })
    const data = await res.json()
    return data
  } catch (err) {
    console.warn('[RUNNER] Auto-review trigger failed:', err.message)
    return null
  }
}

// ---- AGGRESSIVE PLANNING ----

async function triggerAggressivePlanning(tasks) {
  const now = new Date()
  const twoWeeksOut = new Date(now)
  twoWeeksOut.setDate(twoWeeksOut.getDate() + 14)

  // Count tasks in the pipeline (not Done)
  const activeTasks = tasks.filter(t => t.status !== 'Done')
  const inboxOrAssigned = tasks.filter(t => t.status === 'Inbox' || t.status === 'Assigned')

  // AGGRESSIVE: Plan if we have fewer than 15 active tasks or fewer than 8 in queue
  if (activeTasks.length >= 15 && inboxOrAssigned.length >= 8) {
    console.log(`[RUNNER] Pipeline healthy: ${activeTasks.length} active, ${inboxOrAssigned.length} queued. Skipping plan.`)
    return null
  }

  try {
    console.log(`[RUNNER] Pipeline needs fuel: ${activeTasks.length} active, ${inboxOrAssigned.length} queued. Triggering CMO planner...`)
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    const planRes = await fetch(`${baseUrl}/api/campaigns/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weeksAhead: 2 }), // Always plan 2 weeks ahead
    })
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
    // 1. Fetch tasks and agents in parallel
    const [tasks, agents] = await Promise.all([
      getTasks({ noCache: true }),
      getAgents({ noCache: true }),
    ])

    // 2. AGGRESSIVE AUTO-PLAN: Keep the pipeline full
    const planData = await triggerAggressivePlanning(tasks)
    results.planResults = planData
    if (planData?.tasksCreated > 0) {
      // Re-fetch tasks to pick up new ones
      const freshTasks = await getTasks({ noCache: true })
      tasks.length = 0
      tasks.push(...freshTasks)
    }

    // 3. AUTO-ASSIGN: Move Inbox tasks to Assigned
    const autoAssigned = await autoAssignInboxTasks(tasks, agents)
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
        }).catch(() => {})
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
      }).catch(() => {})
    }

    // 6. Process assigned tasks (5 per run = 480/day at 15-min cron)
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '5', 10)
    const allAssigned = tasks.filter(t => t.status === 'Assigned' && t.agent)
    const assignedTasks = allAssigned.slice(0, limit)

    if (assignedTasks.length === 0 && autoAssigned.length === 0) {
      // Still run auto-review even if nothing to process
      const reviewData = await triggerAutoReview()
      results.reviewResults = reviewData

      return NextResponse.json({
        message: 'No tasks to process. Ran auto-review.',
        results,
        duration: `${Date.now() - startTime}ms`,
        stats: buildStats(tasks),
      })
    }

    // 7. Process each assigned task
    for (const task of assignedTasks) {
      try {
        const agent = agents.find(a => a.name === task.agent)
        if (!agent) {
          results.skipped.push({ task: task.name, reason: `Agent "${task.agent}" not found` })
          continue
        }

        if (agent.status === 'Idle') {
          results.skipped.push({ task: task.name, reason: `${agent.name} is Idle` })
          continue
        }

        console.log(`[RUNNER] Processing: "${task.name}" → ${agent.name} (${agent.model})`)

        await addActivity({
          'Agent': agent.name,
          'Action': 'started',
          'Task': task.name,
          'Details': `Processing ${task.contentType || 'content'} with ${agent.model}`,
          'Type': 'Task Created',
        })

        await updateTask(task.id, { 'Status': 'In Progress' })

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

        // Fetch agent memories
        const memories = await getAgentMemories(agent.name)
        const memoryContext = memories.length > 0
          ? '\n\n## Agent Memory (Learnings from past work)\n' + memories.slice(0, 10).map(m =>
              `- [${m.type}] ${m.content}`
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

        // Build prompt with FRAMEWORK injection
        const userPrompt = (isRevision
          ? buildRevisionPrompt(task, feedbackContext, previousOutput)
          : buildTaskPrompt(task)) + memoryContext + figmaContext

        let output

        // IMAGE TASKS: Route to DALL-E 3 instead of text AI
        if (task.contentType === 'Image' && process.env.OPENAI_API_KEY) {
          const territory = task.description?.match(/Territory:\s*(Celebration|Gratitude|Memory|Identity|Tribute)/i)?.[1]
          const platform = Array.isArray(task.platform) ? task.platform[0] : task.platform
          const preset = autoPreset(task.contentType, platform)
          const imagePrompt = extractVisualPrompt(task.name, task.description, territory)

          console.log(`[RUNNER] 🎨 Image task: "${task.name}" → DALL-E 3 (${preset})`)

          const imageResult = await generateImage({
            prompt: imagePrompt,
            preset,
            territory,
            contentType: 'Image',
            taskName: task.name,
          })

          output = `IMAGE GENERATED\n\nURL: ${imageResult.url}\n\nRevised Prompt: ${imageResult.revisedPrompt || 'N/A'}\n\nPreset: ${preset}\nSize: ${imageResult.size}\nTerritory: ${territory || 'N/A'}\nOriginal Prompt: ${imagePrompt}`
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

        // Save output → Review
        await updateTask(task.id, {
          'Status': 'Review',
          'Output': finalOutput.substring(0, 100000),
        })

        // Save to Content Library
        try {
          await addContent({
            'Title': task.name,
            'Content Body': output,
            'Content Type': sanitizeContentType(task.contentType),
            'Platform': Array.isArray(task.platform) ? task.platform.join(', ') : (task.platform || ''),
            'Agent': agent.name,
            'Campaign': task.campaign || '',
            'Status': 'Draft',
          })
        } catch (contentErr) {
          console.warn(`[RUNNER] Content Library save failed for "${task.name}": ${contentErr.message}`)
        }

        // Extract metadata from output
        const whyMatch = output.match(/(?:^|\n)\s*WHY:\s*(.+?)(?=\n\s*(?:IMPACT|LINKS)|$)/is)
        const impactMatch = output.match(/(?:^|\n)\s*IMPACT:\s*(.+?)(?=\n\s*LINKS|$)/is)

        let completionDetails = isRevision
          ? `Revised ${task.contentType || 'content'} based on feedback (${output.length} chars). Ready for review.`
          : `Generated ${task.contentType || 'content'} (${output.length} chars). Ready for review.`
        if (whyMatch) completionDetails += `\nWHY: ${whyMatch[1].trim()}`
        if (impactMatch) completionDetails += `\nIMPACT: ${impactMatch[1].trim()}`

        await addActivity({
          'Agent': agent.name,
          'Action': 'completed',
          'Task': task.name,
          'Details': completionDetails.substring(0, 5000),
          'Type': 'Content Generated',
        })

        // Save revision feedback as learning
        if (isRevision && feedbackContext) {
          await saveMemory({
            agent: agent.name,
            type: 'feedback',
            content: `Received feedback on "${task.name}": ${feedbackContext.substring(0, 500)}`,
            source: 'revision',
            importance: 'High',
            taskContext: task.contentType || 'content',
          })
        }

        results.processed.push({
          task: task.name,
          agent: agent.name,
          model: agent.model,
          outputLength: output.length,
        })

        console.log(`[RUNNER] ✅ Completed: "${task.name}" (${output.length} chars)`)

      } catch (err) {
        console.error(`[RUNNER] ❌ Error on "${task.name}":`, err.message)
        results.errors.push({ task: task.name, error: err.message })

        // CRITICAL: Revert status so the task doesn't stay stuck in "In Progress"
        // Increment retry count to prevent infinite retries
        const retries = (task.retries || 0) + 1
        const revertStatus = retries >= 3 ? 'Review' : 'Assigned' // After 3 failures → send to Review for manual inspection
        await updateTask(task.id, {
          'Status': revertStatus,
          'Output': retries >= 3
            ? `[GENERATION FAILED after ${retries} attempts]\nLast error: ${err.message}\n\nThis task needs manual attention.`
            : (task.output || ''),
        }).catch(() => {})

        console.log(`[RUNNER] ↩️ Reverted "${task.name}" to ${revertStatus} (attempt ${retries})`)

        await addActivity({
          'Agent': task.agent || 'System',
          'Action': 'error',
          'Task': task.name,
          'Details': `Failed (attempt ${retries}): ${err.message}. Reverted to ${revertStatus}.`,
          'Type': 'Comment',
        }).catch(() => {})
      }
    }

    // 8. AUTO-REVIEW: After processing, review anything in Review status
    const reviewData = await triggerAutoReview()
    results.reviewResults = reviewData

    const duration = Date.now() - startTime

    // Log run summary
    await addActivity({
      'Agent': 'Council',
      'Action': 'completed run',
      'Task': 'Agent Runner',
      'Details': `Processed ${results.processed.length}/${assignedTasks.length} tasks in ${duration}ms. Reviewed: ${reviewData?.results?.approved?.length || 0} approved, ${reviewData?.results?.revised?.length || 0} revised. ${results.errors.length} errors.`,
      'Type': 'Comment',
    }).catch(() => {})

    // Slack notification for cron cycle
    notifyCronCycle({
      processed: results.processed.length,
      assigned: results.autoAssigned.length,
      planned: results.planResults?.tasksCreated || 0,
      reviewed: (reviewData?.results?.approved?.length || 0) + (reviewData?.results?.revised?.length || 0),
      errors: results.errors.length,
      duration: `${duration}ms`,
    }).catch(() => {})

    // Pipeline health alerts
    const inboxCount = tasks.filter(t => t.status === 'Inbox').length
    if (inboxCount > 15) {
      notifyPipelineAlert({
        type: 'low_queue',
        message: `${inboxCount} unassigned tasks piling up in Inbox`,
        details: 'Consider running campaign planner or manually assigning tasks.',
      }).catch(() => {})
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

const VALID_CONTENT_TYPES = new Set([
  'Ad Copy', 'Social Post', 'Video Script', 'Blog Post',
  'Landing Page', 'Artist Spotlight', 'Strategy', 'Image', 'General',
])

function sanitizeContentType(type) {
  if (!type) return 'General'
  if (VALID_CONTENT_TYPES.has(type)) return type
  const lower = type.toLowerCase()
  if (lower.includes('ad') || lower.includes('copy')) return 'Ad Copy'
  if (lower.includes('social')) return 'Social Post'
  if (lower.includes('video') || lower.includes('script')) return 'Video Script'
  if (lower.includes('blog') || lower.includes('seo') || lower.includes('article')) return 'Blog Post'
  if (lower.includes('landing')) return 'Landing Page'
  if (lower.includes('strategy') || lower.includes('audit') || lower.includes('report')) return 'Strategy'
  if (lower.includes('image') || lower.includes('visual') || lower.includes('graphic') || lower.includes('photo')) return 'Image'
  return 'General'
}
