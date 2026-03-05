// Orchestration Layer — Campaign Context, Squad Templates, Structured Handoffs
// Implements Roundtable v4.0 spec: two-stage briefs, shared context, priority queue
// This module makes agents context-aware and collaborative instead of isolated

// ── SQUAD TEMPLATES ────────────────────────────────
// Pre-defined agent groupings for different campaign needs

export const SQUAD_TEMPLATES = {
  CONTENT: {
    name: 'Content Squad',
    agents: ['STORY', 'HOOK', 'PULSE'],
    description: 'Long-form content, headlines/CTAs, and social distribution',
    use: 'Standard content production — blog posts, social media, email newsletters',
  },
  DISTRIBUTION: {
    name: 'Distribution Squad',
    agents: ['PULSE', 'FLOW', 'HOOK'],
    description: 'Social media, landing pages/SEO, and ad copy',
    use: 'Campaign amplification — getting content across channels',
  },
  FULL_CAMPAIGN: {
    name: 'Full Campaign Squad',
    agents: ['STORY', 'HOOK', 'PULSE', 'LENS', 'FLOW', 'PIXEL', 'SCOUT'],
    description: 'All specialist agents for comprehensive campaign execution',
    use: 'Major campaigns requiring all content types and channels',
  },
  RESEARCH: {
    name: 'Research Squad',
    agents: ['SCOUT', 'STORY'],
    description: 'Intelligence gathering and long-form analysis',
    use: 'SEO research, competitive analysis, trend reports',
  },
  VISUAL: {
    name: 'Visual Squad',
    agents: ['LENS', 'PIXEL', 'PULSE'],
    description: 'Video scripts, landing page design, and visual social content',
    use: 'Visually-driven campaigns — video-first, design-heavy',
  },
}

// ── PRIORITY QUEUE ──────────────────────────────────
// P1 (urgent revisions) > P2 (standard revisions) > P3 (new briefs)

export const PRIORITY_TIERS = {
  P1: { label: 'Urgent Revision', weight: 100, description: 'Revisions from CHIEF with score < 2.5 or 3rd+ revision' },
  P2: { label: 'Standard Revision', weight: 60, description: 'Normal revision requests from CHIEF' },
  P3: { label: 'New Brief', weight: 30, description: 'Fresh tasks from CMO campaign planning' },
}

/**
 * Assigns a priority tier to a task based on its state.
 * Revision tasks get P1/P2 based on severity; new tasks get P3.
 */
export function assignPriorityTier(task, activityHistory = []) {
  const isRevision = task.status === 'Assigned' && task.output?.includes('[REVISION REQUESTED]')

  if (!isRevision) return 'P3'

  // Count how many times this task has been revised
  const revisionCount = activityHistory.filter(
    a => a.task === task.name && a.action === 'revised'
  ).length

  // Check if CHIEF gave a harsh score (< 2.5)
  const lastReview = activityHistory
    .filter(a => a.task === task.name && a.action === 'approved' || a.action === 'revised')
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]

  const scoreMatch = lastReview?.details?.match(/\((\d+\.?\d*)\/5\)/)
  const lastScore = scoreMatch ? parseFloat(scoreMatch[1]) : null

  // P1: harsh score or 3rd+ revision attempt
  if ((lastScore && lastScore < 2.5) || revisionCount >= 2) return 'P1'

  return 'P2'
}

/**
 * Sorts tasks by priority tier, then by existing priority score.
 * P1 tasks always process before P2, which process before P3.
 */
export function sortByPriorityTier(tasks, activityHistory = []) {
  return [...tasks].sort((a, b) => {
    const tierA = assignPriorityTier(a, activityHistory)
    const tierB = assignPriorityTier(b, activityHistory)
    const weightA = PRIORITY_TIERS[tierA].weight
    const weightB = PRIORITY_TIERS[tierB].weight

    if (weightA !== weightB) return weightB - weightA // Higher weight first

    // Within same tier, use existing priority field
    const priorityOrder = { High: 3, Medium: 2, Low: 1 }
    return (priorityOrder[b.priority] || 1) - (priorityOrder[a.priority] || 1)
  })
}

