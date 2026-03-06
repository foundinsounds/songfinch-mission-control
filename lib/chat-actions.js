// Chat Action Engine — parses and executes structured actions from AI responses
// Actions are embedded in AI text as [ACTION: type | param=value | param=value]
// This keeps the system provider-agnostic (works with Claude, GPT, Gemini)

import { updateTask, createTask, addActivity, getTasks, getAgents } from './airtable'

// ── Available actions the AI can invoke ──────────────────────────
const ACTION_DEFINITIONS = `
You can take REAL actions on the pipeline by including action tags in your response.
Format: [ACTION: action_type | param=value | param=value]

Available actions:
1. Move a task to a new status:
   [ACTION: move_task | task=Task Name Here | status=Review]
   Valid statuses: Inbox, Assigned, In Progress, Review, Done, Revisit

2. Reassign a task to a different agent:
   [ACTION: assign_task | task=Task Name Here | agent=LYRA]

3. Create a new task:
   [ACTION: create_task | name=Write Q2 blog post | agent=VEGA | priority=High | contentType=Blog Post]
   Optional params: agent, priority (Low/Medium/High/Urgent), contentType, campaign, status

4. Change task priority:
   [ACTION: set_priority | task=Task Name Here | priority=High]

Rules:
- You may include multiple actions in one response.
- Always explain what you're doing alongside the action.
- Only take actions when the user clearly requests or approves them.
- Use exact task names and agent names from the pipeline context.
- Actions are executed immediately and logged to the activity feed.
`

export { ACTION_DEFINITIONS }

// Valid statuses for validation
const VALID_STATUSES = new Set([
  'Inbox', 'Assigned', 'In Progress', 'Review', 'Done', 'Revisit',
])

const VALID_PRIORITIES = new Set(['Low', 'Medium', 'High', 'Urgent'])

/**
 * Parse [ACTION: ...] tags from AI response text.
 * Returns { cleanText, actions[] }
 */
export function parseActions(text) {
  const actionRegex = /\[ACTION:\s*(\w+)\s*\|([^\]]+)\]/g
  const actions = []
  let match

  while ((match = actionRegex.exec(text)) !== null) {
    const type = match[1].trim()
    const paramsRaw = match[2].trim()
    const params = {}

    // Parse pipe-separated key=value pairs
    paramsRaw.split('|').forEach(pair => {
      const eqIdx = pair.indexOf('=')
      if (eqIdx > 0) {
        const key = pair.substring(0, eqIdx).trim()
        const value = pair.substring(eqIdx + 1).trim()
        params[key] = value
      }
    })

    actions.push({ type, params, raw: match[0] })
  }

  // Remove action tags from the response text shown to the user
  const cleanText = text.replace(actionRegex, '').replace(/\n{3,}/g, '\n\n').trim()

  return { cleanText, actions }
}

/**
 * Execute a list of parsed actions against the Airtable backend.
 * Returns an array of result objects: { type, success, message, details }
 */
export async function executeActions(actions, { respondingAs = 'Council' } = {}) {
  if (!actions.length) return []

  // Fetch current tasks and agents for name matching
  const [tasks, agents] = await Promise.all([
    getTasks({ noCache: true }),
    getAgents({ noCache: true }),
  ])

  const results = []

  for (const action of actions) {
    try {
      const result = await executeSingleAction(action, { tasks, agents, respondingAs })
      results.push(result)
    } catch (err) {
      results.push({
        type: action.type,
        success: false,
        message: `Failed: ${err.message}`,
        details: action.params,
      })
    }
  }

  return results
}

async function executeSingleAction(action, { tasks, agents, respondingAs }) {
  switch (action.type) {
    case 'move_task':
      return await executeMoveTask(action.params, { tasks, respondingAs })
    case 'assign_task':
      return await executeAssignTask(action.params, { tasks, agents, respondingAs })
    case 'create_task':
      return await executeCreateTask(action.params, { agents, respondingAs })
    case 'set_priority':
      return await executeSetPriority(action.params, { tasks, respondingAs })
    default:
      return { type: action.type, success: false, message: `Unknown action type: ${action.type}` }
  }
}

// ── Action executors ──────────────────────────────────────────────

