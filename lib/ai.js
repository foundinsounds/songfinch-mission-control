// AI API Client for Songfinch Agent Runner
// Routes to Claude, GPT, or Gemini based on agent model config
// Uses raw fetch — zero dependencies

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY

// Model name → API model ID mapping
const MODEL_MAP = {
  'claude-sonnet-4-6': 'claude-sonnet-4-6-20250514',
  'claude-sonnet-4': 'claude-sonnet-4-20250514',
  'claude-3.5-sonnet': 'claude-sonnet-4-20250514',
  'claude-3-opus': 'claude-opus-4-20250514',
  'claude-3-haiku': 'claude-3-5-haiku-20241022',
  'claude-3.5-haiku': 'claude-3-5-haiku-20241022',
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'gpt-4o-mini',
  'gpt-4-turbo': 'gpt-4-turbo',
  'gemini-2.0-flash': 'gemini-2.0-flash',
  'gemini-1.5-pro': 'gemini-1.5-pro',
  'gemini-pro': 'gemini-1.5-pro',
  'gemini-flash': 'gemini-2.0-flash',
}

/**
 * Call AI with the appropriate provider based on model name.
 * Falls back: Claude → OpenAI → Google AI if keys are missing.
 */
export async function callAI({ model, temperature, systemPrompt, userPrompt }) {
  const provider = getProvider(model)

  switch (provider) {
    case 'anthropic':
      return callClaude({ model, temperature, systemPrompt, userPrompt })
    case 'openai':
      return callOpenAI({ model, temperature, systemPrompt, userPrompt })
    case 'google':
      return callGemini({ model, temperature, systemPrompt, userPrompt })
    default:
      throw new Error(`No AI API key configured. Add ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_AI_API_KEY to .env.local`)
  }
}

/**
 * Determine which provider to use, with smart fallback
 */
function getProvider(model) {
  const isClaude = model?.startsWith('claude')
  const isGPT = model?.startsWith('gpt') || model?.startsWith('o1')
  const isGemini = model?.startsWith('gemini')

  // Direct match
  if (isClaude && ANTHROPIC_API_KEY) return 'anthropic'
  if (isGPT && OPENAI_API_KEY) return 'openai'
  if (isGemini && GOOGLE_AI_API_KEY) return 'google'

  // Fallback chain: OpenAI → Google → Anthropic
  if (OPENAI_API_KEY) return 'openai'
  if (GOOGLE_AI_API_KEY) return 'google'
  if (ANTHROPIC_API_KEY) return 'anthropic'

  return null
}

/**
 * Get the fallback model name for a provider
 */
function getFallbackModel(provider) {
  switch (provider) {
    case 'openai': return 'gpt-4o'
    case 'google': return 'gemini-1.5-pro'
    case 'anthropic': return 'claude-sonnet-4-6-20250514'
    default: return 'gpt-4o'
  }
}

// ---- ANTHROPIC (Claude) ----

async function callClaude({ model, temperature, systemPrompt, userPrompt }) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const apiModel = MODEL_MAP[model] || model

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: apiModel,
      max_tokens: 2048,
      temperature: temperature ?? 0.7,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Claude API error: ${res.status} - ${error}`)
  }

  const data = await res.json()
  return data.content[0].text
}

// ---- OPENAI (GPT) ----

async function callOpenAI({ model, temperature, systemPrompt, userPrompt }) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  // If model is a Claude model, use GPT-4o as fallback
  const apiModel = model?.startsWith('claude') ? 'gpt-4o' : (MODEL_MAP[model] || model || 'gpt-4o')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: apiModel,
      temperature: temperature ?? 0.7,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`OpenAI API error: ${res.status} - ${error}`)
  }

  const data = await res.json()
  return data.choices[0].message.content
}

// ---- GOOGLE AI (Gemini) ----

async function callGemini({ model, temperature, systemPrompt, userPrompt }) {
  if (!GOOGLE_AI_API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY not configured')
  }

  const apiModel = model?.startsWith('gemini') ? (MODEL_MAP[model] || model) : 'gemini-1.5-pro'

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${GOOGLE_AI_API_KEY}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: temperature ?? 0.7,
        maxOutputTokens: 4096,
      },
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Gemini API error: ${res.status} - ${error}`)
  }

  const data = await res.json()
  return data.candidates[0].content.parts[0].text
}
