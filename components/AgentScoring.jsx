'use client'

import { useMemo } from 'react'

function ScoreBar({ value, max = 100, color = 'bg-accent-orange' }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="w-full h-1.5 bg-dark-600 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function ScoreRing({ score, size = 48, color = '#F97316' }) {
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  )
}

export default function AgentScoring({ agents, tasks, activity }) {
  const agentScores = useMemo(() => {
    return agents.map(agent => {
      const agentTasks = tasks.filter(t => t.agent === agent.name)
      const done = agentTasks.filter(t => t.status === 'Done')
      const totalOutput = done.reduce((s, t) => s + (t.output?.length || 0), 0)
      const avgOutput = done.length > 0 ? Math.round(totalOutput / done.length) : 0
      const completionRate = agentTasks.length > 0 ? Math.round((done.length / agentTasks.length) * 100) : 0
      const agentActivity = activity.filter(a => a.agent === agent.name)
      const errors = agentActivity.filter(a => a.action === 'error').length
      const revisions = agentTasks.filter(t => t.output?.includes('PREVIOUS OUTPUT')).length

      // Calculate composite score (0-100)
      const productivityScore = Math.min(100, done.length * 15)
      const qualityScore = Math.max(0, 100 - (revisions * 20) - (errors * 25))
      const outputScore = Math.min(100, Math.round(avgOutput / 50))
      const reliabilityScore = completionRate

      const overall = Math.round((productivityScore * 0.3 + qualityScore * 0.3 + outputScore * 0.2 + reliabilityScore * 0.2))

      return {
        agent,
        done: done.length,
        total: agentTasks.length,
        totalOutput,
        avgOutput,
        completionRate,
        errors,
        revisions,
        productivityScore,
        qualityScore,
        outputScore,
        reliabilityScore,
        overall,
      }
    }).sort((a, b) => b.overall - a.overall)
  }, [agents, tasks, activity])

  const topPerformer = agentScores[0]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between shrink-0 bg-dark-800/50">
        <h2 className="text-sm font-bold text-gray-200">Agent Performance</h2>
        {topPerformer && (
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-gray-500">Top Performer:</span>
            <span className="text-accent-orange font-semibold">{topPerformer.agent.emoji} {topPerformer.agent.name}</span>
            <span className="text-accent-green font-bold">{topPerformer.overall}/100</span>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {agentScores.map((score, rank) => (
          <div key={score.agent.id} className="bg-dark-700 rounded-lg border border-dark-500 p-4 hover:border-dark-400 transition-colors">
            <div className="flex items-center gap-4">
              {/* Rank */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                rank === 0 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                rank === 1 ? 'bg-gray-400/20 text-gray-300 border border-gray-400/30' :
                rank === 2 ? 'bg-orange-700/20 text-orange-400 border border-orange-700/30' :
                'bg-dark-600 text-gray-500'
              }`}>
                #{rank + 1}
              </div>

              {/* Agent Info */}
              <div className="flex items-center gap-2 w-32 shrink-0">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
                  style={{ background: `${score.agent.color}15`, border: `2px solid ${score.agent.color}` }}>
                  {score.agent.emoji}
                </div>
                <div>
                  <div className="text-sm font-semibold">{score.agent.name}</div>
                  <div className="text-[10px] text-gray-500">{score.agent.role}</div>
                </div>
              </div>

              {/* Score Ring */}
              <ScoreRing score={score.overall} color={score.agent.color} />

              {/* Score Breakdown */}
              <div className="flex-1 grid grid-cols-4 gap-3">
                <div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Productivity</div>
                  <div className="text-xs font-semibold text-gray-300 mb-1">{score.productivityScore}</div>
                  <ScoreBar value={score.productivityScore} color="bg-blue-500" />
                </div>
                <div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Quality</div>
                  <div className="text-xs font-semibold text-gray-300 mb-1">{score.qualityScore}</div>
                  <ScoreBar value={score.qualityScore} color="bg-green-500" />
                </div>
                <div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Output</div>
                  <div className="text-xs font-semibold text-gray-300 mb-1">{score.outputScore}</div>
                  <ScoreBar value={score.outputScore} color="bg-purple-500" />
                </div>
                <div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Reliability</div>
                  <div className="text-xs font-semibold text-gray-300 mb-1">{score.reliabilityScore}%</div>
                  <ScoreBar value={score.reliabilityScore} color="bg-orange-500" />
                </div>
              </div>

              {/* Quick Stats */}
              <div className="text-right shrink-0 space-y-0.5">
                <div className="text-[10px] text-gray-500">{score.done}/{score.total} tasks</div>
                <div className="text-[10px] text-gray-600">{Math.round(score.totalOutput / 1000)}k chars</div>
                {score.revisions > 0 && (
                  <div className="text-[10px] text-orange-400">{score.revisions} revisions</div>
                )}
                {score.errors > 0 && (
                  <div className="text-[10px] text-red-400">{score.errors} errors</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