async function executeMoveTask(params, { tasks, respondingAs }) {
  const { task: taskName, status } = params
  if (!taskName || !status) {
    return { type: 'move_task', success: false, message: 'Missing task name or status' }
  }
  if (!VALID_STATUSES.has(status)) {
    return { type: 'move_task', success: false, message: `Invalid status "${status}"` }
  }

  const match = findTask(tasks, taskName)
  if (!match) {
    return { type: 'move_task', success: false, message: `Task not found: "${taskName}"` }
  }

  const fields = { 'Status': status }
  if (status === 'Done') {
    fields['Completed At'] = new Date().toISOString()
  }

  await updateTask(match.id, fields)

  await addActivity({
    'Agent': respondingAs,
    'Action': 'moved',
    'Task': match.name,
    'Details': `Moved from ${match.status} to ${status} via chat`,
    'Type': 'Status Changed',
  }).catch(() => {})

  return {
    type: 'move_task',
    success: true,
    message: `Moved "${match.name}" to ${status}`,
    details: { taskId: match.id, from: match.status, to: status },
  }
}

async function executeAssignTask(params, { tasks, agents, respondingAs }) {
  const { task: taskName, agent: agentName } = params
  if (!taskName || !agentName) {
    return { type: 'assign_task', success: false, message: 'Missing task name or agent name' }
  }

  const match = findTask(tasks, taskName)
  if (!match) {
    return { type: 'assign_task', success: false, message: `Task not found: "${taskName}"` }
  }

  const agent = agents.find(a => a.name.toLowerCase() === agentName.toLowerCase())
  if (!agent) {
    return { type: 'assign_task', success: false, message: `Agent not found: "${agentName}"` }
  }

  await updateTask(match.id, { 'Agent': agent.name })

  await addActivity({
    'Agent': respondingAs,
    'Action': 'reassigned',
    'Task': match.name,
    'Details': `Reassigned from ${match.agent || 'unassigned'} to ${agent.name} via chat`,
    'Type': 'Task Created',
  }).catch(() => {})

  return {
    type: 'assign_task',
    success: true,
    message: `Assigned "${match.name}" to ${agent.name}`,
    details: { taskId: match.id, from: match.agent, to: agent.name },
  }
}

async function executeCreateTask(params, { agents, respondingAs }) {
  const { name, agent, priority, contentType, campaign, status } = params
  if (!name) {
    return { type: 'create_task', success: false, message: 'Task name is required' }
  }

  const fields = {
    'Task Name': name,
    'Description': params.description || '',
    'Content Type': contentType || 'General',
    'Priority': (priority && VALID_PRIORITIES.has(priority)) ? priority : 'Medium',
    'Status': status || (agent ? 'Assigned' : 'Inbox'),
  }

  if (agent) {
    const matchedAgent = agents.find(a => a.name.toLowerCase() === agent.toLowerCase())
    if (matchedAgent) fields['Agent'] = matchedAgent.name
  }
  if (campaign) fields['Campaign'] = campaign

  const result = await createTask(fields)

  await addActivity({
    'Agent': respondingAs,
    'Action': 'created',
    'Task': name,
    'Details': `Created via chat${agent ? ` and assigned to ${agent}` : ''}`,
    'Type': 'Task Created',
  }).catch(() => {})

  return {
    type: 'create_task',
    success: true,
    message: `Created task "${name}"${agent ? ` assigned to ${agent}` : ''}`,
    details: { taskId: result.records?.[0]?.id, name, agent: agent || null },
  }
}

async function executeSetPriority(params, { tasks, respondingAs }) {
  const { task: taskName, priority } = params
  if (!taskName || !priority) {
    return { type: 'set_priority', success: false, message: 'Missing task name or priority' }
  }
  if (!VALID_PRIORITIES.has(priority)) {
    return { type: 'set_priority', success: false, message: `Invalid priority "${priority}"` }
  }

  const match = findTask(tasks, taskName)
  if (!match) {
    return { type: 'set_priority', success: false, message: `Task not found: "${taskName}"` }
  }

  await updateTask(match.id, { 'Priority': priority })

  await addActivity({
    'Agent': respondingAs,
    'Action': 'priority-changed',
    'Task': match.name,
    'Details': `Priority changed from ${match.priority} to ${priority} via chat`,
    'Type': 'Comment',
  }).catch(() => {})

  return {
    type: 'set_priority',
    success: true,
    message: `Set "${match.name}" priority to ${priority}`,
    details: { taskId: match.id, from: match.priority, to: priority },
  }
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Fuzzy-match a task by name — tries exact match first, then case-insensitive,
 * then substring match (for partial names).
 */
function findTask(tasks, name) {
  if (!name) return null
  const lower = name.toLowerCase()

  // Exact match
  let match = tasks.find(t => t.name === name)
  if (match) return match

  // Case-insensitive
  match = tasks.find(t => t.name.toLowerCase() === lower)
  if (match) return match

  // Substring match — both directions for flexibility
  match = tasks.find(t => t.name.toLowerCase().includes(lower))
  if (match) return match

  match = tasks.find(t => lower.includes(t.name.toLowerCase()))
  return match || null
}
