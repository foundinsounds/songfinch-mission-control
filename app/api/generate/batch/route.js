// Batch Content Generator — Process multiple tasks in parallel
// Uses Promise.allSettled for resilient parallel execution
// Called manually from dashboard or by cron runner for burst processing

import { getTasks, getAgents, updateTask, addActivity, addContent } from '../../../../lib/airtable'
import { callAI } from '../../../../lib/ai'
import { generateImage, autoPreset, extractVisualPrompt } from '../../../../lib/dalle'
import { FRAMEWORK_BRIEF } from '../../../../lib/framework'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Vercel Pro

const MAX_PARALLEL = 5  // Max concurrent AI calls to avoid rate limits
const MAX_BATCH = 10    // Max tasks per batch request

export async function POST(request) {
  const startTime = Date.now()
  const results = { completed: [], failed: [], skipped: [] }

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || MAX_BATCH, MAX_BATCH)
    const statusFilter = body.status || 'Assigned' // Which status to process
    const contentTypeFilter = body.contentType || null

    // Fetch data
    const [tasks, agents] = await Promise.all([
      getTasks({ noCache: true }),
      getAgents({ noCache: true }),
    ])

    // Filter tasks to process
    let eligible = tasks.filter(t =>
      t.status === statusFilter &&
      t.agent &&
      t.description
    )

    if (contentTypeFilter) {
      eligible = eligible.filter(t => t.contentType === contentTypeFilter)
    }

    if (eligible.length === 0) {
      return NextResponse.json({
        message: `No eligible tasks in "${statusFilter}" status`,
        duration: `${Date.now() - startTime}ms`,
      })
    }

    const batch = eligible.slice(0, limit)
    console.log(`[BATCH] Processing ${batch.length} tasks in parallel (max ${MAX_PARALLEL} concurrent)`)

    // Process in chunks of MAX_PARALLEL for rate limit safety
    for (let i = 0; i < batch.length; i += MAX_PARALLEL) {
      const chunk = batch.slice(i, i + MAX_PARALLEL)

      const chunkResults = await Promise.allSettled(
        chunk.map(task => processTask(task, agents))
      )

      chunkResults.forEach((result, j) => {
        const task = chunk[j]
        if (result.status === 'fulfilled') {
          results.completed.push({
            task: task.name,
            agent: task.agent,
            contentType: task.contentType,
            outputLength: result.value?.outputLength || 0,
          })
        } else {
          results.failed.push({
            task: task.name,
            agent: task.agent,
            error: result.reason?.message || 'Unknown error',
          })
        }
      })
    }

    // Log batch summary
    await addActivity({
      'Agent': 'CHIEF',
      'Action': 'batch processed',
      'Task': 'Batch Generator',
      'Details': `Processed ${batch.length} tasks: ${results.completed.length} completed, ${results.failed.length} failed. Duration: ${Date.now() - startTime}ms`,
      'Type': 'Content Generated',
    }).catch(err => console.warn('[BATCH] Activity log failed:', err.message))

    return NextResponse.json({
      message: `Batch processed ${batch.length} tasks`,
      results,
      duration: `${Date.now() - startTime}ms`,
    })

  } catch (err) {
    console.error('[BATCH] Fatal error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function processTask(task, agents) {
  const agent = agents.find(a => a.name === task.agent)
  if (!agent) throw new Error(`Agent ${task.agent} not found`)

  console.log(`[BATCH] → Processing "${task.name}" with ${agent.name}`)

  // Image tasks route to DALL-E 3
  if (task.contentType === 'Image') {
    const territory = task.description?.match(/Territory:\s*(Celebration|Gratitude|Memory|Identity|Tribute)/i)?.[1]
    const platform = Array.isArray(task.platform) ? task.platform[0] : task.platform
    const preset = autoPreset(task.contentType, platform)
    const imagePrompt = extractVisualPrompt(task.name, task.description, territory)

    const imageResult = await generateImage({
      prompt: imagePrompt,
      preset,
      territory,
      contentType: task.contentType,
      taskName: task.name,
    })

    const output = `IMAGE GENERATED\n\nURL: ${imageResult.url}\n\nRevised Prompt: ${imageResult.revisedPrompt || ''}\n\nPreset: ${preset}`

    await updateTask(task.id, {
      'Status': 'Review',
      'Output': output,
    })

    return { outputLength: output.length }
  }

  // Text tasks route to AI
  const systemPrompt = agent.systemPrompt || `You are ${agent.name}. ${FRAMEWORK_BRIEF}`
  const userPrompt = buildTaskPrompt(task)

  const output = await callAI({
    model: agent.model || 'claude-sonnet-4-6',
    temperature: agent.temperature || 0.7,
    systemPrompt,
    userPrompt,
    maxRetries: 2, // Slightly fewer retries for batch to stay within time budget
  })

  // Update task with output
  await updateTask(task.id, {
    'Status': 'Review',
    'Output': output.substring(0, 100000),
  })

  // Save to Content Library
  await addContent({
    'Title': task.name,
    'Content': output.substring(0, 100000),
    'Content Type': task.contentType || 'General',
    'Status': 'Draft',
    'Agent': agent.name,
  }).catch(err => console.warn('[BATCH] Content library save failed:', err.message))

  await addActivity({
    'Agent': agent.name,
    'Action': 'generated content',
    'Task': task.name,
    'Details': `Batch-generated ${task.contentType || 'content'} (${output.length} chars)`,
    'Type': 'Content Generated',
  }).catch(err => console.warn('[BATCH] Activity log failed:', err.message))

  return { outputLength: output.length }
}

function buildTaskPrompt(task) {
  const parts = [`# Task: ${task.name}`]

  if (task.description) parts.push(`\n## Brief\n${task.description}`)
  if (task.contentType) parts.push(`\n## Content Type: ${task.contentType}`)

  const platform = Array.isArray(task.platform) ? task.platform.join(', ') : task.platform
  if (platform) parts.push(`## Platform: ${platform}`)

  // Check for revision context
  if (task.output?.startsWith('[REVISION REQUESTED]')) {
    parts.push(`\n## REVISION CONTEXT\nYou are revising previous work. Here is the feedback and prior output:\n${task.output.substring(0, 10000)}`)
    parts.push('\nAddress ALL feedback points. Produce a complete, improved version.')
  }

  parts.push(`\n## Instructions\nProduce production-ready ${task.contentType || 'content'}. Follow the Narrative Ladder:\n1. EMOTIONAL MOMENT first\n2. HUMAN INSIGHT\n3. IMPACT / TRANSFORMATION\n4. SONGFINCH appears LAST`)

  return parts.join('\n')
}

// Support GET for manual triggers
export async function GET(request) {
  return POST(request)
}
