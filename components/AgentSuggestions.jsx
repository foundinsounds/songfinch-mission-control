'use client'

import { useMemo } from 'react'
import { AGENTS } from '../lib/agents'

/**
 * Agent → Content Type specialty mapping.
 * Each agent has primary and secondary content types they excel at.
 * Scores: primary = 1.0, secondary = 0.5, tertiary = 0.25
 */
const AGENT_CONTENT_SKILLS = {
  CMO: { primary: ['Strategy'], secondary: ['Research'], tertiary: [] },
  CHIEF: { primary: [], secondary: ['Strategy'], tertiary: ['Research'] },
  MUSE: { primary: [], secondary: ['Ad Copy', 'Social Post', 'Video Script', 'Blog Post', 'Artist Spotlight'], tertiary: ['Landing Page', 'Press Release'] },
  HOOK: { primary: ['Ad Copy'], secondary: ['Social Post'], tertiary: ['Email'] },
  PULSE: { primary: ['Social Post'], secondary: ['Email', 'Newsletter'], tertiary: ['Ad Copy'] },
  LENS: { primary: ['Video Script'], secondary: ['Design'], tertiary: ['Social Post'] },
  STORY: { primary: ['Blog Post', 'Artist Spotlight', 'Press Release', 'Newsletter'], secondary: ['SEO Content', 'Email'], tertiary: ['Social Post'] },
  SCOUT: { primary: ['Research'], secondary: ['Strategy'], tertiary: [] },
  FLOW: { primary: ['SEO Content', 'Landing Page'], secondary: ['Blog Post'], tertiary: ['Email'] },
  PIXEL: { primary: ['Landing Page', 'Design'], secondary: [], tertiary: [] },
}

/**
 * Agent → Platform specialty mapping.
 */
const AGENT_PLATFORM_SKILLS = {
  CMO: [],
  CHIEF: [],
  MUSE: [],
  HOOK: ['Facebook', 'Instagram'],
  PULSE: ['Instagram', 'TikTok', 'Facebook', 'Twitter', 'Pinterest', 'LinkedIn'],
  LENS: ['YouTube', 'TikTok', 'Instagram'],
  STORY: ['Email'],
  SCOUT: [],
  FLOW: [],
  PIXEL: [],
}

/**
 * Score an agent for a given task based on multiple factors.
 * Returns a score between 0 and 100.
 */
function scoreAgent(agent, task, allTasks = []) {
  let score = 0
  const skills = AGENT_CONTENT_SKILLS[agent.name] || { primary: [], secondary: [], tertiary: [] }
  const platformSkills = AGENT_PLATFORM_SKILLS[agent.name] || []

  // Factor 1: Content Type Match (max 60 points)
  if (task.contentType) {
    if (skills.primary.includes(task.contentType)) score += 60
    else if (skills.secondary.includes(task.contentType)) score += 35
    else if (skills.tertiary.includes(task.contentType)) score += 15
  }

  // Factor 2: Platform Match (max 25 points)
  if (task.platform && task.platform.length > 0) {
    const matches = task.platform.filter(p => platformSkills.includes(p)).length
    const ratio = matches / task.platform.length
    score += Math.round(ratio * 25)
  }

  // Factor 3: Workload Balance (max 15 points)
  // Agents with fewer active tasks get a boost
  const agentActiveTasks = allTasks.filter(
    t => t.agent === agent.name && (t.status === 'In Progress' || t.status === 'Assigned')
  ).length
  if (agentActiveTasks === 0) score += 15
  else if (agentActiveTasks === 1) score += 10
  else if (agentActiveTasks === 2) score += 5
  // 3+ active tasks: no bonus

  // Bonus: Agent type hierarchy — exec/ops agents shouldn't get specialist tasks
  if (agent.type === 'EXEC' || agent.type === 'OPS') {
    // Reduce score for specialist work (CMO/CHIEF shouldn't write ad copy)
    if (!skills.primary.includes(task.contentType) && !skills.secondary.includes(task.contentType)) {
      score = Math.max(0, score - 20)
    }
  }

  // Bonus: Active status preference
  if (agent.status === 'Active') score += 2
  if (agent.status === 'Working') score += 1

  return Math.min(100, Math.max(0, score))
}

