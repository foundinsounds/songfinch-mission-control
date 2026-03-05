// AI API Client for Songfinch Agent Runner
// Routes to Claude, GPT, or Gemini based on agent model config
// Uses raw fetch — zero dependencies

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const GOOGLE_AI_API_KEY = (process.env.GOOGLE_AI_KEY || process.env.GOOGLE_AI_API_KEY || '').replace(/^["']|["']$/g, '')

// Model name → API model ID mapping
const MODEL_MAP = {
  'claude-sonnet-4-6': 'claude-sonnet-4-20250514',
  'claude-sonnet-4': 'claude-sonnet-4-20250514',
  'claude-3.5-sonnet': 'claude-sonnet-4-20250514',
  'claude-3-opus': 'claude-sonnet-4-20250514',
  'claude-3-haiku': 'claude-haiku-4-5-20251001',
  'claude-3.5-haiku': 'claude-haiku-4-5-20251001',
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
 * Includes automatic retry with exponential backoff for transient failures.
 * On persistent rate limits (429), automatically falls back to next provider.
 */
export async function callAI({ model, temperature, systemPrompt, userPrompt, maxRetries = 2 }) {
  const primaryProvider = getProvider(model)

  // Build provider chain for fallback on persistent rate limits
  const providerChain = [primaryProvider, ...getAlternativeProviders(primaryProvider)]

  for (let pi = 0; pi < providerChain.length; pi++) {
    const provider = providerChain[pi]
    if (!provider) continue

    const callFn = () => {
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

    try {
      return await retryWithBackoff(callFn, {
        maxRetries,
        baseDelay: 2000,
        maxDelay: 20000,
        label: `${provider}/${model}`,
      })
    } catch (err) {
      const isRateLimit = /429|rate.?limit/i.test(err.message || '')
      if (isRateLimit && pi < providerChain.length - 1) {
        const next = providerChain[pi + 1]
        console.warn(`[AI] ${provider} rate-limited after ${maxRetries} retries, falling back to ${next}`)
        continue // Try next provider
      }
      throw err // Non-rate-limit error or last provider — propagate
    }
  }

  throw new Error(`No AI API key configured. Add ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_AI_API_KEY to .env.local`)
}

/**
 * Get alternative providers in fallback order, excluding the primary.
 */
function getAlternativeProviders(primary) {
  const all = []
  if (OPENAI_API_KEY && primary !== 'openai') all.push('openai')
  if (GOOGLE_AI_API_KEY && primary !== 'google') all.push('google')
  if (ANTHROPIC_API_KEY && primary !== 'anthropic') all.push('anthropic')
  return all
}

/**
 * Retry a function with exponential backoff + jitter.
 * Only retries on transient errors (429, 500, 502, 503, 529, network).
 */
async function retryWithBackoff(fn, { maxRetries = 3, baseDelay = 1000, maxDelay = 15000, label = 'AI' } = {}) {
  let lastError
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const isRetryable = isTransientError(err)
      if (!isRetryable || attempt === maxRetries) {
        throw err
      }
      const delay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt)) + Math.random() * 500
      console.warn(`[AI] ${label} attempt ${attempt + 1} failed (${err.message}), retrying in ${Math.round(delay)}ms...`)
      await sleep(delay)
    }
  }
  throw lastError
}

function isTransientError(err) {
  const msg = err.message || ''
  // Rate limits, server errors, overloaded
  if (/429|500|502|503|529|overloaded|rate.?limit|timeout|ECONNRESET|ETIMEDOUT|fetch failed/i.test(msg)) return true
  // Network errors
  if (/network|socket|ENOTFOUND/i.test(msg)) return true
  return false
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
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
    case 'anthropic': return 'claude-sonnet-4-20250514'
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
      max_tokens: 4096,
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
