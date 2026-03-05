// AI-powered agent improvement suggestions
// Analyzes agent config + performance and returns actionable improvements

import { callAI } from '../../../../lib/ai'
import { MODEL_OPTIONS } from '../../../../lib/constants'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const { agent, action } = await request.json()

    if (!agent) {
      return NextResponse.json({ error: 'agent is required' }, { status: 400 })
    }

    if (action === 'suggest-prompt') {
      return await suggestSystemPrompt(agent)
    }

    if (action === 'improve') {
      return await generateImprovements(agent)
    }

    return NextResponse.json({ error: 'Invalid action. Use "improve" or "suggest-prompt"' }, { status: 400 })
  } catch (error) {
    console.error('[IMPROVE] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function suggestSystemPrompt(agent) {
  const prompt = `You are a prompt engineering expert. Generate an optimized system prompt for an AI marketing agent.

AGENT DETAILS:
- Name: ${agent.name}
- Role: ${agent.role}
- Type: ${agent.type} (${getTypeLabel(agent.type)})
- Organization: Songfinch (personalized songs platform)
- Current System Prompt: ${agent.systemPrompt ? `"${agent.systemPrompt.substring(0, 2000)}"` : '(empty)'}

REQUIREMENTS:
- The agent works for Songfinch, a company that turns meaningful moments into personalized songs
- Brand voice: warm, personal, celebratory, authentic, emotion-first
- Never lead with product features — lead with the emotional moment
- The agent should produce content that is production-ready
- Include specific output format requirements
- Include platform-specific guidelines if relevant to the role
- Include A/B variation instructions where relevant
- End every output with WHY (strategic reasoning), IMPACT (expected results), and optional LINKS sections

Generate a complete, detailed system prompt (500-1500 words). Return ONLY the system prompt text, no explanations or markdown wrapping.`

  const result = await callAI({
    model: 'claude-sonnet-4-6',
    temperature: 0.7,
    systemPrompt: 'You are a world-class prompt engineer specializing in AI agent systems for marketing teams.',
    userPrompt: prompt,
  })

  return NextResponse.json({ success: true, prompt: result })
}

async function generateImprovements(agent) {
  // Build available models list so the AI doesn't hallucinate model names
  const modelList = MODEL_OPTIONS.map(m => `  - ${m.value} (${m.label}, ${m.provider})`).join('\n')

  const prompt = `Analyze this AI marketing agent and provide 5 specific, actionable improvements.

AGENT DETAILS:
- Name: ${agent.name}
- Role: ${agent.role}
- Type: ${agent.type} (${getTypeLabel(agent.type)})
- Current Model: ${agent.model}
- Temperature: ${agent.temperature}
- Tasks Completed: ${agent.tasksCompleted || 0}
- System Prompt Length: ${agent.systemPrompt?.length || 0} characters
- System Prompt Preview: ${agent.systemPrompt ? `"${agent.systemPrompt.substring(0, 1000)}"` : '(empty)'}
- Organization: Songfinch (personalized songs platform)

AVAILABLE MODELS (ONLY reference these — do NOT suggest models not on this list):
${modelList}

IMPORTANT: The agent is already using "${agent.model}". If it's already on the best model for its role, say so — do NOT suggest upgrading to a model that doesn't exist or is older. "claude-sonnet-4-6" is the latest and most capable default model. Only suggest a different model if there's a genuine reason (e.g. cost optimization with Haiku, or using GPT-4o for specific strengths).

Return a JSON array of exactly 5 improvement objects:
[
  {
    "area": "Short area name",
    "suggestion": "Detailed actionable suggestion",
    "impact": "High" | "Medium" | "Low",
    "action": "config" | "prompt" | "workflow" | "model"
  }
]

Focus on practical improvements for:
1. System prompt quality and specificity
2. Model selection optimization (using ONLY the available models listed above)
3. Temperature tuning
4. Output quality improvements
5. Workflow efficiency

Return ONLY valid JSON, no other text.`

  const result = await callAI({
    model: 'claude-sonnet-4-6',
    temperature: 0.5,
    systemPrompt: 'You are an AI operations expert. Always return valid JSON.',
    userPrompt: prompt,
  })

  // Parse the JSON response
  let improvements
  try {
    // Handle potential markdown code blocks
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    improvements = JSON.parse(cleaned)
  } catch {
    improvements = [
      { area: 'System Prompt', suggestion: 'Add detailed role instructions and output format requirements', impact: 'High', action: 'prompt' },
      { area: 'Temperature', suggestion: 'Adjust temperature based on content type needs', impact: 'Medium', action: 'config' },
      { area: 'Output Quality', suggestion: 'Include brand voice guidelines and A/B variation instructions', impact: 'High', action: 'prompt' },
      { area: 'Platform Targeting', suggestion: 'Add platform-specific formatting rules', impact: 'Medium', action: 'prompt' },
      { area: 'Performance', suggestion: 'Consider model upgrade for complex tasks', impact: 'Low', action: 'model' },
    ]
  }

  return NextResponse.json({ success: true, improvements })
}

function getTypeLabel(type) {
  const labels = {
    EXEC: 'Executive — Strategic leadership',
    OPS: 'Operations — Workflow management',
    LEAD: 'Lead — Creative direction',
    SPC: 'Specialist — Content production',
    INT: 'Intelligence — Research & analysis',
  }
  return labels[type] || 'Specialist'
}
