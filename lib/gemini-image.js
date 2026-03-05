// Gemini / Nano Banana Pro Image Generation Client for Songfinch Agent Pipeline
// Uses Google's Gemini Imagen API to generate marketing visuals
// Drop-in replacement for DALL-E 3 — same interface, different engine
// Called by LENS agent and /api/generate/image endpoint

const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY

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

/**
 * Generate an image with Google Gemini (Nano Banana Pro / Imagen).
 * Uses the Gemini multimodal API with responseModalities: ["IMAGE", "TEXT"]
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

  // Use Gemini 2.0 Flash with image generation capability
  // This model supports responseModalities: ["IMAGE", "TEXT"]
  const model = 'gemini-2.0-flash-exp'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_AI_KEY}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `Generate a professional marketing image: ${enhancedPrompt}` }],
      }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        responseMimeType: 'text/plain',
      },
    }),
  })

  if (!res.ok) {
    const error = await res.text()

    // If the experimental model fails, try Imagen 3 via the dedicated endpoint
    console.warn(`[GEMINI-IMG] Flash image gen failed (${res.status}), trying Imagen 3...`)
    return generateWithImagen3({ prompt: enhancedPrompt, style, preset, territory })
  }

  const data = await res.json()

  // Extract image from multimodal response
  const parts = data.candidates?.[0]?.content?.parts || []
  const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'))
  const textPart = parts.find(p => p.text)

  if (imagePart) {
    // Convert base64 to data URL
    const dataUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`

    return {
      url: dataUrl,
      revisedPrompt: textPart?.text || enhancedPrompt,
      preset,
      size: style.aspectRatio,
      quality: 'standard',
      territory,
      provider: 'gemini-flash',
    }
  }

  // If no image in response, fall back to Imagen 3
  console.warn(`[GEMINI-IMG] Flash response had no image, trying Imagen 3...`)
  return generateWithImagen3({ prompt: enhancedPrompt, style, preset, territory })
}

/**
 * Fallback: Generate with Imagen 3 via the dedicated predict endpoint.
 */
async function generateWithImagen3({ prompt, style, preset, territory }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GOOGLE_AI_KEY}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    throw new Error(`Imagen 3 API error: ${res.status} - ${error}`)
  }

  const data = await res.json()
  const prediction = data.predictions?.[0]

  if (!prediction?.bytesBase64Encoded) {
    throw new Error('Imagen 3 returned no image data')
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
    provider: 'imagen-3',
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