// ── CAMPAIGN STATUS TRACKING ────────────────────────
// Campaign-level lifecycle: Queued → In Production → In Review → Revision → Done

export const CAMPAIGN_STATUSES = ['Queued', 'In Production', 'In Review', 'Revision', 'Done']

/**
 * Derives campaign status from its constituent tasks.
 * A campaign is only as far along as its least-progressed task.
 */
export function deriveCampaignStatus(campaignTasks) {
  if (!campaignTasks?.length) return 'Queued'

  const statuses = campaignTasks.map(t => t.status)
  const all = (s) => statuses.every(st => st === s)
  const any = (s) => statuses.some(st => st === s)
  const none = (s) => !statuses.some(st => st === s)

  if (all('Done')) return 'Done'
  if (any('Review')) return 'In Review'
  if (any('In Progress') || any('Assigned')) return 'In Production'
  if (any('Planned') || any('Inbox')) return 'Queued'

  // Mixed state — check for revisions
  if (statuses.some(s => s === 'Assigned') && campaignTasks.some(t => t.output?.includes('[REVISION REQUESTED]'))) {
    return 'Revision'
  }

  return 'In Production'
}

/**
 * Groups tasks by campaign name and derives status for each.
 */
export function getCampaignBoard(tasks) {
  const campaigns = {}

  for (const task of tasks) {
    const campaign = task.campaign || 'Uncategorized'
    if (!campaigns[campaign]) {
      campaigns[campaign] = { name: campaign, tasks: [], status: 'Queued' }
    }
    campaigns[campaign].tasks.push(task)
  }

  for (const campaign of Object.values(campaigns)) {
    campaign.status = deriveCampaignStatus(campaign.tasks)
    campaign.taskCount = campaign.tasks.length
    campaign.completedCount = campaign.tasks.filter(t => t.status === 'Done').length
    campaign.progress = campaign.taskCount > 0
      ? Math.round((campaign.completedCount / campaign.taskCount) * 100)
      : 0
  }

  return campaigns
}

// ── CAMPAIGN CONTEXT THREADS ────────────────────────
// Shared context that flows between agents working on the same campaign

/**
 * Builds a campaign context object from all tasks and activity in that campaign.
 * This is injected into agent prompts so they know what's already been produced.
 */
export function buildCampaignContext(campaignName, tasks, activityHistory) {
  const campaignTasks = tasks.filter(t => t.campaign === campaignName)
  const campaignActivity = activityHistory.filter(a => {
    const taskNames = campaignTasks.map(t => t.name)
    return taskNames.includes(a.task)
  })

  // Gather completed outputs as context for remaining agents
  const completedWork = campaignTasks
    .filter(t => t.status === 'Done' && t.output)
    .map(t => ({
      agent: t.agent,
      contentType: t.contentType,
      taskName: t.name,
      // Include first 500 chars of output as context — enough for tone/style alignment
      outputPreview: t.output.substring(0, 500),
    }))

  // Extract handoff notes from activity feed
  const handoffs = campaignActivity
    .filter(a => a.details?.includes('[HANDOFF]'))
    .map(a => ({
      from: a.agent,
      task: a.task,
      note: a.details.replace('[HANDOFF] ', ''),
      timestamp: a.timestamp,
    }))

  // Detect the strategic brief (CMO's campaign plan)
  const strategicBrief = campaignActivity
    .find(a => a.agent === 'CMO' && (a.action === 'planned' || a.details?.includes('Campaign planned')))

  // Detect creative direction (MUSE's interpretation)
  const creativeDirection = campaignActivity
    .find(a => a.agent === 'MUSE' && a.details?.includes('[CREATIVE DIRECTION]'))

  return {
    campaign: campaignName,
    status: deriveCampaignStatus(campaignTasks),
    totalTasks: campaignTasks.length,
    completedTasks: campaignTasks.filter(t => t.status === 'Done').length,
    strategicBrief: strategicBrief?.details || null,
    creativeDirection: creativeDirection?.details || null,
    completedWork,
    handoffs,
    pendingAgents: [...new Set(
      campaignTasks.filter(t => t.status !== 'Done').map(t => t.agent).filter(Boolean)
    )],
  }
}

