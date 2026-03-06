// CHIEF Auto-Reviewer — Reviews content in "Review" status
// Approves good work (→ Done) or sends back with feedback (→ Assigned)
// Called by cron runner after processing, or manually from dashboard

import { getTasks, getAgents, updateTask, addActivity, getAllActivity, getTasksByCampaign } from '../../../../lib/airtable'
import { callAI } from '../../../../lib/ai'
import { QUALITY_RUBRIC } from '../../../../lib/framework'
import { generateImage, autoPreset, extractVisualPrompt } from '../../../../lib/dalle'
import { exportToDrive, isDriveConfigured } from '../../../../lib/drive'
import { notifyApproved, notifyRevised, notifyReviewCycle } from '../../../../lib/slack'
import {
  needsMuseQA,
  buildMuseQAPrompt,
  parseMuseQAVerdict,
  buildCampaignContext,
} from '../../../../lib/orchestration'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Vercel Pro: reviews multiple tasks sequentially

export async function GET(request) {
  return POST(request)
}

export async function POST(request) {
  const startTime = Date.now()
  const results = { approved: [], revised: [], musePolished: [], errors: [] }

  try {
    const body = await request.json().catch(() => ({}))
    const limit = body.limit || 25 // Aggressive: clear Review queue fast so agents keep creating

    // Fetch tasks in Review status
    const [tasks, agents, activity] = await Promise.all([
      getTasks({ noCache: true }),
      getAgents({ noCache: true }),
      getAllActivity().catch(() => []),
    ])

    const reviewTasks = tasks.filter(t => t.status === 'Review' && t.output)
    if (reviewTasks.length === 0) {
      return NextResponse.json({
        message: 'No tasks in Review',
        duration: `${Date.now() - startTime}ms`,
      })
    }

    // Find CHIEF agent for review
    const chief = agents.find(a => a.name === 'CHIEF')
    if (!chief) {
      return NextResponse.json({ error: 'CHIEF agent not found' }, { status: 404 })
    }
    const muse = agents.find(a => a.name === 'MUSE')

    // Process up to `limit` tasks — BATCHED to avoid rate limits
    const toReview = reviewTasks.slice(0, limit)

    // Process reviews in batches of 5 with delays between batches
    // This prevents hitting the 30K input tokens/min rate limit
    const BATCH_SIZE = 8
    const BATCH_DELAY_MS = 8000 // 8s between batches — lets rate limit window slide
    const reviewResults = []

    for (let i = 0; i < toReview.length; i += BATCH_SIZE) {
      const batch = toReview.slice(i, i + BATCH_SIZE)

      // Add delay between batches (not before the first)
      if (i > 0) {
        console.log(`[REVIEWER] Waiting ${BATCH_DELAY_MS / 1000}s before next batch (${i}/${toReview.length})...`)
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
      }

      // Fire batch in parallel (small enough to stay under rate limit)
      const batchResults = await Promise.allSettled(
        batch.map(async (task) => {
          console.log(`[REVIEWER] Reviewing: "${task.name}" by ${task.agent}`)

          // ── MUSE Creative QA Gate ──
          // Creative content goes through MUSE first; only PASS content reaches CHIEF
          if (muse && needsMuseQA(task)) {
            try {
              let campaignCtx = null
              if (task.campaign && activity.length > 0) {
                const campaignTasks = await getTasksByCampaign(task.campaign, { noCache: true }).catch(() => [])
                campaignCtx = buildCampaignContext(task.campaign, campaignTasks, activity)
              }

              const musePrompt = buildMuseQAPrompt(task, campaignCtx)
              const museOutput = await callAI({
                model: muse.model || 'claude-sonnet-4-6',
                temperature: muse.temperature || 0.6,
                systemPrompt: muse.systemPrompt || 'You are MUSE, the Creative Director.',
                userPrompt: musePrompt,
              })

              const museVerdict = parseMuseQAVerdict(museOutput)
              console.log(`[REVIEWER] 🎨 MUSE QA: "${task.name}" → ${museVerdict.verdict} (${museVerdict.score}/5)`)

              if (museVerdict.verdict === 'NEEDS_POLISH') {
                return {
                  task,
                  verdict: {
                    approved: false,
                    score: museVerdict.score,
                    feedback: `[MUSE Creative QA] ${museVerdict.polishSuggestion || museVerdict.notes}`,
                    summary: museVerdict.notes,
                    learning: '',
                    museGated: true,
                  },
                }
              }
              // PASS — continue to CHIEF review below
            } catch (museErr) {
              console.warn(`[REVIEWER] MUSE QA failed for "${task.name}", proceeding to CHIEF:`, museErr.message)
            }
          }

          // ── CHIEF Quality Review ──
          const reviewPrompt = buildReviewPrompt(task)

          const reviewOutput = await callAI({
            model: chief.model || 'claude-sonnet-4-6',
            temperature: chief.temperature || 0.4,
            systemPrompt: chief.systemPrompt || 'You are CHIEF, the quality reviewer.',
            userPrompt: reviewPrompt,
          })

          return { task, verdict: parseVerdict(reviewOutput) }
        })
      )

      reviewResults.push(...batchResults)
    }

    // Process verdicts (Airtable writes — sequential to avoid rate limits)
    for (const result of reviewResults) {
      if (result.status === 'rejected') {
        const err = result.reason
        results.errors.push({ task: 'unknown', error: err?.message || 'Review failed' })
        continue
      }

      const { task, verdict } = result.value

      try {
        if (verdict.museGated) {
          // MUSE POLISH — creative refinement needed, sent back before CHIEF review
          const polishOutput = `[CREATIVE POLISH REQUESTED by MUSE]\nFeedback: ${verdict.feedback}\n\n---PREVIOUS OUTPUT (v${getVersionNumber(task.output)})---\n${task.output}`

          await Promise.all([
            updateTask(task.id, {
              'Status': 'Assigned',
              'Output': polishOutput.substring(0, 100000),
            }),
            addActivity({
              'Agent': 'MUSE',
              'Action': 'creative-polish-requested',
              'Task': task.name,
              'Details': `Creative QA: needs polish (${verdict.score}/5). ${verdict.feedback}`.substring(0, 5000),
              'Type': 'Comment',
            }),
          ])

          results.musePolished.push({
            task: task.name,
            agent: task.agent,
            score: verdict.score,
            feedback: verdict.feedback,
          })

          notifyRevised({
            task: task.name,
            agent: task.agent,
            score: verdict.score,
            feedback: `[MUSE Creative QA] ${verdict.feedback}`,
          }).catch(err => console.warn('[REVIEWER] Slack MUSE notify failed:', err.message))

          console.log(`[REVIEWER] 🎨 MUSE polish requested: "${task.name}" (${verdict.score}/5)`)

        } else if (verdict.approved) {
          // APPROVE — move to Done + learning + notifications (parallel)
          await Promise.all([
            updateTask(task.id, { 'Status': 'Done' }),
            addActivity({
              'Agent': 'CHIEF',
              'Action': 'approved',
              'Task': task.name,
              'Details': `Auto-approved (${verdict.score}/5). ${verdict.summary}`.substring(0, 5000),
              'Type': 'Content Generated',
            }),
            verdict.learning ? saveMemory({
              agent: task.agent,
              type: 'success_pattern',
              content: `Approved content "${task.name}": ${verdict.learning}`,
              source: 'auto-review',
              importance: verdict.score >= 4.0 ? 'High' : 'Medium',
              taskContext: task.contentType,
            }) : Promise.resolve(),
          ])

          results.approved.push({
            task: task.name,
            agent: task.agent,
            score: verdict.score,
            summary: verdict.summary,
          })

          // Slack (fire-and-forget)
          notifyApproved({
            task: task.name,
            agent: task.agent,
            score: verdict.score,
            summary: verdict.summary,
          }).catch(err => console.warn('[REVIEWER] Slack approve notify failed:', err.message))

          // AUTO-IMAGE: Fire-and-forget visual companion
          const visualTypes = new Set(['Social Post', 'Ad Copy', 'Blog Post', 'Video Script', 'Landing Page'])
          if (visualTypes.has(task.contentType) && process.env.OPENAI_API_KEY) {
            const territory = task.description?.match(/Territory:\s*(Celebration|Gratitude|Memory|Identity|Tribute)/i)?.[1]
            const platform = Array.isArray(task.platform) ? task.platform[0] : task.platform
            const preset = autoPreset(task.contentType, platform)
            const imagePrompt = extractVisualPrompt(task.name, task.output, territory)

            console.log(`[REVIEWER] 🎨 Fire-and-forget image for "${task.name}" (${preset})`)

            generateImage({
              prompt: imagePrompt,
              preset,
              territory,
              contentType: task.contentType,
              taskName: task.name,
            }).then(imageResult => {
              console.log(`[REVIEWER] 🎨 ✅ Image generated for "${task.name}"`)
              return addActivity({
                'Agent': 'PIXEL',
                'Action': 'auto-generated image',
                'Task': task.name,
                'Details': `DALL-E 3 ${preset} visual for approved content. URL: ${imageResult.url?.substring(0, 200)}`,
                'Type': 'Content Generated',
              })
            }).catch(imgErr => {
              console.warn(`[REVIEWER] 🎨 Image failed for "${task.name}":`, imgErr.message)
            })

            results.approved[results.approved.length - 1].imageQueued = true
          }

          // AUTO-EXPORT: Fire-and-forget Drive export for approved content
          if (isDriveConfigured()) {
            console.log(`[REVIEWER] 📁 Fire-and-forget Drive export for "${task.name}"`)
            exportToDrive({
              name: task.name,
              output: task.output,
              contentType: task.contentType,
              campaign: task.campaign,
              agent: task.agent,
            }).then(driveResult => {
              if (driveResult?.url) {
                console.log(`[REVIEWER] 📁 ✅ Exported to Drive: "${task.name}" → ${driveResult.url}`)
                // Update task with Drive link (best-effort)
                updateTask(task.id, { 'Drive Link': driveResult.url }).catch(err => console.warn('[REVIEWER] Drive link update failed:', err.message))
              }
            }).catch(driveErr => {
              console.warn(`[REVIEWER] 📁 Drive export failed for "${task.name}":`, driveErr.message)
            })
            results.approved[results.approved.length - 1].driveQueued = true
          }

          console.log(`[REVIEWER] ✅ Approved: "${task.name}" (${verdict.score}/5)`)

        } else {
          // REVISE — send back with feedback
          const revisionOutput = `[REVISION REQUESTED]\nFeedback: ${verdict.feedback}\n\n---PREVIOUS OUTPUT (v${getVersionNumber(task.output)})---\n${task.output}`

          await Promise.all([
            updateTask(task.id, {
              'Status': 'Assigned',
              'Output': revisionOutput.substring(0, 100000),
            }),
            addActivity({
              'Agent': 'CHIEF',
              'Action': 'revision requested',
              'Task': task.name,
              'Details': `Sent back for revision (${verdict.score}/5). Feedback: ${verdict.feedback}`.substring(0, 5000),
              'Type': 'Comment',
            }),
            verdict.feedback ? saveMemory({
              agent: task.agent,
              type: 'feedback',
              content: `Review feedback on "${task.name}": ${verdict.feedback}`,
              source: 'auto-review',
              importance: 'High',
              taskContext: task.contentType,
            }) : Promise.resolve(),
          ])

          results.revised.push({
            task: task.name,
            agent: task.agent,
            score: verdict.score,
            feedback: verdict.feedback,
          })

          notifyRevised({
            task: task.name,
            agent: task.agent,
            score: verdict.score,
            feedback: verdict.feedback,
          }).catch(err => console.warn('[REVIEWER] Slack revision notify failed:', err.message))

          console.log(`[REVIEWER] 🔄 Revision requested: "${task.name}" (${verdict.score}/5)`)
        }
      } catch (err) {
        console.error(`[REVIEWER] ❌ Error on "${task.name}":`, err.message)
        results.errors.push({ task: task.name, error: err.message })
      }
    }

    // Log summary
    await addActivity({
      'Agent': 'CHIEF',
      'Action': 'review cycle',
      'Task': 'Auto-Review',
      'Details': `Reviewed ${toReview.length} tasks: ${results.approved.length} approved, ${results.revised.length} revised, ${results.musePolished.length} MUSE polish. ${results.errors.length} errors.`,
      'Type': 'Comment',
    }).catch(err => console.warn('[REVIEWER] Activity log failed:', err.message))

    // Slack summary for review cycle
    notifyReviewCycle({
      reviewed: toReview.length,
      approved: results.approved.length,
      revised: results.revised.length,
      musePolished: results.musePolished.length,
      errors: results.errors.length,
    }).catch(err => console.warn('[REVIEWER] Slack review cycle notify failed:', err.message))

    // AUTO-REFILL: If review queue is nearly empty, trigger CMO planning
    // This keeps the pipeline continuously fed without waiting for cron
    const remainingReview = reviewTasks.length - toReview.length
    const freshTasks = tasks.filter(t => ['Queued', 'Assigned', 'In Progress'].includes(t.status))
    if (remainingReview === 0 && freshTasks.length < 10) {
      console.log(`[REVIEWER] 🔄 Review queue empty + only ${freshTasks.length} in pipeline — triggering auto-refill`)
      triggerAutoRefill().catch(err => console.warn('[REVIEWER] Auto-refill trigger failed:', err.message))
      results.autoRefillTriggered = true
    }

    return NextResponse.json({
      message: `Reviewed ${toReview.length} tasks`,
      results,
      duration: `${Date.now() - startTime}ms`,
    })

  } catch (err) {
    console.error('[REVIEWER] Fatal error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function buildReviewPrompt(task) {
  return `# Review Request

## Task: ${task.name}
## Created By: ${task.agent || 'Unknown'}
## Content Type: ${task.contentType || 'General'}
## Platform: ${Array.isArray(task.platform) ? task.platform.join(', ') : (task.platform || 'Not specified')}
## Campaign: ${task.campaign || 'Not specified'}

## Content to Review
\`\`\`
${(task.output || '').substring(0, 15000)}
\`\`\`

## Original Brief
${task.description || '(no brief provided)'}

${QUALITY_RUBRIC}

## Your Task
1. Score each dimension 1-5 using the rubric above
2. Calculate the average
3. Apply the verdict rules
4. Provide specific, actionable feedback

## Output Format (STRICT — follow exactly)
SCORES:
Narrative Ladder: X/5
Emotional Depth: X/5
Human Insight: X/5
Brand Voice: X/5
Platform Fit: X/5
Production Ready: X/5
AVERAGE: X.X
VERDICT: [APPROVE|APPROVE_WITH_NOTES|REVISE|REJECT]
FEEDBACK: [specific feedback — what's good, what needs improvement]
LEARNING: [pattern to remember for future content by this agent]

CRITICAL: You MUST include the VERDICT line with exactly one of: APPROVE, APPROVE_WITH_NOTES, REVISE, REJECT`
}

function parseVerdict(output) {
  // Extract average score
  const avgMatch = output.match(/AVERAGE:\s*([\d.]+)/i)
  const score = avgMatch ? parseFloat(avgMatch[1]) : 3.0

  // Extract verdict
  const verdictMatch = output.match(/VERDICT:\s*(APPROVE_WITH_NOTES|APPROVE|REVISE|REJECT)/i)
  const verdictText = verdictMatch ? verdictMatch[1].toUpperCase() : null

  // Extract feedback
  const feedbackMatch = output.match(/FEEDBACK:\s*([\s\S]*?)(?=\nLEARNING:|$)/i)
  const feedback = feedbackMatch ? feedbackMatch[1].trim().substring(0, 2000) : ''

  // Extract learning
  const learningMatch = output.match(/LEARNING:\s*([\s\S]*?)$/i)
  const learning = learningMatch ? learningMatch[1].trim().substring(0, 1000) : ''

  // Determine approval: explicit verdict takes priority, then score-based
  let approved
  if (verdictText) {
    approved = verdictText === 'APPROVE' || verdictText === 'APPROVE_WITH_NOTES'
  } else {
    // Fallback to score-based
    approved = score >= 3.0
  }

  return {
    approved,
    score,
    verdict: verdictText || (approved ? 'APPROVE' : 'REVISE'),
    feedback: approved ? '' : feedback,
    summary: feedback.substring(0, 200),
    learning,
  }
}

function getVersionNumber(output) {
  if (!output) return 1
  const matches = output.match(/---PREVIOUS OUTPUT \(v(\d+)\)---/g)
  return matches ? matches.length + 1 : 1
}

// Auto-refill helper — triggers CMO planning when pipeline runs low
async function triggerAutoRefill() {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/cron/run-agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': process.env.CRON_SECRET || '',
      },
      body: JSON.stringify({ planOnly: true }),
    })
    if (res.ok) {
      console.log(`[REVIEWER] 🔄 ✅ Auto-refill planning triggered`)
    }
  } catch {
    // Non-critical
  }
}

// Memory helper (same as cron runner)
async function saveMemory({ agent, type, content, source, importance, taskContext }) {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    await fetch(`${baseUrl}/api/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, type, content, source, importance, taskContext }),
    })
  } catch {
    // Non-critical
  }
}
