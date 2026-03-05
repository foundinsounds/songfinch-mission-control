'use client'

import { useMemo } from 'react'
import { AGENTS } from '../lib/agents'

const MEDALS = ['🥇', '🥈', '🥉']

/**
 * Agent Performance Leaderboard
 * Ranks agents by a composite productivity score from task/content data
 */
export default function AgentLeaderboard({ tasks = [], content = [], compact = false }) {
  const rankings = useMemo(() => {
    const agentStats = {}

    // Initialize all agents
    AGENTS.forEach(agent => {
      agentStats[agent.name] = {
        agent,
        tasksDone: 0,
        tasksTotal: 0,
        contentGenerated: 0,
        inReview: 0,
        inProgress: 0,
        avgAge: 0,
      }
    })

    // Count tasks per agent
    tasks.forEach(task => {
      if (!task.agent || !agentStats[task.agent]) return
      const stats = agentStats[task.agent]
      stats.tasksTotal++
      if (task.status === 'Done') stats.tasksDone++
      if (task.status === 'Review') stats.inReview++
      if (task.status === 'In Progress') stats.inProgress++
    })

    // Count content per agent
    content.forEach(item => {
      if (!item.agent || !agentStats[item.agent]) return
      agentStats[item.agent].contentGenerated++
    })

    // Calculate scores and sort
    return Object.values(agentStats)
      .map(s => {
        const completionRate = s.tasksTotal > 0 ? s.tasksDone / s.tasksTotal : 0
        // Weighted score: completed tasks (×3) + content (×2) + completion rate bonus (×10)
        const score = (s.tasksDone * 3) + (s.contentGenerated * 2) + Math.round(completionRate * 10)
        return { ...s, completionRate, score }
      })
      .filter(s => s.tasksTotal > 0 || s.contentGenerated > 0) // Only show active agents
      .sort((a, b) => b.score - a.score)
  }, [tasks, content])

  if (rankings.length === 0) {
    return (
      <div className="text-center py-6 text-gray-600 text-[11px]">
        No agent activity yet
      </div>
    )
  }

  const maxScore = rankings[0]?.score || 1

  if (compact) {
    return (
      <div className="space-y-1">
        {rankings.slice(0, 5).map((entry, idx) => (
          <div key={entry.agent.name} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-dark-700/50 transition-colors">
            <span className="text-[12px] w-5 text-center">
              {idx < 3 ? MEDALS[idx] : <span className="text-gray-600 text-[10px]">#{idx + 1}</span>}
            </span>
            <span className="text-[12px]">{entry.agent.emoji}</span>
            <span className="text-[11px] font-medium text-gray-300 flex-1 truncate">{entry.agent.name}</span>
            <span className="text-[10px] font-mono text-accent-orange font-bold">{entry.score}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {rankings.map((entry, idx) => (
        <div
          key={entry.agent.name}
          className="bg-dark-700/50 border border-dark-500 rounded-lg p-3 hover:border-dark-400 transition-all"
        >
          <div className="flex items-center gap-2.5 mb-2">
            {/* Rank */}
            <span className="text-[16px] w-6 text-center shrink-0">
              {idx < 3 ? MEDALS[idx] : <span className="text-gray-600 text-[11px] font-bold">#{idx + 1}</span>}
            </span>

            {/* Agent Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
              style={{
                background: `${entry.agent.color}15`,
                border: `2px solid ${entry.agent.color}`,
              }}
            >
              {entry.agent.emoji}
            </div>

            {/* Name + Role */}
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-gray-200">{entry.agent.name}</div>
              <div className="text-[10px] text-gray-500">{entry.agent.role}</div>
            </div>

            {/* Score */}
            <div className="text-right shrink-0">
              <div className="text-[14px] font-bold text-accent-orange">{entry.score}</div>
              <div className="text-[9px] text-gray-600 uppercase tracking-wider">pts</div>
            </div>
          </div>

          {/* Score Bar */}
          <div className="h-1.5 bg-dark-600 rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full animate-progress"
              style={{
                width: `${(entry.score / maxScore) * 100}%`,
                backgroundColor: entry.agent.color,
                transition: 'width 0.8s ease',
              }}
            />
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1">
              <span className="text-accent-green font-bold">{entry.tasksDone}</span>
              <span className="text-gray-600">done</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-accent-orange font-bold">{entry.inReview}</span>
              <span className="text-gray-600">review</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-accent-purple font-bold">{entry.contentGenerated}</span>
              <span className="text-gray-600">content</span>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span className="text-gray-400 font-bold">{Math.round(entry.completionRate * 100)}%</span>
              <span className="text-gray-600">rate</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
