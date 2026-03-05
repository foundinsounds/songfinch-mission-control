'use client';

import { useMemo, useState, useEffect, useRef } from 'react';

export default function ProductivityScore({ tasks = [], activity = [] }) {
  const [animated, setAnimated] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const prevScoreRef = useRef(0);

  const breakdown = useMemo(() => {
    // 1. Task completion rate: done / total * 40
    const totalTasks = tasks.length;
    const normalize = (s) => (s || '').toLowerCase().replace(/[_\s]+/g, '_');
    const doneTasks = tasks.filter((t) => {
      const s = normalize(t.status);
      return s === 'done' || s === 'completed';
    }).length;
    const completionScore =
      totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 40) : 0;

    // 2. Review turnaround: tasks moved from Review to Done today * 20 points
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    // Count approvals today as turnaround proxy (Airtable uses 'Approved' type, not 'status_change')
    const approvedToday = activity.filter((ev) => {
      const evDate = new Date(ev.timestamp || ev.created_at || ev.date || 0);
      const evType = normalize(ev.type || ev.action || '');
      return (
        evDate >= todayStart &&
        (evType === 'approved' || evType === 'status_change' || evType === 'completed')
      );
    }).length;
    // Also count tasks marked Done today
    const completedToday = activity.filter((ev) => {
      const evDate = new Date(ev.timestamp || ev.created_at || ev.date || 0);
      const evType = normalize(ev.type || ev.action || '');
      return evDate >= todayStart && (evType === 'content_generated');
    }).length;
    const turnaroundEvents = approvedToday + completedToday;
    // Cap at 20 points; each event gives 4 points (5 events = max)
    const turnaroundScore = Math.min(20, turnaroundEvents * 4);

    // 3. Agent utilization: agents with active tasks / total agents * 20
    const agentMap = new Map();
    tasks.forEach((t) => {
      const agentId = t.agent || t.agent_id || t.agentId || t.assignee;
      if (agentId) {
        if (!agentMap.has(agentId)) {
          agentMap.set(agentId, { total: 0, active: 0 });
        }
        agentMap.get(agentId).total += 1;
        const s = normalize(t.status);
        const isActive =
          s === 'in_progress' ||
          s === 'active' ||
          s === 'assigned' ||
          s === 'review' ||
          s === 'in_review';
        if (isActive) {
          agentMap.get(agentId).active += 1;
        }
      }
    });
    const totalAgents = agentMap.size;
    const activeAgents = Array.from(agentMap.values()).filter(
      (a) => a.active > 0
    ).length;
    const utilizationScore =
      totalAgents > 0 ? Math.round((activeAgents / totalAgents) * 20) : 0;

    // 4. Activity velocity: events in last 4h vs avg over last 24h * 20
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentEvents = activity.filter((ev) => {
      const evDate = new Date(ev.timestamp || ev.created_at || ev.date || 0);
      return evDate >= fourHoursAgo;
    }).length;

    const dayEvents = activity.filter((ev) => {
      const evDate = new Date(ev.timestamp || ev.created_at || ev.date || 0);
      return evDate >= twentyFourHoursAgo;
    }).length;

    // Average events per 4-hour window over 24 hours (6 windows)
    const avgPerWindow = dayEvents / 6;
    let velocityRatio = avgPerWindow > 0 ? recentEvents / avgPerWindow : 0;
    // Clamp ratio to [0, 2] then scale to 20 points
    velocityRatio = Math.min(2, Math.max(0, velocityRatio));
    const velocityScore = Math.round((velocityRatio / 2) * 20);

    const total = completionScore + turnaroundScore + utilizationScore + velocityScore;

    return {
      completion: completionScore,
      turnaround: turnaroundScore,
      utilization: utilizationScore,
      velocity: velocityScore,
      total: Math.min(100, total),
    };
  }, [tasks, activity]);

  // Trigger animation on mount and on score changes
  useEffect(() => {
    setAnimated(false);
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimated(true);
      });
    });
    prevScoreRef.current = breakdown.total;
    return () => cancelAnimationFrame(raf);
  }, [breakdown.total]);

  const score = breakdown.total;
  const radius = 19;
  const circumference = 2 * Math.PI * radius;
  const progress = animated ? (score / 100) * circumference : 0;
  const dashOffset = circumference - progress;

  const strokeColor =
    score <= 40
      ? '#ef4444'
      : score <= 70
        ? '#eab308'
        : '#22c55e';

  const tooltipRows = [
    { label: 'Completion', value: breakdown.completion, max: 40 },
    { label: 'Turnaround', value: breakdown.turnaround, max: 20 },
    { label: 'Utilization', value: breakdown.utilization, max: 20 },
    { label: 'Velocity', value: breakdown.velocity, max: 20 },
  ];

  return (
    <div
      className="relative flex flex-col items-center"
      style={{ width: 64 }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* SVG Ring */}
      <div className="relative" style={{ width: 48, height: 48 }}>
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          className="block"
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Background track */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="4"
          />
          {/* Progress arc */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s ease',
            }}
          />
        </svg>
        {/* Score number centered */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          <span
            className="font-bold text-white tabular-nums"
            style={{ fontSize: 14, lineHeight: 1 }}
          >
            {score}
          </span>
        </div>
      </div>

      {/* Label */}
      <span
        className="text-gray-500 uppercase tracking-wider mt-1"
        style={{ fontSize: 8, lineHeight: 1 }}
      >
        Productivity
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute z-50 rounded-lg border shadow-xl pointer-events-none"
          style={{
            top: -8,
            left: '50%',
            transform: 'translate(-50%, -100%)',
            backgroundColor: '#12121a',
            borderColor: '#252540',
            padding: '8px 10px',
            minWidth: 160,
          }}
        >
          <div
            className="font-semibold text-white mb-1.5"
            style={{ fontSize: 11 }}
          >
            Score Breakdown
          </div>
          {tooltipRows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3"
              style={{ fontSize: 10, lineHeight: '18px' }}
            >
              <span className="text-gray-400">{row.label}</span>
              <div className="flex items-center gap-1.5">
                {/* Mini bar */}
                <div
                  className="rounded-full overflow-hidden"
                  style={{
                    width: 40,
                    height: 3,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                  }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(row.value / row.max) * 100}%`,
                      backgroundColor: strokeColor,
                      transition: 'width 0.6s ease-out',
                    }}
                  />
                </div>
                <span className="text-white tabular-nums" style={{ fontSize: 10, minWidth: 28, textAlign: 'right' }}>
                  {row.value}/{row.max}
                </span>
              </div>
            </div>
          ))}
          <div
            className="flex items-center justify-between mt-1.5 pt-1.5"
            style={{
              fontSize: 10,
              borderTop: '1px solid #252540',
            }}
          >
            <span className="text-gray-400 font-medium">Total</span>
            <span
              className="font-bold tabular-nums"
              style={{ color: strokeColor, fontSize: 11 }}
            >
              {score}/100
            </span>
          </div>
          {/* Tooltip arrow */}
          <div
            className="absolute"
            style={{
              bottom: -4,
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: 8,
              height: 8,
              backgroundColor: '#12121a',
              borderRight: '1px solid #252540',
              borderBottom: '1px solid #252540',
            }}
          />
        </div>
      )}
    </div>
  );
}
