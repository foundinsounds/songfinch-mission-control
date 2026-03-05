// Gemini / Nano Banana Pro Image Generation Client for Songfinch Agent Pipeline
// Uses Google's Gemini Imagen API to generate marketing visuals
// Drop-in replacement for DALL-E 3 — same interface, different engine
// Called by LENS agent and /api/generate/image endpoint

// Strip quotes if env var was stored with them (common Vercel dashboard paste issue)
const GOOGLE_AI_KEY = (process.env.GOOGLE_AI_KEY || process.env.GOOGLE_AI_API_KEY || '').replace(/^["']|["']$/g, '')

// Songfinch brand-aware style presets (adapted for Gemini prompt style)
const STYLE_PRESETS = {
  social: {
    aspectRatio: '1:1',
    suffix: 'Modern social media aesthetic. Warm color palette. Clean typography space. High contrast. Instagram-ready.',
  },
  story: {
    aspectRatio: '9:16',
    suffix: 'Vertical story format. Bold, scroll-stopping visual. Warm tones. Space for text overlay at top and bottom.',
  },
  hero: {
    aspectRatio: '16:9',
    suffix: 'Wide cinematic hero banner. Emotionally evocative. Warm lighting. Depth of field. Space for headline text on the left third.',
  },
  thumbnail: {
    aspectRatio: '1:1',
    suffix: 'YouTube/video thumbnail style. Bold, eye-catching. High saturation. Clear focal point. Space for large text.',
  },
  blog: {
    aspectRatio: '16:9',
    suffix: 'Editorial blog header image. Warm, authentic, human. Natural lighting. Photojournalistic feel. NOT stock-photo sterile.',
  },
  ad: {
    aspectRatio: '1:1',
    suffix: 'High-converting ad creative. Emotionally compelling. Clear visual hierarchy. Warm brand palette. Single strong focal point.',
  },
}

// Emotional territory → visual direction mapping
const TERRITORY_VISUALS = {
  Celebration: 'Joyful, bright, warm golden light. Confetti-energy without literal confetti. Movement and excitement. Genuine smiles and happy tears.',
  Gratitude: 'Soft, warm, intimate. Gentle light. Connection between people. Tender moments. Amber and honey tones.',
  Memory: 'Nostalgic, slightly warm-filtered. Texture and grain. Objects that hold meaning. Time-worn beauty. Sepia-adjacent warmth.',
  Identity: 'Bold, confident, vibrant. Strong composition. Authentic self-expression. Rich saturated colors. Unapologetic energy.',
  Tribute: 'Reverent, luminous, dignified. Soft backlighting. Legacy and permanence. Deep blues and warm golds. Timeless quality.',
}

// Model chain — try each in order. All use generateContent API.
const IMAGE_MODELS = [
  'gemini-2.5-flash-image',              // Stable, documented, free tier
  'gemini-2.0-flash-exp-image-generation', // Experimental fallback
]

/**
 * Generate an image with Google Gemini.
 * Tries multiple models in sequence: gemini-2.5-flash-image → gemini-2.0-flash-exp → imagen-4.
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

  // Build enhanced prompt with brand + emotional context
  const enhancedPrompt = buildEnhancedPrompt({
    prompt,
    style,
    territory,
    contentType,
    taskName,
  })

  console.log(`[GEMINI-IMG] Generating image: preset=${preset}, territory=${territory || 'none'}, aspect=${style.aspectRatio}`)
  console.log(`[GEMINI-IMG] API key length: ${GOOGLE_AI_KEY.length}, starts with: ${GOOGLE_AI_KEY.substring(0, 6)}...`)

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
      // Continue to next model
    }
  }

  // Last resort: Imagen 4 via predict endpoint (requires paid plan)
  console.warn(`[GEMINI-IMG] All generateContent models failed, trying Imagen 4 predict API...`)
  return generateWithImagen4({ prompt: enhancedPrompt, style, preset, territory })
}

/**
 * Call a Gemini model for image generation via generateContent API.
 * Uses the documented imageConfig format with aspect ratio.
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

  // Extract image from multimodal response
  const parts = data.candidates?.[0]?.content?.parts || []
  const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'))
  const textPart = parts.find(p => p.text)

  if (!imagePart) {
    console.warn(`[GEMINI-IMG] ${model} returned OK but no image in response`)
    return null
  }

  // Convert base64 to data URL
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

/**
 * Build a brand-enhanced prompt for Gemini image generation.
 * Adds Songfinch visual identity + emotional territory direction.
 */
function buildEnhancedPrompt({ prompt, style, territory, contentType }) {
  const parts = []

  // Core Songfinch brand guardrails
  parts.push('Songfinch brand visual:')

  // Add emotional territory direction
  if (territory && TERRITORY_VISUALS[territory]) {
    parts.push(`Emotional territory "${territory}": ${TERRITORY_VISUALS[territory]}`)
  }

  // Main prompt
  parts.push(prompt)

  // Content type specific direction
  if (contentType) {
    const typeHints = {
      'Social Post': 'Optimized for social media feed. Bold, thumb-stopping.',
      'Ad Copy': 'High-converting advertising visual. Clear focal point, emotional pull.',
      'Blog Post': 'Editorial quality. Authentic and warm. Invites reading.',
      'Video Script': 'Cinematic frame. Could be a film still. Dramatic lighting.',
      'Landing Page': 'Hero banner quality. Space for text overlay. Premium feel.',
      'Strategy': 'Conceptual, abstract. Visual metaphor. Professional yet warm.',
      'Image': 'Professional marketing asset. Polished, brand-consistent, emotionally resonant.',
    }
    if (typeHints[contentType]) {
      parts.push(typeHints[contentType])
    }
  }

  // Style preset suffix
  parts.push(style.suffix)

  // Brand constraints (always applied)
  parts.push('MUST: Warm human tones. Authentic emotion. Professional quality. NOT: Cold, corporate, stock-photo sterile, clip-art. No text or words in the image.')

  return parts.join(' ')
}

/**
 * Determine best preset based on content type and platform.
 * (Same logic as dalle.js — kept in sync)
 */
export function autoPreset(contentType, platform) {
  const platformMap = {
    'Instagram': 'social',
    'Facebook': 'social',
    'TikTok': 'story',
    'YouTube': 'thumbnail',
    'Blog': 'blog',
    'Email': 'hero',
  }

  const typeMap = {
    'Landing Page': 'hero',
    'Blog Post': 'blog',
    'Video Script': 'thumbnail',
    'Ad Copy': 'ad',
    'Social Post': 'social',
    'Image': 'social',
  }

  if (contentType && typeMap[contentType]) return typeMap[contentType]
  if (platform && platformMap[platform]) return platformMap[platform]
  return 'social'
}

/**
 * Extract visual prompt from content output.
 * Parses completed content to generate an appropriate image prompt.
 */
export function extractVisualPrompt(taskName, contentOutput, territory) {
  let visualConcept = taskName

  const hookMatch = contentOutput?.match(/(?:HOOK|HEADLINE|OPENING)[:\s]*(.+?)(?:\n|$)/i)
  const conceptMatch = contentOutput?.match(/(?:VISUAL|IMAGE|IMAGERY|CONCEPT)[:\s]*(.+?)(?:\n|$)/i)
  const sceneMatch = contentOutput?.match(/(?:SCENE|SETTING|MOMENT)[:\s]*(.+?)(?:\n|$)/i)

  if (conceptMatch) {
    visualConcept = conceptMatch[1].trim()
  } else if (sceneMatch) {
    visualConcept = sceneMatch[1].trim()
  } else if (hookMatch) {
    visualConcept = `Visual representation of: ${hookMatch[1].trim()}`
  }

  if (territory) {
    visualConcept += `. Emotional tone: ${territory.toLowerCase()}.`
  }

  visualConcept += ' The scene depicts a deeply personal, emotional music gift moment between real people.'

  return visualConcept
}