/**
 * Get the top N agent suggestions for a task.
 */
export function getAgentSuggestions(task, allTasks = [], topN = 3) {
  const scored = AGENTS
    .map(agent => ({
      agent,
      score: scoreAgent(agent, task, allTasks),
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)

  // Normalize to percentage (best = ~95%)
  const maxScore = scored[0]?.score || 1
  return scored.map(s => ({
    ...s,
    confidence: Math.round((s.score / maxScore) * 95 + Math.random() * 3),
  }))
}

/**
 * Get a short reason why this agent is a good fit.
 */
function getMatchReason(agent, task) {
  const skills = AGENT_CONTENT_SKILLS[agent.name] || { primary: [], secondary: [], tertiary: [] }
  const platformSkills = AGENT_PLATFORM_SKILLS[agent.name] || []

  const reasons = []

  if (task.contentType && skills.primary.includes(task.contentType)) {
    reasons.push(`${task.contentType} specialist`)
  } else if (task.contentType && skills.secondary.includes(task.contentType)) {
    reasons.push(`${task.contentType} capable`)
  }

  if (task.platform && task.platform.length > 0) {
    const matches = task.platform.filter(p => platformSkills.includes(p))
    if (matches.length > 0) {
      reasons.push(`${matches.join(', ')} expert`)
    }
  }

  if (reasons.length === 0) reasons.push(agent.role)

  return reasons.join(' · ')
}

/**
 * Confidence bar color based on score.
 */
function getConfidenceColor(confidence) {
  if (confidence >= 80) return 'bg-accent-green'
  if (confidence >= 50) return 'bg-yellow-400'
  return 'bg-gray-500'
}

/**
 * Agent suggestion UI — shows recommended agents for unassigned tasks.
 */
export default function AgentSuggestions({ task, allTasks = [], onAssign }) {
  const suggestions = useMemo(
    () => getAgentSuggestions(task, allTasks),
    [task, allTasks]
  )

  if (suggestions.length === 0) {
    return (
      <div className="p-3 bg-dark-600 rounded-lg text-center text-gray-500 text-xs">
        No agent matches for this task type
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {suggestions.map(({ agent, confidence }, idx) => {
        const reason = getMatchReason(agent, task)
        const confColor = getConfidenceColor(confidence)
        const isBest = idx === 0

        return (
          <div
            key={agent.id}
            className={`group flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
              isBest
                ? 'bg-accent-green/5 border-accent-green/20 hover:bg-accent-green/10'
                : 'bg-dark-600 border-dark-500 hover:border-gray-500 hover:bg-dark-500'
            }`}
            onClick={() => onAssign && onAssign(agent)}
          >
            {/* Agent avatar */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0"
              style={{
                background: `${agent.color}15`,
                border: `2px solid ${agent.color}`,
              }}
            >
              {agent.emoji}
            </div>

            {/* Agent info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-200">{agent.name}</span>
                {isBest && (
                  <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-green/15 text-accent-green border border-accent-green/25">
                    Best Match
                  </span>
                )}
              </div>
              <div className="text-[10px] text-gray-500 truncate">{reason}</div>
            </div>

            {/* Confidence bar + score */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-16 h-1.5 bg-dark-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${confColor}`}
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <span className={`text-[10px] font-mono font-bold ${isBest ? 'text-accent-green' : 'text-gray-400'}`}>
                {confidence}%
              </span>
            </div>

            {/* Assign button (visible on hover) */}
            <button
              className="opacity-0 group-hover:opacity-100 text-[9px] font-semibold px-2 py-1 rounded bg-accent-orange/15 text-accent-orange border border-accent-orange/25 hover:bg-accent-orange/25 transition-all shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                onAssign && onAssign(agent)
              }}
            >
              Assign
            </button>
          </div>
        )
      })}
    </div>
  )
}
