import { updateTask, addActivity } from '../../../../lib/airtable'
import { NextResponse } from 'next/server'
import { safeJsonParse } from '../../../../lib/api-utils'

export async function POST(request) {
  try {
    const { data: body, error } = await safeJsonParse(request)
    if (error) return error
    const { recordId, feedback, currentOutput, taskName, agentName } = body

    if (!recordId || !feedback) {
      return NextResponse.json(
        { error: 'recordId and feedback are required' },
        { status: 400 }
      )
    }

    // Count existing revisions to determine version number
    const prevVersions = (currentOutput || '').match(/---PREVIOUS OUTPUT \(v\d+\)---/g)
    const currentVersion = prevVersions ? prevVersions.length + 1 : 1

    // Build revision-aware output:
    // [REVISION REQUESTED] marker tells the agent runner to include feedback
    // Previous output is preserved for history
    const revisionOutput = [
      `[REVISION REQUESTED]`,
      `Feedback: ${feedback}`,
      ``,
      `---PREVIOUS OUTPUT (v${currentVersion})---`,
      currentOutput || '(no previous output)',
    ].join('\n')

    // Update task: store feedback in Output, reset status to Assigned
    await updateTask(recordId, {
      'Status': 'Assigned',
      'Output': revisionOutput,
    })

    // Log the feedback activity
    await addActivity({
      'Agent': 'Council',
      'Action': 'requested revision',
      'Task': taskName || 'Task',
      'Details': `Feedback: ${feedback.substring(0, 500)}`,
      'Type': 'Comment',
    }).catch(err => console.warn('[FEEDBACK] Activity log failed:', err.message))

    return NextResponse.json({
      success: true,
      message: `Task sent back for revision (v${currentVersion + 1})`,
      version: currentVersion + 1,
    })
  } catch (error) {
    console.error('Feedback error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}
