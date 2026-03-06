/**
 * agentMetrics.js — Computes real performance metrics for an agent
 * from the live task list.
 *
 * Replaces the mock Math.random() metrics in AgentConfigPanel.
 *
 * Metrics derived:
 *  - tasksThisWeek:      count of tasks created in last 7 days for this agent
 *  - completionRate:     % of this agent's tasks that reached "Done"
 *  - outputWords:        total word count across all output fields
 *  - activeTasks:        count of non-Done tasks currently assigned
 *  - avgOutputWords:     average words per completed task (with output)
 *  - tasksByStatus:      breakdown of task counts by status
 */

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * @param {Array} tasks  — full task list from Airtable/state
 * @param {string} agentName — the agent's display name (matches task.agent)
 * @returns {object} computed metrics
 */
export function computeAgentMetrics(tasks, agentName) {
  if (!tasks || !agentName) return emptyMetrics()

  const agentTasks = tasks.filter(t => t.agent === agentName)

  if (agentTasks.length === 0) return emptyMetrics()

  const now = Date.now()
  const weekAgo = now - ONE_WEEK_MS

  // Tasks created in the last 7 days
  const tasksThisWeek = agentTasks.filter(t => {
    if (!t.createdAt) return false
    return new Date(t.createdAt).getTime() > weekAgo
  }).length

  // Status breakdown
  const tasksByStatus = { Inbox: 0, Assigned: 0, 'In Progress': 0, Review: 0, Done: 0, Revisit: 0 }
  for (const t of agentTasks) {
    if (tasksByStatus[t.status] !== undefined) {
      tasksByStatus[t.status]++
    }
  }

  const totalTasks = agentTasks.length
  const doneTasks = tasksByStatus.Done
  const activeTasks = totalTasks - doneTasks

  // Completion rate: what percentage of tasks have reached Done
  const completionRate = totalTasks > 0
    ? Math.round((doneTasks / totalTasks) * 100)
    : 0

  // Output word count: sum of words in all output fields
  let totalOutputWords = 0
  let tasksWithOutput = 0
  for (const t of agentTasks) {
    if (t.output && t.output.trim().length > 0) {
      totalOutputWords += countWords(t.output)
      tasksWithOutput++
    }
  }

  const avgOutputWords = tasksWithOutput > 0
    ? Math.round(totalOutputWords / tasksWithOutput)
    : 0

  return {
    tasksThisWeek,
    completionRate,
    outputWords: totalOutputWords,
    avgOutputWords,
    activeTasks,
    totalTasks,
    doneTasks,
    tasksByStatus,
  }
}

/** Count words in a text string (splitting on whitespace) */
function countWords(text) {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** Default metrics when no data is available */
function emptyMetrics() {
  return {
    tasksThisWeek: 0,
    completionRate: 0,
    outputWords: 0,
    avgOutputWords: 0,
    activeTasks: 0,
    totalTasks: 0,
    doneTasks: 0,
    tasksByStatus: { Inbox: 0, Assigned: 0, 'In Progress': 0, Review: 0, Done: 0, Revisit: 0 },
  }
}
