// Agent Runner — Cron endpoint that processes tasks autonomously
// Called by Vercel Cron or manually via dashboard
// Flow: Inbox → auto-assign → Assigned → AI generates content → Review

import { getTasks, getAgents, updateTask, addActivity, addContent } from '../../../../lib/airtable'
import { callAI } from '../../../../lib/ai'
import { buildDesignContext, isFigmaConfigured } from '../../../../lib/figma'
import { NextResponse } from 'next/server'

// ---- AUTO-ASSIGNMENT ENGINE ----
// Maps content types and task keywords to the best agent

const AGENT_ROUTING = {
  // Content type → agent name
  'ad_copy': 'HOOK',
  'ad copy': 'HOOK',
  'Ad Copy': 'HOOK',
  'social_post': 'PULSE',
  'social post': 'PULSE',
  'Social Post': 'PULSE',
  'video_script': 'LENS',
  'video script': 'LENS',
  'Video Script': 'LENS',
  'blog_post': 'STORY',
  'blog post': 'STORY',
  'Blog Post': 'STORY',
  'seo': 'FLOW',
  'SEO': 'FLOW',
  'landing_page': 'FLOW',
  'landing page': 'FLOW',
  'Landing Page': 'FLOW',
  'strategy': 'CMO',
  'Strategy': 'CMO',
  'research': 'SCOUT',
  'Research': 'SCOUT',
  'report': 'CHIEF',
  'Report': 'CHIEF',
  'design': 'PIXEL',
  'Design': 'PIXEL',
  'artist_spotlight': 'STORY',
  'Artist Spotlight': 'STORY',
  'General': 'MUSE',
}

// Keyword patterns in task name/description → agent
const KEYWORD_ROUTING = [
  { patterns: ['ad', 'copy', 'cta', 'headline', 'retarget', 'facebook ad', 'instagram ad'], agent: 'HOOK' },
  { patterns: ['social', 'post', 'tiktok', 'instagram', 'twitter', 'thread', 'carousel', 'reel'], agent: 'PULSE' },
  { patterns: ['video', 'script', 'storyboard', 'reel script', 'commercial'], agent: 'LENS' },
  { patterns: ['blog', 'article', 'story', 'spotlight', 'long-form', 'content write'], agent: 'STORY' },
  { patterns: ['seo', 'landing', 'page', 'conversion', 'keyword'], agent: 'FLOW' },
  { patterns: ['strategy', 'campaign', 'plan', 'quarterly', 'budget', 'audience'], agent: 'CMO' },
  { patterns: ['research', 'competitor', 'trend', 'monitor', 'intel', 'audit'], agent: 'SCOUT' },
  { patterns: ['report', 'daily', 'status', 'performance', 'pipeline'], agent: 'CHIEF' },
  { patterns: ['design', 'wireframe', 'layout', 'figma', 'mockup', 'ui'], agent: 'PIXEL' },
  { patterns: ['creative', 'brief', 'direction', 'brand'], agent: 'MUSE' },
]

function findBestAgent(task, agents) {
  // 1. Direct content type match
  if (task.contentType && AGENT_ROUTING[task.contentType]) {
    const name = AGENT_ROUTING[task.contentType]
    if (agents.find(a => a.name === name)) return name
  }

  // 2. Keyword matching on task name + description
  const text = `${task.name} ${task.description}`.toLowerCase()
  for (const route of KEYWORD_ROUTING) {
    for (const pattern of route.patterns) {
      if (text.includes(pattern)) {
        if (agents.find(a => a.name === route.agent)) return route.agent
      }
    }
  }

  // 3. Fallback: assign to MUSE (Creative Director) to triage
  return 'MUSE'
}