/**
 * Formats campaign context into a prompt-injectable string.
 * Agents receive this so they can align with the campaign's tone and existing work.
 */
export function formatCampaignContextForPrompt(context) {
  if (!context || !context.campaign) return ''

  const lines = [
    `\n═══ CAMPAIGN CONTEXT: "${context.campaign}" ═══`,
    `Status: ${context.status} (${context.completedTasks}/${context.totalTasks} complete)`,
  ]

  if (context.strategicBrief) {
    lines.push(`\n── CMO Strategic Brief ──\n${context.strategicBrief.substring(0, 600)}`)
  }

  if (context.creativeDirection) {
    lines.push(`\n── MUSE Creative Direction ──\n${context.creativeDirection.substring(0, 600)}`)
  }

  if (context.completedWork.length > 0) {
    lines.push(`\n── Completed Work (align tone & messaging) ──`)
    for (const work of context.completedWork.slice(0, 5)) {
      lines.push(`• ${work.agent} (${work.contentType}): ${work.outputPreview.substring(0, 200)}...`)
    }
  }

  if (context.handoffs.length > 0) {
    lines.push(`\n── Handoff Notes ──`)
    for (const h of context.handoffs.slice(-3)) {
      lines.push(`• From ${h.from}: ${h.note.substring(0, 200)}`)
    }
  }

  if (context.pendingAgents.length > 0) {
    lines.push(`\nOther agents still working: ${context.pendingAgents.join(', ')}`)
  }

  lines.push(`═══════════════════════════════════════════\n`)
  return lines.join('\n')
}

// ── STRUCTURED HANDOFFS ─────────────────────────────
// Agents pass context to the next agent in the pipeline

/**
 * Builds a structured handoff note from an agent's completed work.
 * Format: Deliverable | Decisions Made | Dependencies | Flags
 */
export function buildHandoffNote({ agent, contentType, decisions, dependencies, flags }) {
  const parts = [
    `[HANDOFF] From: ${agent}`,
    `Deliverable: ${contentType}`,
  ]

  if (decisions?.length) {
    parts.push(`Decisions: ${decisions.join('; ')}`)
  }
  if (dependencies?.length) {
    parts.push(`Dependencies: ${dependencies.join('; ')}`)
  }
  if (flags?.length) {
    parts.push(`Flags: ${flags.join('; ')}`)
  }

  return parts.join(' | ')
}

/**
 * Extracts structured handoff data from an activity detail string.
 */
export function parseHandoffNote(details) {
  if (!details?.includes('[HANDOFF]')) return null

  const parts = details.replace('[HANDOFF] ', '').split(' | ')
  const parsed = {}

  for (const part of parts) {
    const [key, ...valueParts] = part.split(': ')
    const value = valueParts.join(': ')
    const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '_')
    if (normalizedKey === 'decisions' || normalizedKey === 'dependencies' || normalizedKey === 'flags') {
      parsed[normalizedKey] = value.split('; ').map(s => s.trim())
    } else {
      parsed[normalizedKey] = value
    }
  }

  return parsed
}

// ── TWO-STAGE CAMPAIGN BRIEF ────────────────────────
// Stage 1: CMO creates strategic brief → Stage 2: MUSE adds creative direction

/**
 * Determines if a campaign needs MUSE creative direction before execution.
 * Returns true if CMO has planned but MUSE hasn't added creative direction yet.
 */
export function needsCreativeDirection(campaignName, activityHistory) {
  const campaignActivities = activityHistory.filter(
    a => a.details?.includes(campaignName) || a.task?.includes(campaignName)
  )

  const hasCMOBrief = campaignActivities.some(
    a => a.agent === 'CMO' && (a.action === 'planned' || a.details?.includes('Campaign planned'))
  )
  const hasMuseDirection = campaignActivities.some(
    a => a.agent === 'MUSE' && a.details?.includes('[CREATIVE DIRECTION]')
  )

  return hasCMOBrief && !hasMuseDirection
}

/**
 * Generates a MUSE creative direction task for a campaign.
 * This is Stage 2 of the two-stage brief system.
 */
