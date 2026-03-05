// DALL-E 3 Image Generation Client for Songfinch Agent Pipeline
// Uses OpenAI's DALL-E 3 API to generate marketing visuals
// Called by PIXEL agent and /api/generate/image endpoint

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// Songfinch brand-aware style presets
const STYLE_PRESETS = {
  social: {
    size: '1024x1024',
    quality: 'standard',
    style: 'vivid',
    suffix: 'Modern social media aesthetic. Warm color palette. Clean typography space. High contrast. Instagram-ready.',
  },
  story: {
    size: '1024x1792',
    quality: 'standard',
    style: 'vivid',
    suffix: 'Vertical story format. Bold, scroll-stopping visual. Warm tones. Space for text overlay at top and bottom.',
  },
  hero: {
    size: '1792x1024',
    quality: 'hd',
    style: 'vivid',
    suffix: 'Wide cinematic hero banner. Emotionally evocative. Warm lighting. Depth of field. Space for headline text on the left third.',
  },
  thumbnail: {
    size: '1024x1024',
    quality: 'standard',
    style: 'vivid',
    suffix: 'YouTube/video thumbnail style. Bold, eye-catching. High saturation. Clear focal point. Space for large text.',
  },
  blog: {
    size: '1792x1024',
    quality: 'hd',
    style: 'natural',
    suffix: 'Editorial blog header image. Warm, authentic, human. Natural lighting. Photojournalistic feel. NOT stock-photo sterile.',
  },
  ad: {
    size: '1024x1024',
    quality: 'hd',
    style: 'vivid',
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
 * Generate an image with DALL-E 3.
 * Enhances prompts with Songfinch brand context and emotional territory.
 */
export async function generateImage({
  prompt,
  preset = 'social',
  territory = null,
  contentType = null,
  taskName = null,
}) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured — required for DALL-E 3 image generation')
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

  console.log(`[DALLE] Generating image: preset=${preset}, territory=${territory || 'none'}, size=${style.size}`)

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: enhancedPrompt,
      n: 1,
      size: style.size,
      quality: style.quality,
      style: style.style,
      response_format: 'url',
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`DALL-E 3 API error: ${res.status} - ${error}`)
  }

  const data = await res.json()
  const image = data.data[0]

  return {
    url: image.url,
    revisedPrompt: image.revised_prompt,
    preset,
    size: style.size,
    quality: style.quality,
    territory,
  }
}

/**
 * Build a brand-enhanced prompt for DALL-E 3.
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
    }
    if (typeHints[contentType]) {
      parts.push(typeHints[contentType])
    }
  }

  // Style preset suffix
  parts.push(style.suffix)

  // Brand constraints (always applied)
  parts.push('MUST: Warm human tones. Authentic emotion. NOT: Cold, corporate, stock-photo sterile, clip-art. No text or words in the image.')

  return parts.join(' ')
}

/**
 * Determine best preset based on content type and platform.
 */
export function autoPreset(contentType, platform) {
  // Platform-specific presets
  const platformMap = {
    'Instagram': 'social',
    'Facebook': 'social',
    'TikTok': 'story',
    'YouTube': 'thumbnail',
    'Blog': 'blog',
    'Email': 'hero',
  }

  // Content type overrides
  const typeMap = {
    'Landing Page': 'hero',
    'Blog Post': 'blog',
    'Video Script': 'thumbnail',
    'Ad Copy': 'ad',
    'Social Post': 'social',
  }

  // Content type takes priority over platform
  if (contentType && typeMap[contentType]) return typeMap[contentType]
  if (platform && platformMap[platform]) return platformMap[platform]
  return 'social'
}

/**
 * Extract visual prompt from content output.
 * Parses completed content to generate an appropriate image prompt.
 */
export function extractVisualPrompt(taskName, contentOutput, territory) {
  // Start with the task name as base concept
  let visualConcept = taskName

  // Try to extract key imagery from the content
  const hookMatch = contentOutput?.match(/(?:HOOK|HEADLINE|OPENING)[:\s]*(.+?)(?:\n|$)/i)
  const conceptMatch = contentOutput?.match(/(?:VISUAL|IMAGE|IMAGERY|CONCEPT)[:\s]*(.+?)(?:\n|$)/i)
  const sceneMatch = contentOutput?.match(/(?:SCENE|SETTING|MOMENT)[:\s]*(.+?)(?:\n|$)/i)

  if (conceptMatch) {
    visualConcept = conceptMatch[1].trim()
  } else if (sceneMatch) {
    visualConcept = sceneMatch[1].trim()
  } else if (hookMatch) {
    // Use the hook as inspiration but reframe for visual
    visualConcept = `Visual representation of: ${hookMatch[1].trim()}`
  }

  // Add territory emotional tone
  if (territory) {
    visualConcept += `. Emotional tone: ${territory.toLowerCase()}.`
  }

  // Add Songfinch context
  visualConcept += ' The scene depicts a deeply personal, emotional music gift moment between real people.'

  return visualConcept
}
