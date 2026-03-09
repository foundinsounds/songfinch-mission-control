// Agent Chat API — Real AI-powered conversations with individual agents and the Council
// POST: Send a message, get an AI response from the target agent
// Now supports REAL actions: agents can move tasks, reassign, create, and change priority

import { getAgents, addActivity, getTasks } from '../../../../lib/airtable'
import { callAI } from '../../../../lib/ai'
import { parseActions, executeActions, ACTION_DEFINITIONS } from '../../../../lib/chat-actions'
import { isSystemPaused } from '../../../../lib/system-config'
import { NextResponse } from 'next/server'
import { safeJsonParse, badRequest } from '../../../../lib/api-utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 30 // Allow 30s for AI response generation

// Council system prompt — used when messaging the whole council
const COUNCIL_SYSTEM_PROMPT = `You are the Songfinch Council — a collective of AI agents working together on content creation and marketing for Songfinch, a personalized song company.

When responding as the Council, speak as a unified leadership voice. Reference relevant agents by name when appropriate:
- LYRA (Creative Director) — copywriting, brand voice, emotional storytelling
- PIXEL (Visual Designer) — images, social media graphics, visual branding
- MUSE (Creative Strategist) — creative direction, campaign concepts, inspiration
- VEGA (Content Strategist) — SEO, blog posts, long-form content strategy
- SCOUT (Trend Analyst) — market research, competitor analysis, trend reports
- RHYTHM (Social Media Manager) — social posts, engagement, community
- ECHO (Email Marketer) — email campaigns, drip sequences, newsletters
- CHIEF (Quality Director) — reviews, quality scoring, approval workflow
- CMO (Marketing Director) — campaign planning, task orchestration, strategy

Be concise but insightful. You have full context on the pipeline and can discuss strategy, priorities, agent performance, and content direction. Keep responses under 200 words unless the topic warrants more detail.

${ACTION_DEFINITIONS}`

// Channel-specific system prompts for group channels
const CHANNEL_PROMPTS = {
  creative: `You are facilitating the Creative channel of the Songfinch agent council. This channel focuses on creative ideation, brand voice discussions, and content quality. Respond as the creative leadership. Keep responses focused on creative topics — brand voice, emotional storytelling, visual direction, and campaign concepts. Be concise (under 150 words).

${ACTION_DEFINITIONS}`,

  strategy: `You are facilitating the Strategy channel of the Songfinch agent council. This channel focuses on marketing strategy, campaign planning, analytics, and competitive positioning. Respond with strategic insight about content pipelines, audience targeting, and growth tactics. Be concise (under 150 words).

${ACTION_DEFINITIONS}`,

  alerts: `You are the Songfinch system alerts channel. Provide brief status updates about the pipeline, agent health, task bottlenecks, or system issues. Be extremely concise — technical and operational only.

${ACTION_DEFINITIONS}`,
}