async function autoAssignInboxTasks(tasks, agents) {
  // Pick up ALL inbox tasks — even those that already have an agent assigned
  // (they may have been pushed back to Inbox and need reassignment)
  const inboxTasks = tasks.filter(t => t.status === 'Inbox')
  const assigned = []

  for (const task of inboxTasks) {
    // If the task already has an agent, keep it; otherwise, find the best one
    const agentName = task.agent || findBestAgent(task, agents)
    try {
      await updateTask(task.id, { 'Status': 'Assigned', 'Agent': agentName })
      await addActivity({
        'Agent': 'Council',
        'Action': 'auto-assigned',
        'Task': task.name,
        'Details': `Auto-assigned to ${agentName} based on content type: ${task.contentType || 'keyword match'}`,
        'Type': 'Task Created',
      })
      assigned.push({ task: task.name, agent: agentName })
      // Update the task object in-memory so the runner can process it
      task.status = 'Assigned'
      task.agent = agentName
    } catch (err) {
      console.warn(`[RUNNER] Failed to auto-assign "${task.name}":`, err.message)
    }
  }

  return assigned
}

// Memory helpers
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
    // Non-critical, don't fail the run
  }
}

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60s for multiple agent runs

/**
 * Verify cron authorization
 * Accepts: Vercel cron header, Bearer token, or query param
 */
