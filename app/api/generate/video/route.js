// Video Generation API — LTX-2 video creation for Songfinch content
// Called by: agent pipelines, manual dashboard trigger, post-approval hook
// Generates brand-aware marketing videos tied to emotional territories
// Uses Lightricks/LTX-2 via HuggingFace Inference API

import { generateVideo, generateVideoFromText, buildVideoPrompt } from '../../../../lib/ltx'
import { addActivity, addContent, updateTask } from '../../../../lib/airtable'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Video generation can take 1-5 minutes

/**
 * POST /api/generate/video
 *
 * Body:
 *   prompt       — Direct video prompt (optional if taskName + taskOutput provided)
 *   imageUrl     — Input image URL for image-to-video (omit for text-to-video)
 *   taskId       — Airtable record ID to update with generated video URL
 *   taskName     — Source task name (for auto-prompt extraction)
 *   taskOutput   — Source task output content (for auto-prompt extraction)
 *   territory    — Emotional territory: Celebration, Gratitude, Memory, Identity, Tribute
 *   campaign     — Campaign name for Content Library tagging
 *   platform     — Platform context: Instagram, TikTok, YouTube, etc.
 *   agent        — Agent name (defaults to PIXEL)
 *   numFrames    — Number of frames (default: 121, ~4.8s at 25fps)
 *   fps          — Frames per second (default: 25)
 *   width        — Video width in pixels (default: 768)
 *   height       — Video height in pixels (default: 512)
 */
export async function POST(request) {
  const startTime = Date.now()

  try {
    // Auth check — require HF_TOKEN to be configured
    if (!process.env.HF_TOKEN) {
      return NextResponse.json(
        { error: 'HF_TOKEN not configured — video generation unavailable' },
        { status: 503 }
      )
    }

    const body = await request.json()

    const {
      prompt: directPrompt,
      imageUrl,
      taskId,
      taskName,
      taskOutput,
      territory,
      campaign,
      platform,
      agent = 'PIXEL',
      numFrames,
      fps,
      width,
      height,
    } = body

    // Determine prompt — either direct or extracted from content
    let videoPrompt = directPrompt
    if (!videoPrompt && taskName) {
      videoPrompt = buildVideoPrompt(taskName, taskOutput, territory)
    }
    if (!videoPrompt) {
      return NextResponse.json(
        { error: 'Either "prompt" or "taskName" is required' },
        { status: 400 }
      )
    }

    const mode = imageUrl ? 'image-to-video' : 'text-to-video'
    console.log(`[VIDEO-GEN] Generating (${mode}): "${videoPrompt.substring(0, 80)}..."`)

    // Generate video with LTX-2
    let result
    const videoParams = {}
    if (numFrames) videoParams.numFrames = numFrames
    if (fps) videoParams.fps = fps
    if (width) videoParams.width = width
    if (height) videoParams.height = height

    if (imageUrl) {
      result = await generateVideo({
        imageUrl,
        prompt: videoPrompt,
        ...videoParams,
      })
    } else {
      result = await generateVideoFromText({
        prompt: videoPrompt,
        ...videoParams,
      })
    }

    // Log activity
    await addActivity({
      'Agent': agent,
      'Action': 'generated video',
      'Task': taskName || 'Manual Generation',
      'Details': `LTX-2 ${mode} (${result.params.width}x${result.params.height}, ${result.params.numFrames} frames @ ${result.params.fps}fps). Territory: ${territory || 'N/A'}. Prompt: ${videoPrompt.substring(0, 200)}`,
      'Type': 'Content Generated',
    }).catch(err => console.warn('[VIDEO-GEN] Activity log failed:', err.message))

    // Save to Content Library if we have enough context
    if (taskName) {
      await addContent({
        'Title': `Video: ${taskName}`,
        'Content Body': `Video URL: ${result.videoUrl}\n\nMode: ${mode}\nModel: ${result.model}\nPrompt: ${videoPrompt}\n\nParams: ${result.params.numFrames} frames @ ${result.params.fps}fps, ${result.params.width}x${result.params.height}\nTerritory: ${territory || 'N/A'}`,
        'Content Type': 'Video',
        'Platform': platform || '',
        'Agent': agent,
        'Campaign': campaign || '',
        'Status': 'Draft',
      }).catch(err => console.warn('[VIDEO-GEN] Content Library save failed:', err.message))
    }

    // Update task in Airtable if taskId provided
    if (taskId) {
      await updateTask(taskId, {
        'Output': `Video generated (${mode}): ${result.videoUrl}`,
        'Status': 'Review',
      }).catch(err => console.warn('[VIDEO-GEN] Task update failed:', err.message))
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      video: {
        url: result.videoUrl,
        model: result.model,
        mode: result.mode,
        prompt: result.prompt,
        params: result.params,
        territory: territory || null,
      },
      source: {
        taskId: taskId || null,
        taskName: taskName || null,
        platform: platform || null,
        campaign: campaign || null,
      },
      duration: `${duration}ms`,
    })

  } catch (err) {
    console.error('[VIDEO-GEN] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