export async function POST(request) {
  try {
    // Check system pause — still allow chat but warn user
    const paused = await isSystemPaused()

    const { data: body, error } = await safeJsonParse(request)
    if (error) return error
    const { message, channel, agentName, conversationHistory = [] } = body

    if (!message?.trim()) {
      return badRequest('Message is required')
    }

    // If paused, return a helpful message without making AI API calls
    if (paused) {
      return NextResponse.json({
        response: '⏸️ System is currently paused to conserve API credits. Use the banner toggle at the top of the dashboard to resume, then try again.',
        respondingAs: 'System',
        respondingEmoji: '⚙️',
        respondingColor: '#ef4444',
        timestamp: new Date().toISOString(),
        actions: [],
      })
    }

    // Fetch agents to get system prompts and configs
    const agents = await getAgents({ noCache: true })

    let systemPrompt
    let model = 'claude-sonnet-4-6'
    let temperature = 0.7
    let respondingAs = 'Council'
    let respondingEmoji = '\u{1F3DB}'
    let respondingColor = '#f59e0b'

    if (agentName) {
      // ── DM MODE: Chat with a specific agent ──
      const agent = agents.find(a => a.name === agentName)
      if (!agent) {
        return NextResponse.json({ error: `Agent "${agentName}" not found` }, { status: 404 })
      }

      // Use the agent's own model, temperature, and system prompt
      model = agent.model || 'claude-sonnet-4-6'
      temperature = agent.temperature ?? 0.7
      respondingAs = agent.name
      respondingEmoji = agent.emoji
      respondingColor = agent.color

      // Build a chat-aware system prompt from the agent's base prompt
      systemPrompt = buildAgentChatPrompt(agent)

    } else if (channel === 'council' || !channel) {
      // ── COUNCIL MODE: The whole council responds ──
      systemPrompt = COUNCIL_SYSTEM_PROMPT

    } else if (CHANNEL_PROMPTS[channel]) {
      // ── CHANNEL MODE: Channel-specific group chat ──
      systemPrompt = CHANNEL_PROMPTS[channel]
      respondingAs = channel.charAt(0).toUpperCase() + channel.slice(1) + ' Channel'

    } else {
      systemPrompt = COUNCIL_SYSTEM_PROMPT
    }

    // Build conversation context for multi-turn chat
    const contextMessages = conversationHistory
      .slice(-10) // Keep last 10 messages for context (avoid token bloat)
      .map(m => `${m.sender}: ${m.text}`)
      .join('\n')

    // Fetch pipeline context for richer responses
    const pipelineContext = await getPipelineContext()

    const userPrompt = `${contextMessages ? `Recent conversation:\n${contextMessages}\n\n` : ''}${pipelineContext}\n\nUser message: ${message}`

    // Call AI with the agent's model and personality
    const aiResponse = await callAI({
      model,
      temperature,
      systemPrompt,
      userPrompt,
      maxRetries: 1, // Chat should be fast — fewer retries
    })

    // ── Parse and execute any actions in the AI response ──
    const { cleanText, actions } = parseActions(aiResponse)
    let actionResults = []

    if (actions.length > 0) {
      actionResults = await executeActions(actions, { respondingAs })
    }

    // Log to activity feed for audit trail
    await addActivity({
      'Agent': respondingAs === 'Council' ? 'Council' : respondingAs,
      'Action': actions.length > 0 ? 'chat-action' : 'chat-response',
      'Task': agentName ? `DM with user` : `${channel || 'council'} channel`,
      'Details': `User: "${message.slice(0, 80)}${message.length > 80 ? '...' : ''}"${actions.length > 0 ? ` | ${actions.length} action(s) executed` : ''}`,
      'Type': actions.length > 0 ? 'Status Changed' : 'Comment',
    }).catch(err => console.warn('[CHAT] Activity log failed:', err.message))

    return NextResponse.json({
      message: cleanText,
      sender: respondingAs,
      senderEmoji: respondingEmoji,
      senderColor: respondingColor,
      model,
      timestamp: new Date().toISOString(),
      actions: actionResults,
    })

  } catch (err) {
    console.error('[CHAT] Error:', err)

    // Differentiate error types for better UX feedback
    const isBudget = err.message?.startsWith('BUDGET_EXCEEDED:')
    const isPayment = err.message?.includes('402') || err.message?.toLowerCase().includes('insufficient')
    const isRateLimit = err.message?.includes('429') || err.message?.toLowerCase().includes('rate limit')
    const isTimeout = err.message?.includes('timeout') || err.message?.includes('ETIMEDOUT')
    const isAuth = err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('auth')

    const status = isBudget ? 429 : isPayment ? 402 : isRateLimit ? 429 : isAuth ? 403 : isTimeout ? 504 : 500
    const fallbackMessage = isBudget
      ? "⚠️ Daily API budget reached. Use the budget slider in the control bar to increase the limit, or wait until tomorrow when the counter resets."
      : isPayment
        ? "💳 API credits exhausted. Please add credits to your AI provider account, or switch to a different provider."
        : isRateLimit
          ? "I'm being rate limited right now. Please wait a moment and try again."
          : isTimeout
            ? "The request timed out. The AI service might be slow — try again shortly."
            : isAuth
              ? "Authentication error. Please check that API keys are configured correctly."
              : "I'm having trouble connecting right now. Please try again in a moment."

    return NextResponse.json({
      error: err.message,
      fallbackMessage,
      errorType: isBudget ? 'budget_exceeded' : isPayment ? 'payment' : isRateLimit ? 'rate_limit' : isTimeout ? 'timeout' : isAuth ? 'auth' : 'server_error',
    }, { status })
  }
}

// ── Helpers ─────────────────────────────────────

/**
 * Build a chat-specific system prompt for an agent.
 * Uses their base system prompt but adds conversational framing and action capabilities.
 */
function buildAgentChatPrompt(agent) {
  const basePrompt = agent.systemPrompt || `You are ${agent.name}, the ${agent.role} for Songfinch.`

  return `${basePrompt}

You are now in a direct chat conversation with the human operator of the Songfinch Mission Control dashboard.

Chat guidelines:
- Be conversational but professional. You ARE ${agent.name} (${agent.emoji}).
- Share your perspective based on your role as ${agent.role}.
- If asked about tasks or pipeline status, reference your current workload.
- If given instructions or feedback, acknowledge them and take action using the action tags below.
- Keep responses concise (under 200 words) unless the topic requires detail.
- You can express opinions, make suggestions, and even respectfully push back if you disagree.
- Reference your specialty and how it connects to the broader Songfinch mission.

${ACTION_DEFINITIONS}`
}

/**
 * Fetch detailed pipeline context so agents can reference current state and take actions.
 */
async function getPipelineContext() {
  try {
    const tasks = await getTasks({ noCache: true })

    const byStatus = {}
    tasks.forEach(t => {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1
    })

    const totalDone = byStatus['Done'] || 0
    const totalActive = (byStatus['In Progress'] || 0) + (byStatus['Assigned'] || 0)
    const totalInbox = byStatus['Inbox'] || 0
    const totalReview = byStatus['Review'] || 0
    const totalRevisit = byStatus['Revisit'] || 0

    // Include recent active task names for action context
    const activeTasks = tasks
      .filter(t => t.status !== 'Done')
      .slice(0, 20)
      .map(t => `- "${t.name}" [${t.status}]${t.agent ? ` (${t.agent})` : ''} [${t.priority}]`)
      .join('\n')

    return `[Pipeline: ${tasks.length} total | ${totalDone} done | ${totalActive} active | ${totalInbox} inbox | ${totalReview} review | ${totalRevisit} revisit]
Active tasks:\n${activeTasks || '(none)'}`
  } catch {
    return '[Pipeline context unavailable]'
  }
}
