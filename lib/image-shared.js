// Shared constants and utilities for image generation across all providers
// (DALL-E, Gemini, Hugging Face FLUX)
//
// Single source of truth for:
//   - Songfinch brand style presets (suffix strings)
//   - Emotional territory → visual direction mapping
//   - Prompt builder (brand-enhanced prompts)
//   - Content type → preset auto-selection
//   - Visual prompt extraction from content output

// ---- EMOTIONAL TERRITORIES ----
// Maps Songfinch emotional territories to visual direction cues.
// Used by all image providers to maintain brand consistency.

export const TERRITORY_VISUALS = {
  Celebration: 'Joyful, bright, warm golden light. Confetti-energy without literal confetti. Movement and excitement. Genuine smiles and happy tears.',
  Gratitude: 'Soft, warm, intimate. Gentle light. Connection between people. Tender moments. Amber and honey tones.',
  Memory: 'Nostalgic, slightly warm-filtered. Texture and grain. Objects that hold meaning. Time-worn beauty. Sepia-adjacent warmth.',
  Identity: 'Bold, confident, vibrant. Strong composition. Authentic self-expression. Rich saturated colors. Unapologetic energy.',
  Tribute: 'Reverent, luminous, dignified. Soft backlighting. Legacy and permanence. Deep blues and warm golds. Timeless quality.',
}

// ---- STYLE PRESET SUFFIXES ----
// The visual direction suffix appended to every prompt, per preset.
// Provider-specific format keys (size, aspectRatio, width/height) stay in each provider file.

export const PRESET_SUFFIXES = {
  social: 'Modern social media aesthetic. Warm color palette. Clean typography space. High contrast. Instagram-ready.',
  story: 'Vertical story format. Bold, scroll-stopping visual. Warm tones. Space for text overlay at top and bottom.',
  hero: 'Wide cinematic hero banner. Emotionally evocative. Warm lighting. Depth of field. Space for headline text on the left third.',
  thumbnail: 'YouTube/video thumbnail style. Bold, eye-catching. High saturation. Clear focal point. Space for large text.',
  blog: 'Editorial blog header image. Warm, authentic, human. Natural lighting. Photojournalistic feel. NOT stock-photo sterile.',
  ad: 'High-converting ad creative. Emotionally compelling. Clear visual hierarchy. Warm brand palette. Single strong focal point.',
}

// ---- CONTENT TYPE HINTS ----
// Maps content types to visual direction cues for the prompt builder.

const TYPE_HINTS = {
  'Social Post': 'Optimized for social media feed. Bold, thumb-stopping.',
  'Ad Copy': 'High-converting advertising visual. Clear focal point, emotional pull.',
  'Blog Post': 'Editorial quality. Authentic and warm. Invites reading.',
  'Video Script': 'Cinematic frame. Could be a film still. Dramatic lighting.',
  'Landing Page': 'Hero banner quality. Space for text overlay. Premium feel.',
  'Strategy': 'Conceptual, abstract. Visual metaphor. Professional yet warm.',
  'Image': 'Professional marketing asset. Polished, brand-consistent, emotionally resonant.',
}

// ---- PROMPT BUILDER ----

/**
 * Build a brand-enhanced prompt for any image generation provider.
 * Adds Songfinch visual identity + emotional territory direction.
 *
 * @param {object} opts
 * @param {string} opts.prompt - Raw image prompt
 * @param {object} opts.style - Style preset object (must have .suffix)
 * @param {string|null} opts.territory - Emotional territory key
 * @param {string|null} opts.contentType - Content type (e.g. 'Social Post')
 * @returns {string} Enhanced prompt string
 */
export function buildEnhancedPrompt({ prompt, style, territory, contentType }) {
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
  if (contentType && TYPE_HINTS[contentType]) {
    parts.push(TYPE_HINTS[contentType])
  }

  // Style preset suffix
  parts.push(style.suffix)

  // Brand constraints
  parts.push('MUST: Warm human tones. Authentic emotion. Professional quality. NOT: Cold, corporate, stock-photo sterile, clip-art. No text or words in the image.')

  return parts.join(' ')
}

// ---- AUTO PRESET ----

/**
 * Determine best image preset based on content type and platform.
 * Content type takes priority over platform.
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

// ---- VISUAL PROMPT EXTRACTION ----

/**
 * Extract a visual prompt from completed content output.
 * Parses agent output to find imagery cues for image generation.
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