function isAuthorized(request) {
  // Vercel Cron sends this header automatically
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true // No secret = allow (dev mode)

  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${cronSecret}`) return true

  // Manual trigger via dashboard
  const url = new URL(request.url)
  if (url.searchParams.get('key') === cronSecret) return true

  return false
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const results = { processed: [], skipped: [], errors: [] }

  try {
    // 1. Fetch tasks and agents in parallel (bypass cache for fresh data)
    const [tasks, agents] = await Promise.all([
      getTasks({ noCache: true }),
      getAgents({ noCache: true }),
    ])

    // 2. AUTO-ASSIGN: Move Inbox tasks to Assigned with the right agent
    const autoAssigned = await autoAssignInboxTasks(tasks, agents)
    if (autoAssigned.length > 0) {
      console.log(`[RUNNER] Auto-assigned ${autoAssigned.length} tasks:`, autoAssigned.map(a => `${a.task} → ${a.agent}`).join(', '))
    }

    // 3. Find tasks ready for processing (increased default to 3 for Pro plan)
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '3', 10)
    const allAssigned = tasks.filter(t => t.status === 'Assigned' && t.agent)
    const assignedTasks = allAssigned.slice(0, limit)

    if (assignedTasks.length === 0) {
      return NextResponse.json({
        message: autoAssigned.length > 0
          ? `Auto-assigned ${autoAssigned.length} tasks (will process on next run)`
          : 'No tasks ready for processing',
        autoAssigned,
        duration: `${Date.now() - startTime}ms`,
        stats: {
          total: tasks.length,
          inbox: tasks.filter(t => t.status === 'Inbox').length,
          assigned: allAssigned.length,
          inProgress: tasks.filter(t => t.status === 'In Progress').length,
          review: tasks.filter(t => t.status === 'Review').length,
          done: tasks.filter(t => t.status === 'Done').length,
        },
      })
    }

    // 3. Process each assigned task
    for (const task of assignedTasks) {
      try {
        // Find the assigned agent
        const agent = agents.find(a => a.name === task.agent)
        if (!agent) {
          results.skipped.push({ task: task.name, reason: `Agent "${task.agent}" not found` })
          continue
        }

        // Skip idle agents
        if (agent.status === 'Idle') {
          results.skipped.push({ task: task.name, reason: `${agent.name} is Idle` })
          continue
        }

        console.log(`[RUNNER] Processing: "${task.name}" → ${agent.name} (${agent.model})`)

        // Log that agent is starting work
        await addActivity({
          'Agent': agent.name,
          'Action': 'started',
          'Task': task.name,
          'Details': `Processing ${task.contentType || 'content'} with ${agent.model}`,
          'Type': 'Task Created',
        })

        // Move task to In Progress immediately
        await updateTask(task.id, { 'Status': 'In Progress' })

        // Check if this is a revision (feedback was given on previous output)
        const isRevision = task.output && task.output.startsWith('[REVISION REQUESTED]')
        let feedbackContext = null
        let previousOutput = null

        if (isRevision) {
          const feedbackMatch = task.output.match(/^(?:\[REVISION REQUESTED\])\nFeedback: ([\s\S]*?)\n\n---PREVIOUS OUTPUT/)
          feedbackContext = feedbackMatch ? feedbackMatch[1].trim() : null

          // Extract the most recent previous output (everything after the first ---PREVIOUS OUTPUT (vN)--- marker)
          const prevMatch = task.output.match(/---PREVIOUS OUTPUT \(v\d+\)---\n([\s\S]*?)(?=\n---PREVIOUS OUTPUT|$)/)
          previousOutput = prevMatch ? prevMatch[1].trim() : null
        }

        // Fetch agent memories for context
        const memories = await getAgentMemories(agent.name)
        const memoryContext = memories.length > 0
          ? '\n\n## Agent Memory (Learnings from past work)\n' + memories.slice(0, 10).map(m =>
              `- [${m.type}] ${m.content}`
            ).join('\n')
          : ''

        // Pull Figma design context for PIXEL agent
        let figmaContext = ''
        if (agent.name === 'PIXEL' && isFigmaConfigured()) {
          // Look for Figma URL in task description or a dedicated field
          const figmaUrlMatch = (task.description || '').match(/(https?:\/\/[^\s]*figma\.com\/[^\s]+)/)
          if (figmaUrlMatch) {
            try {
              const ctx = await buildDesignContext(figmaUrlMatch[1])
              if (ctx) figmaContext = '\n\n' + ctx
              console.log(`[RUNNER] Pulled Figma context for PIXEL (${ctx?.length || 0} chars)`)
            } catch (err) {
              console.warn(`[RUNNER] Figma context failed: ${err.message}`)
            }
          }
        }

        // Build the prompt (with revision context if applicable)
        const userPrompt = (isRevision
          ? buildRevisionPrompt(task, feedbackContext, previousOutput)
          : buildTaskPrompt(task)) + memoryContext + figmaContext

        // Call the AI
        const output = await callAI({
          model: agent.model,
          temperature: agent.temperature,
          systemPrompt: agent.systemPrompt || `You are ${agent.name}, the ${agent.role} for Songfinch.`,
          userPrompt,
        })

        // For revisions, preserve the history chain in the output
        let finalOutput = output.substring(0, 80000) // Leave room for history
        if (isRevision && task.output) {
          // Append the revision history (feedback + previous versions)
          const historyStart = task.output.indexOf('---PREVIOUS OUTPUT')
          if (historyStart >= 0) {
            const history = task.output.substring(historyStart)
            finalOutput = finalOutput + '\n\n' + history
          }
        }

        // Save output to task and move to Review
        await updateTask(task.id, {
          'Status': 'Review',
          'Output': finalOutput.substring(0, 100000), // Airtable limit
        })

        // Save to Content Library (wrap in try-catch so task still moves to Review if content save fails)
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

        // Extract reasoning and impact from output
        const whyMatch = output.match(/(?:^|\n)\s*WHY:\s*(.+?)(?=\n\s*(?:IMPACT|LINKS)|$)/is)
        const impactMatch = output.match(/(?:^|\n)\s*IMPACT:\s*(.+?)(?=\n\s*LINKS|$)/is)
        const linksMatch = output.match(/(?:^|\n)\s*LINKS:\s*([\s\S]+?)$/im)

        let completionDetails = isRevision
          ? `Revised ${task.contentType || 'content'} based on feedback (${output.length} chars). Ready for re-review.`
          : `Generated ${task.contentType || 'content'} (${output.length} chars). Ready for review.`
        if (whyMatch) completionDetails += `\nWHY: ${whyMatch[1].trim()}`
        if (impactMatch) completionDetails += `\nIMPACT: ${impactMatch[1].trim()}`
        if (linksMatch) completionDetails += `\n${linksMatch[0].trim()}`

        // Log completion
        await addActivity({
          'Agent': agent.name,
          'Action': 'completed',
          'Task': task.name,
          'Details': completionDetails.substring(0, 5000),
          'Type': 'Content Generated',
        })

        // Save memory from revision feedback (learning moment)
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

        // Log error activity
        await addActivity({
          'Agent': task.agent || 'System',
          'Action': 'error',
          'Task': task.name,
          'Details': `Failed: ${err.message}`,
          'Type': 'Comment',
        }).catch(() => {})
      }
    }

    const duration = Date.now() - startTime

    // Log run summary
    await addActivity({
      'Agent': 'Council',
      'Action': 'completed run',
      'Task': 'Agent Runner',
      'Details': `Processed ${results.processed.length}/${assignedTasks.length} tasks in ${duration}ms. ${results.errors.length} errors.`,
      'Type': 'Comment',
    }).catch(() => {})

    return NextResponse.json({
      message: `Processed ${results.processed.length} tasks`,
      duration: `${duration}ms`,
      results,
      stats: {
        assigned: assignedTasks.length,
        processed: results.processed.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
      },
    })

  } catch (err) {
    console.error('[RUNNER] Fatal error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * Build the task prompt from task details
 */
function buildTaskPrompt(task) {
  const sections = [
    `# Task: ${task.name}`,
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
    '## Instructions',
    '- Complete this task according to your role and the output format in your system prompt.',
    '- All content must align with Songfinch brand: emotion-first, never lead with product features.',
    '- Songfinch turns moments into permanent emotional artifacts through personalized songs.',
    '- Ensure content is platform-appropriate if a specific platform is assigned.',
    '- Include A/B variations when relevant.',
    '- Be specific, detailed, and production-ready.',
    '',
    '## Required Output Sections',
    'At the END of your output, always include these sections:',
    '',
    'WHY: Explain in 1-2 sentences why you approached the task this way and the strategic reasoning behind your choices.',
    '',
    'IMPACT: Describe the expected business impact — what this content will achieve, who it will reach, and measurable outcomes when possible.',
    '',
    'If any relevant links, references, or sources were used or should be referenced, include them as:',
    'LINKS: [Label](URL) — one per line',
  )

  return sections.join('\n')
}

