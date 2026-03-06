// DALL-E 3 Image Generation Client for Songfinch Agent Pipeline
// Uses OpenAI's DALL-E 3 API to generate marketing visuals
// Called by PIXEL agent and /api/generate/image endpoint

import {
  PRESET_SUFFIXES,
  buildEnhancedPrompt,
  autoPreset,
  extractVisualPrompt,
} from './image-shared.js'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// DALL-E 3 format presets (size/quality/style are DALL-E-specific)
const STYLE_PRESETS = {
  social:    { size: '1024x1024', quality: 'standard', style: 'vivid',   suffix: PRESET_SUFFIXES.social },
  story:     { size: '1024x1792', quality: 'standard', style: 'vivid',   suffix: PRESET_SUFFIXES.story },
  hero:      { size: '1792x1024', quality: 'hd',       style: 'vivid',   suffix: PRESET_SUFFIXES.hero },
  thumbnail: { size: '1024x1024', quality: 'standard', style: 'vivid',   suffix: PRESET_SUFFIXES.thumbnail },
  blog:      { size: '1792x1024', quality: 'hd',       style: 'natural', suffix: PRESET_SUFFIXES.blog },
  ad:        { size: '1024x1024', quality: 'hd',       style: 'vivid',   suffix: PRESET_SUFFIXES.ad },
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

  const enhancedPrompt = buildEnhancedPrompt({
    prompt,
    style,
    territory,
    contentType,
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

// Re-export shared utilities so consumers don't need to change imports
export { autoPreset, extractVisualPrompt }
