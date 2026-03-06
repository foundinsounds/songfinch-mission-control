// Gemini Image Generation Client for Songfinch Agent Pipeline
// Uses Google's Gemini Imagen API to generate marketing visuals
// Drop-in replacement for DALL-E 3 — same interface, different engine
// Called by LENS agent and /api/generate/image endpoint

import {
  PRESET_SUFFIXES,
  buildEnhancedPrompt,
  autoPreset,
  extractVisualPrompt,
} from './image-shared.js'

// Strip quotes if env var was stored with them (common Vercel dashboard paste issue)
const GOOGLE_AI_KEY = (process.env.GOOGLE_AI_KEY || process.env.GOOGLE_AI_API_KEY || '').replace(/^["']|["']$/g, '')

// Gemini format presets (aspectRatio is Gemini-specific)
const STYLE_PRESETS = {
  social:    { aspectRatio: '1:1',  suffix: PRESET_SUFFIXES.social },
  story:     { aspectRatio: '9:16', suffix: PRESET_SUFFIXES.story },
  hero:      { aspectRatio: '16:9', suffix: PRESET_SUFFIXES.hero },
  thumbnail: { aspectRatio: '1:1',  suffix: PRESET_SUFFIXES.thumbnail },
  blog:      { aspectRatio: '16:9', suffix: PRESET_SUFFIXES.blog },
  ad:        { aspectRatio: '1:1',  suffix: PRESET_SUFFIXES.ad },
}

// Model chain — try each in order. All use generateContent API.
const IMAGE_MODELS = [
  'gemini-2.5-flash-image',              // Stable, documented, free tier
  'gemini-2.0-flash-exp-image-generation', // Experimental fallback
]

/**
 * Generate an image with Google Gemini.
 * Tries multiple models in sequence.
 * Enhances prompts with Songfinch brand context and emotional territory.
 */
export async function generateImage({
  prompt,
  preset = 'social',
  territory = null,
  contentType = null,
  taskName = null,
}) {
  if (!GOOGLE_AI_KEY) {
    throw new Error('GOOGLE_AI_KEY not configured — required for Gemini image generation')
  }

  const style = STYLE_PRESETS[preset] || STYLE_PRESETS.social

  const enhancedPrompt = buildEnhancedPrompt({
    prompt,
    style,
    territory,
    contentType,
  })

  console.log(`[GEMINI-IMG] Generating image: preset=${preset}, territory=${territory || 'none'}, aspect=${style.aspectRatio}`)

  // Try each Gemini model in sequence
  for (const model of IMAGE_MODELS) {
    try {
      const result = await callGeminiImageGen({ model, enhancedPrompt, style })
      if (result) {
        return {
          ...result,
          preset,
          size: style.aspectRatio,
          territory,
        }
      }
    } catch (err) {
      console.warn(`[GEMINI-IMG] ${model} failed: ${err.message}`)
    }
  }

  // Last resort: Imagen 4 via predict endpoint (requires paid plan)
  console.warn(`[GEMINI-IMG] All generateContent models failed, trying Imagen 4 predict API...`)
  return generateWithImagen4({ prompt: enhancedPrompt, style, preset, territory })
}

/**
 * Call a Gemini model for image generation via generateContent API.
 */
async function callGeminiImageGen({ model, enhancedPrompt, style }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  console.log(`[GEMINI-IMG] Trying model: ${model}`)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GOOGLE_AI_KEY,
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `Generate a professional marketing image: ${enhancedPrompt}` }],
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: style.aspectRatio,
        },
      },
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`${model} API error: ${res.status} - ${error.substring(0, 300)}`)
  }

  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts || []
  const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'))
  const textPart = parts.find(p => p.text)

  if (!imagePart) {
    console.warn(`[GEMINI-IMG] ${model} returned OK but no image in response`)
    return null
  }

  const dataUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
  console.log(`[GEMINI-IMG] Success with ${model}! Image type: ${imagePart.inlineData.mimeType}`)

  return {
    url: dataUrl,
    revisedPrompt: textPart?.text || enhancedPrompt,
    quality: 'standard',
    provider: model,
  }
}

/**
 * Last-resort fallback: Imagen 4 via the dedicated predict endpoint.
 * Note: Requires a paid Google AI plan.
 */
async function generateWithImagen4({ prompt, style, preset, territory }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GOOGLE_AI_KEY,
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: style.aspectRatio,
        personGeneration: 'allow_adult',
        safetyFilterLevel: 'block_only_high',
      },
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Imagen 4 API error: ${res.status} - ${error.substring(0, 300)}`)
  }

  const data = await res.json()
  const prediction = data.predictions?.[0]

  if (!prediction?.bytesBase64Encoded) {
    throw new Error('Imagen 4 returned no image data')
  }

  const mimeType = prediction.mimeType || 'image/png'
  const dataUrl = `data:${mimeType};base64,${prediction.bytesBase64Encoded}`

  return {
    url: dataUrl,
    revisedPrompt: prompt,
    preset,
    size: style.aspectRatio,
    quality: 'pro',
    territory,
    provider: 'imagen-4',
  }
}

// Re-export shared utilities so consumers don't need to change imports
export { autoPreset, extractVisualPrompt }
