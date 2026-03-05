// LTX-2 Video Generation Client for Songfinch Agent Pipeline
// Uses HuggingFace Inference API (fal-ai provider) for LTX-Video by Lightricks
// Called by video generation endpoints and agent pipelines
// Zero-dependency — uses native fetch

const HF_TOKEN = process.env.HF_TOKEN

const BASE_URL = 'https://router.huggingface.co/fal-ai/fal-ai/ltx-video'

// Retry config for transient API errors
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503]

// Default video parameters
const DEFAULTS = {
  numFrames: 121,  // ~4.8s at 25fps
  fps: 25,
  width: 768,
  height: 512,
}

// Songfinch brand-aware video style direction
const BRAND_STYLE = [
  'Warm, cinematic lighting with golden-hour tones.',
  'Gentle camera movement — slow push-in or subtle drift.',
  'Emotionally resonant, intimate, authentic human moments.',
  'NOT: cold, corporate, stock-video sterile, overly polished.',
  'Soft depth of field. Natural color grading. Film-like quality.',
].join(' ')

// Emotional territory → motion and mood mapping for video
const TERRITORY_MOTION = {
  Celebration: 'Joyful energy with subtle movement. Confetti-like sparkle in lighting. Warm smiles and happy tears. Uplifting camera motion.',
  Gratitude: 'Slow, tender motion. Soft focus transitions. Intimate close-ups. Gentle breathing pace. Amber warmth.',
  Memory: 'Nostalgic drift. Dreamlike slow motion. Warm film grain texture. Objects that hold meaning coming into focus. Sepia-warm tones.',
  Identity: 'Bold, confident movement. Strong composition shifts. Vibrant color pulses. Authentic self-expression energy.',
  Tribute: 'Reverent, slow pace. Luminous backlighting. Soft lens flares. Deep blues and warm golds. Dignified, timeless motion.',
}

/**
 * Sleep helper for retry backoff.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch with retry logic for transient HuggingFace API errors.
 */
async function fetchWithRetry(url, options) {
  let lastError = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, options)

    if (res.ok) {
      return res
    }

    // Check if retryable
    if (RETRYABLE_STATUS_CODES.includes(res.status) && attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * attempt
      console.warn(`[LTX] Retryable error ${res.status} on attempt ${attempt}/${MAX_RETRIES}. Retrying in ${delay}ms...`)
      lastError = `HTTP ${res.status}: ${await res.text()}`
      await sleep(delay)
      continue
    }

    // Non-retryable or final attempt
    const errorText = await res.text()
    throw new Error(`LTX-2 API error: ${res.status} - ${errorText}`)
  }

  throw new Error(`LTX-2 API failed after ${MAX_RETRIES} retries. Last error: ${lastError}`)
}

/**
 * Generate a video from an input image + text prompt (image-to-video).
 *
 * Uses Lightricks/LTX-2 via HuggingFace Inference API (fal-ai provider).
 *
 * @param {Object} options
 * @param {string} options.imageUrl    — URL of the input image to animate
 * @param {string} options.prompt      — Text prompt describing desired motion/scene
 * @param {number} [options.numFrames] — Number of frames (default: 121)
 * @param {number} [options.fps]       — Frames per second (default: 25)
 * @param {number} [options.width]     — Video width in pixels (default: 768)
 * @param {number} [options.height]    — Video height in pixels (default: 512)
 * @returns {{ videoUrl: string, prompt: string, model: string, params: Object }}
 */
export async function generateVideo({
  imageUrl,
  prompt,
  numFrames = DEFAULTS.numFrames,
  fps = DEFAULTS.fps,
  width = DEFAULTS.width,
  height = DEFAULTS.height,
}) {
  if (!HF_TOKEN) {
    throw new Error('HF_TOKEN not configured — required for LTX-2 video generation')
  }
  if (!imageUrl) {
    throw new Error('imageUrl is required for image-to-video generation')
  }
  if (!prompt) {
    throw new Error('prompt is required for video generation')
  }

  // Enhance prompt with Songfinch brand direction
  const enhancedPrompt = `${prompt} ${BRAND_STYLE}`

  console.log(`[LTX] Image-to-video: "${prompt.substring(0, 80)}..." frames=${numFrames} fps=${fps} ${width}x${height}`)

  const res = await fetchWithRetry(`${BASE_URL}/image-to-video`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {
        image: imageUrl,
      },
      parameters: {
        prompt: enhancedPrompt,
        num_frames: numFrames,
        fps,
        width,
        height,
      },
    }),
  })

  const data = await res.json()

  // HuggingFace Inference API can return the video URL in various response shapes
  const videoUrl = data?.url || data?.video?.url || data?.output?.video || data?.output || null
  if (!videoUrl) {
    throw new Error(`LTX-2 response missing video URL. Response: ${JSON.stringify(data).substring(0, 500)}`)
  }

  return {
    videoUrl,
    prompt: enhancedPrompt,
    model: 'Lightricks/LTX-2',
    mode: 'image-to-video',
    params: { numFrames, fps, width, height },
  }
}