export function createCreativeDirectionTask(campaignName, cmoBriefDetails) {
  return {
    'Task Name': `Creative Direction: ${campaignName}`,
    'Description': `MUSE: Review CMO's strategic brief and establish the creative direction for campaign "${campaignName}". Define the emotional territory, visual mood, tone of voice, and narrative approach that all agents should follow.\n\nCMO Brief:\n${cmoBriefDetails || 'See campaign context for strategic brief.'}`,
    'Agent': 'MUSE',
    'Status': 'Assigned',
    'Content Type': 'Campaign Brief',
    'Campaign': campaignName,
    'Priority': 'High',
  }
}

// ── SQUAD ASSIGNMENT ────────────────────────────────
// Assigns the right squad template based on campaign requirements

/**
 * Recommends a squad template based on the content types needed.
 */
export function recommendSquad(contentTypes) {
  if (!contentTypes?.length) return SQUAD_TEMPLATES.CONTENT

  const types = contentTypes.map(t => t.toLowerCase())

  const hasVideo = types.some(t => t.includes('video'))
  const hasLanding = types.some(t => t.includes('landing'))
  const hasSocial = types.some(t => t.includes('social'))
  const hasEmail = types.some(t => t.includes('email'))
  const hasBlog = types.some(t => t.includes('blog') || t.includes('article'))
  const hasAd = types.some(t => t.includes('ad'))
  const hasResearch = types.some(t => t.includes('research') || t.includes('seo'))

  // If it touches 4+ content types, use full squad
  if (types.length >= 4) return SQUAD_TEMPLATES.FULL_CAMPAIGN

  // Visual-heavy
  if (hasVideo && hasLanding) return SQUAD_TEMPLATES.VISUAL

  // Distribution-focused
  if (hasSocial && (hasAd || hasEmail || hasLanding)) return SQUAD_TEMPLATES.DISTRIBUTION

  // Research-first
  if (hasResearch && hasBlog) return SQUAD_TEMPLATES.RESEARCH

  // Default to content squad
  return SQUAD_TEMPLATES.CONTENT
}

// ── CMO PROACTIVE PLANNING ──────────────────────────
// CMO should always stay 2-3 briefs ahead of execution

/**
 * Determines if CMO should proactively plan more campaigns.
 * Returns true if the pipeline needs more work queued up.
 */
export function shouldCMOPlan(tasks) {
  const queued = tasks.filter(t => t.status === 'Planned' || t.status === 'Inbox')
  const inProgress = tasks.filter(t =>
    t.status === 'Assigned' || t.status === 'In Progress'
  )
  const inReview = tasks.filter(t => t.status === 'Review')

  const workingPipeline = inProgress.length + inReview.length
  const queueDepth = queued.length

  // CMO plans when: queue is thin (<8) OR working pipeline is light (<15)
  // This ensures CMO stays 2-3 briefs ahead at all times
  return queueDepth < 8 || workingPipeline < 15
}

/**
 * Suggests content types that the pipeline is underproducing.
 * Helps CMO diversify content mix instead of repeating the same types.
 */
export function suggestContentGaps(tasks, activityHistory) {
  const TARGET_TYPES = [
    'Blog Post', 'Social Media Post', 'Email Newsletter', 'Landing Page',
    'Video Script', 'Ad Copy', 'Product Description', 'Case Study',
    'Press Release', 'SEO Article',
  ]

  // Count recent completions by type (last 50 completed tasks)
  const recentDone = tasks
    .filter(t => t.status === 'Done')
    .slice(-50)

  const typeCounts = {}
  for (const type of TARGET_TYPES) {
    typeCounts[type] = recentDone.filter(t => t.contentType === type).length
  }

  // Find types with lowest representation
  const sorted = Object.entries(typeCounts).sort((a, b) => a[1] - b[1])

  return sorted
    .slice(0, 3)
    .map(([type, count]) => ({ type, count, gap: 'underproduced' }))
}

// ── MUSE CREATIVE QA GATE ───────────────────────────
// Before CHIEF review, MUSE checks creative alignment

