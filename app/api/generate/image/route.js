// Image Generation API — FLUX.1 + Gemini visual creation for Songfinch content
// Called by: PIXEL agent pipeline, manual dashboard trigger, post-approval hook
// Generates brand-aware marketing visuals tied to emotional territories

import { generateImage, autoPreset, extractVisualPrompt } from '../../../../lib/hf-image'
import { addActivity, addContent } from '../../../../lib/airtable'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Image generation is fast (10-30s typically)

/**
 * POST /api/generate/image
 *
 * Body:
 *   prompt       — Direct image prompt (optional if taskName + output provided)
 *   preset       — Style preset: social, story, hero, thumbnail, blog, ad (auto-detected if omitted)
 *   territory    — Emotional territory: Celebration, Gratitude, Memory, Identity, Tribute
 *   contentType  — Content type for context: Social Post, Ad Copy, Blog Post, etc.
 *   platform     — Platform for auto-preset: Instagram, TikTok, YouTube, Blog, etc.
 *   taskName     — Source task name (for auto-prompt extraction)
 *   taskOutput   — Source task output content (for auto-prompt extraction)
 *   campaign     — Campaign name for Content Library tagging
 *   agent        — Agent name (defaults to PIXEL)
 */
export async function POST(request) {
  const startTime = Date.now()

  try {
    const body = await request.json()

    const {
      prompt: directPrompt,
      preset: requestedPreset,
      territory,
      contentType,
      platform,
      taskName,
      taskOutput,
      campaign,
      agent = 'PIXEL',
    } = body

    // Determine prompt — either direct or extracted from content
    let imagePrompt = directPrompt
    if (!imagePrompt && taskName) {
      imagePrompt = extractVisualPrompt(taskName, taskOutput, territory)
    }
    if (!imagePrompt) {
      return NextResponse.json(
        { error: 'Either "prompt" or "taskName" is required' },
        { status: 400 }
      )
    }

    // Auto-detect preset if not specified
    const preset = requestedPreset || autoPreset(contentType, platform)

    console.log(`[IMAGE-GEN] Generating: "${imagePrompt.substring(0, 80)}..." preset=${preset}`)

    // Generate with FLUX.1 (HF) → Gemini fallback
    const result = await generateImage({
      prompt: imagePrompt,
      preset,
      territory: territory || null,
      contentType: contentType || null,
      taskName: taskName || null,
    })

    // Log activity
    await addActivity({
      'Agent': agent,
      'Action': 'generated image',
      'Task': taskName || 'Manual Generation',
      'Details': `${result.provider || 'FLUX.1'} ${preset} (${result.size}). Territory: ${territory || 'N/A'}. Prompt: ${imagePrompt.substring(0, 200)}`,
      'Type': 'Content Generated',
    }).catch(err => console.warn('[IMAGE-GEN] Activity log failed:', err.message))

    // Save to Content Library if we have enough context
    if (taskName) {
      await addContent({
        'Title': `Visual: ${taskName}`,
        'Content Body': `Image URL: ${result.url}\n\nPrompt: ${imagePrompt}\n\nRevised Prompt: ${result.revisedPrompt || 'N/A'}\n\nPreset: ${preset} | Size: ${result.size} | Territory: ${territory || 'N/A'}`,
        'Content Type': 'Image',
        'Platform': platform || '',
        'Agent': agent,
        'Campaign': campaign || '',
        'Status': 'Draft',
      }).catch(err => console.warn('[IMAGE-GEN] Content Library save failed:', err.message))
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      image: {
        url: result.url,
        revisedPrompt: result.revisedPrompt,
        preset,
        size: result.size,
        quality: result.quality,
        territory: territory || null,
      },
      source: {
        taskName: taskName || null,
        contentType: contentType || null,
        platform: platform || null,
        campaign: campaign || null,
      },
      duration: `${duration}ms`,
    })

  } catch (err) {
    console.error('[IMAGE-GEN] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