/**
 * Generate a video from a text prompt only (text-to-video, no input image).
 *
 * @param {Object} options
 * @param {string} options.prompt      — Text prompt describing the desired video
 * @param {number} [options.numFrames] — Number of frames (default: 121)
 * @param {number} [options.fps]       — Frames per second (default: 25)
 * @param {number} [options.width]     — Video width in pixels (default: 768)
 * @param {number} [options.height]    — Video height in pixels (default: 512)
 * @returns {{ videoUrl: string, prompt: string, model: string, params: Object }}
 */
export async function generateVideoFromText({
  prompt,
  numFrames = DEFAULTS.numFrames,
  fps = DEFAULTS.fps,
  width = DEFAULTS.width,
  height = DEFAULTS.height,
}) {
  if (!HF_TOKEN) {
    throw new Error('HF_TOKEN not configured — required for LTX-2 video generation')
  }
  if (!prompt) {
    throw new Error('prompt is required for text-to-video generation')
  }

  // Enhance prompt with Songfinch brand direction
  const enhancedPrompt = `${prompt} ${BRAND_STYLE}`

  console.log(`[LTX] Text-to-video: "${prompt.substring(0, 80)}..." frames=${numFrames} fps=${fps} ${width}x${height}`)

  const res = await fetchWithRetry(`${BASE_URL}/text-to-video`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        prompt: enhancedPrompt,
        num_frames: numFrames,
        fps,
        width,
        height,
      },
    }),
  })

  const data = await res.json()

  const videoUrl = data?.url || data?.video?.url || data?.output?.video || data?.output || null
  if (!videoUrl) {
    throw new Error(`LTX-2 response missing video URL. Response: ${JSON.stringify(data).substring(0, 500)}`)
  }

  return {
    videoUrl,
    prompt: enhancedPrompt,
    model: 'Lightricks/LTX-2',
    mode: 'text-to-video',
    params: { numFrames, fps, width, height },
  }
}

/**
 * Build a video-optimized prompt from task content output.
 * Parses completed content to generate an appropriate motion/scene description.
 * Similar to dalle.js's extractVisualPrompt but tuned for video motion cues.
 *
 * @param {string} taskName      — Source task name
 * @param {string} contentOutput — Completed content body
 * @param {string} territory     — Emotional territory
 * @returns {string} Video-optimized prompt
 */
export function buildVideoPrompt(taskName, contentOutput, territory) {
  const parts = []

  // Start with core concept from the task
  let motionConcept = taskName

  // Try to extract key motion/scene cues from the content
  const sceneMatch = contentOutput?.match(/(?:SCENE|SETTING|MOMENT|VISUAL)[:\s]*(.+?)(?:\n|$)/i)
  const hookMatch = contentOutput?.match(/(?:HOOK|HEADLINE|OPENING)[:\s]*(.+?)(?:\n|$)/i)
  const actionMatch = contentOutput?.match(/(?:ACTION|MOTION|MOVEMENT|CAMERA)[:\s]*(.+?)(?:\n|$)/i)

  if (actionMatch) {
    motionConcept = actionMatch[1].trim()
  } else if (sceneMatch) {
    motionConcept = sceneMatch[1].trim()
  } else if (hookMatch) {
    motionConcept = `Cinematic visualization of: ${hookMatch[1].trim()}`
  }

  parts.push(motionConcept)

  // Add territory-specific motion direction
  if (territory && TERRITORY_MOTION[territory]) {
    parts.push(TERRITORY_MOTION[territory])
  }

  // Add Songfinch video context — emotional music gift moments
  parts.push('The scene shows a deeply personal, emotional music gift moment. A custom song bringing people together. Authentic human connection and genuine emotion.')

  return parts.join(' ')
}
