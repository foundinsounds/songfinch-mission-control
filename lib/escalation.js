/**
 * Task Priority Auto-Escalation Engine
 *
 * Checks task age and escalates priority based on configurable rules:
 * - Low → Medium after 48 hours idle (non-Done, non-Inbox)
 * - Medium → High after 72 hours idle (non-Done, non-Inbox)
 *
 * Returns modified tasks with escalation metadata but doesn't mutate originals.
 */

const ESCALATION_RULES = [
  {
    from: 'Low',
    to: 'Medium',
    afterHours: 48,
    excludeStatuses: ['Done', 'Inbox', 'Archived', 'Revisit'],
  },
  {
    from: 'Medium',
    to: 'High',
    afterHours: 72,
    excludeStatuses: ['Done', 'Inbox', 'Archived', 'Revisit'],
  },
]

/**
 * Calculate how many hours ago a date string was.
 */
function hoursAgo(dateStr) {
  if (!dateStr) return 0
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 0
  return (Date.now() - date.getTime()) / (1000 * 60 * 60)
}

/**
 * Check tasks against escalation rules and return tasks with escalation info.
 * Does not mutate the original task array.
 *
 * @param {Array} tasks — array of task objects
 * @returns {Array} tasks with `_escalated` metadata if applicable
 */
export function checkEscalations(tasks) {
  return tasks.map(task => {
    const age = hoursAgo(task.created)

    for (const rule of ESCALATION_RULES) {
      if (
        task.priority === rule.from &&
        age >= rule.afterHours &&
        !rule.excludeStatuses.includes(task.status)
      ) {
        return {
          ...task,
          priority: rule.to,
          _escalated: {
            from: rule.from,
            to: rule.to,
            ageHours: Math.round(age),
            rule: `${rule.from} → ${rule.to} after ${rule.afterHours}h`,
          },
        }
      }
    }

    return task
  })
}

/**
 * Get summary stats about escalated tasks.
 */
export function getEscalationStats(tasks) {
  const escalated = tasks.filter(t => t._escalated)
  return {
    count: escalated.length,
    byRule: escalated.reduce((acc, t) => {
      const key = t._escalated.rule
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {}),
  }
}
