// Google Drive Export API — Manual trigger for exporting content to Drive
// Called by: dashboard "Export to Drive" button, bulk export, manual trigger
// Exports task output to the KING CLAUDE Google Drive folder

import { exportToDrive, isDriveConfigured, getDriveStatus } from '../../../../lib/drive'
import { getTasks, updateTask, addActivity } from '../../../../lib/airtable'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/export/drive
 * Returns Drive configuration status
 */
export async function GET() {
  const status = getDriveStatus()
  return NextResponse.json({
    configured: status.configured,
    ...status,
  })
}

/**
 * POST /api/export/drive
 *
 * Body options:
 *   taskId     — Single task ID to export
 *   taskIds    — Array of task IDs to bulk export
 *   exportAll  — Boolean: export ALL tasks with output but no Drive link
 *   status     — Filter for exportAll (default: 'Review' + 'Done')
 */
export async function POST(request) {
  const startTime = Date.now()

  try {
    if (!isDriveConfigured()) {
      return NextResponse.json({
        error: 'Google Drive not configured',
        setup: {
          required: [
            'GOOGLE_SERVICE_ACCOUNT_KEY — Base64-encoded service account JSON',
            'GOOGLE_DRIVE_FOLDER_ID — Target folder ID from Drive URL',
          ],
          steps: [
            '1. Go to console.cloud.google.com → APIs & Services → Enable Google Drive API',
            '2. Create a Service Account → download JSON key',
            '3. Base64 encode: cat key.json | base64',
            '4. Share your KING CLAUDE Drive folder with the service account email',
            '5. Add GOOGLE_SERVICE_ACCOUNT_KEY and GOOGLE_DRIVE_FOLDER_ID to .env.local',
          ],
          folderId: 'Get from Drive URL: drive.google.com/drive/folders/{THIS_IS_THE_ID}',
        },
      }, { status: 503 })
    }

    const body = await request.json()
    const { taskId, taskIds, exportAll, status: filterStatus } = body

    // Determine which tasks to export
    let tasksToExport = []

    if (taskId) {
      // Single task export
      const allTasks = await getTasks({ noCache: true })
      const task = allTasks.find(t => t.id === taskId)
      if (!task) {
        return NextResponse.json({ error: `Task ${taskId} not found` }, { status: 404 })
      }
      if (!task.output) {
        return NextResponse.json({ error: `Task "${task.name}" has no output to export` }, { status: 400 })
      }
      tasksToExport = [task]
    }
    else if (taskIds && Array.isArray(taskIds)) {
      // Bulk export by IDs
      const allTasks = await getTasks({ noCache: true })
      tasksToExport = allTasks.filter(t => taskIds.includes(t.id) && t.output)
    }
    else if (exportAll) {
      // Export all tasks that have output but no Drive link
      const allTasks = await getTasks({ noCache: true })
      const validStatuses = filterStatus
        ? [filterStatus]
        : ['Review', 'Done', 'In Progress']
      tasksToExport = allTasks.filter(t =>
        t.output &&
        !t.driveLink &&
        validStatuses.includes(t.status)
      )
    }
    else {
      return NextResponse.json({
        error: 'Provide taskId, taskIds[], or exportAll: true',
      }, { status: 400 })
    }

    if (tasksToExport.length === 0) {
      return NextResponse.json({
        message: 'No tasks to export',
        count: 0,
      })
    }

    console.log(`[DRIVE-EXPORT] Exporting ${tasksToExport.length} tasks to Google Drive...`)

    // Export each task (sequential to avoid rate limits)
    const results = { exported: [], errors: [] }

    for (const task of tasksToExport) {
      try {
        const driveResult = await exportToDrive(task)

        if (driveResult) {
          // Update Airtable task with Drive link
          await updateTask(task.id, {
            'Google Drive Link': driveResult.url,
          }).catch(err => console.warn(`[DRIVE-EXPORT] Airtable update failed: ${err.message}`))

          results.exported.push({
            taskId: task.id,
            taskName: task.name,
            driveUrl: driveResult.url,
            fileId: driveResult.fileId,
          })
        }
      } catch (err) {
        console.error(`[DRIVE-EXPORT] Failed: "${task.name}" — ${err.message}`)
        results.errors.push({
          taskId: task.id,
          taskName: task.name,
          error: err.message,
        })
      }

      // Rate limit: 200ms between exports
      if (tasksToExport.indexOf(task) < tasksToExport.length - 1) {
        await new Promise(r => setTimeout(r, 200))
      }
    }

    // Log activity
    await addActivity({
      'Agent': 'System',
      'Action': 'exported to Drive',
      'Task': 'Drive Export',
      'Details': `Exported ${results.exported.length}/${tasksToExport.length} tasks to Google Drive. ${results.errors.length} errors.`,
      'Type': 'Content Generated',
    }).catch(() => {})

    const duration = Date.now() - startTime

    return NextResponse.json({
      message: `Exported ${results.exported.length} tasks to Google Drive`,
      count: results.exported.length,
      errors: results.errors.length,
      results,
      duration: `${duration}ms`,
    })

  } catch (err) {
    console.error('[DRIVE-EXPORT] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