/**
 * Map content types to valid Airtable select options.
 * Unknown types fall back to 'General' to prevent 422 errors.
 */
const VALID_CONTENT_TYPES = new Set([
  'Ad Copy', 'Social Post', 'Video Script', 'Blog Post',
  'Landing Page', 'Artist Spotlight', 'Strategy', 'General',
])

/**
 * Build a revision prompt that includes the previous output and feedback
 */
function buildRevisionPrompt(task, feedback, previousOutput) {
  const sections = [
    `# REVISION REQUEST: ${task.name}`,
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
    'Below is your previous output that received feedback:',
    '',
    '```',
    (previousOutput || '').substring(0, 10000),
    '```',
    '',
    '## Feedback from Reviewer',
    feedback || '(no specific feedback provided)',
    '',
    '## Revision Instructions',
    '- Carefully address ALL feedback points above.',
    '- Keep what was good from the previous version.',
    '- Improve or completely rework the parts that received criticism.',
    '- The output should be a COMPLETE replacement — do not reference the previous version.',
    '- Maintain Songfinch brand voice: emotion-first, never lead with product features.',
    '- Be specific, detailed, and production-ready.',
    '',
    '## Required Output Sections',
    'At the END of your output, always include:',
    '',
    'WHY: Explain what you changed and why based on the feedback.',
    '',
    'IMPACT: Describe the expected business impact of this revised version.',
    '',
    'If any relevant links were used: LINKS: [Label](URL) — one per line',
  )

  return sections.join('\n')
}

function sanitizeContentType(type) {
  if (!type) return 'General'
  if (VALID_CONTENT_TYPES.has(type)) return type
  // Try fuzzy matching
  const lower = type.toLowerCase()
  if (lower.includes('ad') || lower.includes('copy')) return 'Ad Copy'
  if (lower.includes('social')) return 'Social Post'
  if (lower.includes('video') || lower.includes('script')) return 'Video Script'
  if (lower.includes('blog') || lower.includes('seo') || lower.includes('article')) return 'Blog Post'
  if (lower.includes('landing')) return 'Landing Page'
  if (lower.includes('strategy') || lower.includes('audit') || lower.includes('report')) return 'Strategy'
  return 'General'
}
