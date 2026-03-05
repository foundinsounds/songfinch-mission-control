// Hugging Face Inference API Image Generation for Songfinch Agent Pipeline
// Uses FLUX.1-schnell (Black Forest Labs) — fast, free, high quality
// Primary image engine — Gemini serves as fallback
// Called by LENS agent and /api/generate/image endpoint

const HF_TOKEN = process.env.HF_TOKEN || ''
const GOOGLE_AI_KEY = (process.env.GOOGLE_AI_KEY || process.env.GOOGLE_AI_API_KEY || '').replace(/^["']|["']$/g, '')

// HF Inference API base (new router endpoint — old api-inference.huggingface.co is deprecated)
const HF_API_BASE = 'https://router.huggingface.co/hf-inference/models'

// Model chain — try each in order
const HF_IMAGE_MODELS = [
  'black-forest-labs/FLUX.1-schnell',     // Fast, free, Apache 2.0
  'stabilityai/stable-diffusion-3.5-large', // Fallback: SD3.5
]

// Gemini fallback models (if HF is down)
const GEMINI_IMAGE_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-exp-image-generation',
]

// Songfinch brand-aware style presets
const STYLE_PRESETS = {
  social: {
    aspectRatio: '1:1',
    width: 1024,
    height: 1024,
    suffix: 'Modern social media aesthetic. Warm color palette. Clean typography space. High contrast. Instagram-ready.',
  },
  story: {
    aspectRatio: '9:16',
    width: 576,
    height: 1024,
    suffix: 'Vertical story format. Bold, scroll-stopping visual. Warm tones. Space for text overlay at top and bottom.',
  },
  hero: {
    aspectRatio: '16:9',
    width: 1024,
    height: 576,
    suffix: 'Wide cinematic hero banner. Emotionally evocative. Warm lighting. Depth of field. Space for headline text on the left third.',
  },
  thumbnail: {
    aspectRatio: '1:1',
    width: 1024,
    height: 1024,
    suffix: 'YouTube/video thumbnail style. Bold, eye-catching. High saturation. Clear focal point. Space for large text.',
  },
  blog: {
    aspectRatio: '16:9',
    width: 1024,
    height: 576,
    suffix: 'Editorial blog header image. Warm, authentic, human. Natural lighting. Photojournalistic feel. NOT stock-photo sterile.',
  },
  ad: {
    aspectRatio: '1:1',
    width: 1024,
    height: 1024,
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

/**
 * Generate an image using Hugging Face FLUX.1 (primary) with Gemini fallback.
 * Enhances prompts with Songfinch brand context and emotional territory.
 */
export async function generateImage({
  prompt,
  preset = 'social',
  territory = null,
  contentType = null,
  taskName = null,
}) {
  const style = STYLE_PRESETS[preset] || STYLE_PRESETS.social

  // Build enhanced prompt with brand + emotional context
  const enhancedPrompt = buildEnhancedPrompt({
    prompt,
    style,
    territory,
    contentType,
    taskName,
  })

  console.log(`[IMG-GEN] Generating image: preset=${preset}, territory=${territory || 'none'}, size=${style.width}x${style.height}`)

  // Try HF models first (free, fast)
  if (HF_TOKEN) {
    for (const model of HF_IMAGE_MODELS) {
      try {
        const result = await callHFImageGen({ model, enhancedPrompt, style })
        if (result) {
          return {
            ...result,
            preset,
            size: style.aspectRatio,
            territory,
          }
        }
      } catch (err) {
        console.warn(`[IMG-GEN] HF ${model} failed: ${err.message}`)
      }
    }
    console.warn(`[IMG-GEN] All HF models failed, trying Gemini fallback...`)
  } else {
    console.warn(`[IMG-GEN] No HF_TOKEN configured, skipping HF models`)
  }

  // Fallback: Gemini image models
  if (GOOGLE_AI_KEY) {
    for (const model of GEMINI_IMAGE_MODELS) {
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
        console.warn(`[IMG-GEN] Gemini ${model} failed: ${err.message}`)
      }
    }
  }

  throw new Error('All image generation models failed. Check HF_TOKEN and GOOGLE_AI_KEY configuration.')
}

// ---- HUGGING FACE (FLUX.1 / Stable Diffusion) ----

/**
 * Call HF Inference API for image generation.
 * Returns raw image bytes as a base64 data URL.
 */
async function callHFImageGen({ model, enhancedPrompt, style }) {
  const url = `${HF_API_BASE}/${model}`

  console.log(`[IMG-GEN] Trying HF model: ${model}`)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: enhancedPrompt,
      parameters: {
        width: style.width,
        height: style.height,
      },
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`HF ${model}: ${res.status} - ${errorText.substring(0, 300)}`)
  }

  const contentType = res.headers.get('content-type') || ''

  // HF returns raw image bytes
  if (contentType.startsWith('image/')) {
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = contentType.split(';')[0]
    const dataUrl = `data:${mimeType};base64,${base64}`

    console.log(`[IMG-GEN] Success with HF ${model}! ${mimeType}, ${Math.round(buffer.byteLength / 1024)}KB`)

    return {
      url: dataUrl,
      revisedPrompt: enhancedPrompt,
      quality: 'standard',
      provider: `hf/${model.split('/').pop()}`,
    }
  }

  // Sometimes HF returns JSON (model loading, errors)
  const data = JSON.parse(await res.text())
  if (data.error) {
    throw new Error(`HF ${model}: ${data.error}`)
  }

  console.warn(`[IMG-GEN] HF ${model} returned unexpected content-type: ${contentType}`)
  return null
}

// ---- GEMINI (fallback) ----

/**
 * Call Gemini generateContent API for image generation.
 */
async function callGeminiImageGen({ model, enhancedPrompt, style }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  console.log(`[IMG-GEN] Trying Gemini model: ${model}`)

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
    throw new Error(`Gemini ${model}: ${res.status} - ${error.substring(0, 300)}`)
  }

  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts || []
  const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'))
  const textPart = parts.find(p => p.text)

  if (!imagePart) {
    console.warn(`[IMG-GEN] Gemini ${model} returned OK but no image`)
    return null
  }

  const dataUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
  console.log(`[IMG-GEN] Success with Gemini ${model}!`)

  return {
    url: dataUrl,
    revisedPrompt: textPart?.text || enhancedPrompt,
    quality: 'standard',
    provider: model,
  }
}

// ---- PROMPT BUILDER ----

/**
 * Build a brand-enhanced prompt for image generation.
 * Adds Songfinch visual identity + emotional territory direction.
 */
function buildEnhancedPrompt({ prompt, style, territory, contentType }) {
  const parts = []

  // Core brand context
  parts.push('Songfinch brand visual:')

  // Emotional territory direction
  if (territory && TERRITORY_VISUALS[territory]) {
    parts.push(`Emotional territory "${territory}": ${TERRITORY_VISUALS[territory]}`)
  }

  // Main prompt
  parts.push(prompt)

  // Content type hints
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

  // Brand constraints
  parts.push('MUST: Warm human tones. Authentic emotion. Professional quality. NOT: Cold, corporate, stock-photo sterile, clip-art. No text or words in the image.')

  return parts.join(' ')
}

// ---- UTILITIES ----

/**
 * Determine best preset based on content type and platform.
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
