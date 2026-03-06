// Agent-to-Agent Delegation — allows agents to hand off tasks or request help
// Delegation creates a sub-task assigned to another agent with context from the original

import { createTask, addActivity } from '../../../../lib/airtable'
import { safeJsonParse, badRequest, successResponse, apiError } from '../../../../lib/api-utils'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const { data: body, error } = await safeJsonParse(request)
    if (error) return error
    const {
      fromAgent,       // Delegating agent's name
      toAgent,         // Target agent's name
      parentTaskName,  // Original task name for context
      taskName,        // New sub-task name
      description,     // What needs to be done
      contentType,     // Content type for the sub-task
      campaign,        // Campaign context
      platform,        // Target platforms
      priority,        // Priority level
      context,         // Additional context from the delegating agent
    } = body

    if (!fromAgent || !toAgent || !taskName) {
      return badRequest('fromAgent, toAgent, and taskName are required')
    }

    // Build enriched description with delegation context
    const enrichedDescription = [
      description || '',
      '',
      `--- Delegated by ${fromAgent} ---`,
      parentTaskName ? `Original Task: ${parentTaskName}` : '',
      context ? `Context: ${context}` : '',
    ].filter(Boolean).join('\n')

    // Create the delegated task
    const result = await createTask({
      'Task Name': `[Delegated] ${taskName}`,
      'Description': enrichedDescription,
      'Agent': toAgent,
      'Status': 'Assigned',
      'Priority': priority || 'Medium',
      'Content Type': contentType || 'General',
      'Campaign': campaign || '',
    })

    // Log the delegation activity
    await addActivity({
      'Agent': fromAgent,
      'Action': 'delegated',
      'Task': taskName,
      'Details': `Delegated to ${toAgent}: ${taskName}${parentTaskName ? ` (from: ${parentTaskName})` : ''}`,
      'Type': 'Comment',
    })

    // Log receiving agent activity
    await addActivity({
      'Agent': toAgent,
      'Action': 'received delegation',
      'Task': taskName,
      'Details': `Received delegated task from ${fromAgent}`,
      'Type': 'Task Created',
    })

    return successResponse({
      success: true,
      task: result,
      message: `Task "${taskName}" delegated from ${fromAgent} to ${toAgent}`,
    })
  } catch (error) {
    return apiError('DELEGATE', error)
  }
}