/**
 * Determines if a task should go through MUSE creative QA before CHIEF review.
 * Creative content types benefit from MUSE QA; technical/research types skip it.
 */
export function needsMuseQA(task) {
  const CREATIVE_TYPES = [
    'Blog Post', 'Social Media Post', 'Ad Copy', 'Video Script',
    'Email Newsletter', 'Product Description', 'Press Release',
  ]
  const SKIP_QA_TYPES = ['SEO Article', 'Case Study', 'Landing Page']

  if (SKIP_QA_TYPES.includes(task.contentType)) return false
  if (CREATIVE_TYPES.includes(task.contentType)) return true

  // Default: QA creative content, skip technical
  return task.agent !== 'SCOUT' && task.agent !== 'FLOW'
}

/**
 * Builds a MUSE creative QA prompt for reviewing content before CHIEF.
 * MUSE checks creative alignment, not factual correctness (that's CHIEF's job).
 */
export function buildMuseQAPrompt(task, campaignContext) {
  return `You are MUSE, the Creative Director of the Roundtable.

CREATIVE QA REVIEW — Quick creative alignment check before CHIEF's quality review.

Task: "${task.name}"
Content Type: ${task.contentType}
Agent: ${task.agent}
${campaignContext ? `Campaign: ${campaignContext.campaign}` : ''}

${campaignContext?.creativeDirection ? `Your Creative Direction for this campaign:\n${campaignContext.creativeDirection}\n` : ''}

Content to review:
---
${task.output?.substring(0, 3000) || '[No output]'}
---

Evaluate ONLY these creative aspects (CHIEF handles quality/accuracy):
1. NARRATIVE LADDER: Does it follow Emotion → Insight → Impact → Songfinch?
2. EMOTIONAL TERRITORY: Is the emotional pillar clear and authentic?
3. TONE ALIGNMENT: Does the tone match the campaign's creative direction?
4. HOOK STRENGTH: Does the opening grab attention within 3 seconds?
5. SONGFINCH CONNECTION: Is Songfinch positioned as the bridge, not the product?

Respond in this exact format:
CREATIVE_SCORE: X.X/5
CREATIVE_VERDICT: PASS or NEEDS_POLISH
CREATIVE_NOTES: [1-2 sentences of actionable creative feedback]
POLISH_SUGGESTION: [If NEEDS_POLISH, specific improvement. If PASS, write "None"]`
}

/**
 * Parses MUSE's creative QA verdict.
 */
export function parseMuseQAVerdict(output) {
  const scoreMatch = output.match(/CREATIVE_SCORE:\s*(\d+\.?\d*)/)
  const verdictMatch = output.match(/CREATIVE_VERDICT:\s*(PASS|NEEDS_POLISH)/i)
  const notesMatch = output.match(/CREATIVE_NOTES:\s*(.+?)(?:\n|$)/)
  const polishMatch = output.match(/POLISH_SUGGESTION:\s*(.+?)(?:\n|$)/)

  return {
    score: scoreMatch ? parseFloat(scoreMatch[1]) : null,
    verdict: verdictMatch ? verdictMatch[1].toUpperCase() : 'PASS',
    notes: notesMatch ? notesMatch[1].trim() : '',
    polishSuggestion: polishMatch ? polishMatch[1].trim() : '',
  }
}

// ── NON-BLOCKING REVIEW ─────────────────────────────
// Review is a side channel — agents submit work and immediately move on

/**
 * Gets the next available task for an agent, skipping any in Review.
 * This implements "review is a side channel, not a gate."
 */
export function getNextAvailableTask(agent, tasks) {
  return tasks
    .filter(t =>
      t.agent === agent &&
      (t.status === 'Assigned' || t.status === 'Inbox') &&
      !t.output?.includes('[REVISION REQUESTED]')
    )
    .sort((a, b) => {
      // Assigned before Inbox
      if (a.status !== b.status) return a.status === 'Assigned' ? -1 : 1
      // Higher priority first
      const priorityOrder = { High: 3, Medium: 2, Low: 1 }
      return (priorityOrder[b.priority] || 1) - (priorityOrder[a.priority] || 1)
    })[0] || null
}
