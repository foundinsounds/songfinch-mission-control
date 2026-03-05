'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const AGENT_COLORS = {
  CMO: '#f97316',
  CHIEF: '#6366f1',
  MUSE: '#a855f7',
  HOOK: '#ec4899',
  PULSE: '#14b8a6',
  LENS: '#eab308',
  STORY: '#3b82f6',
  SCOUT: '#22c55e',
  FLOW: '#06b6d4',
  PIXEL: '#f43f5e',
};

const TIME_RANGES = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
];

const DEFAULT_RANGE_HOURS = 24;

function getAgentColor(agentName) {
  return AGENT_COLORS[agentName] || '#6b7280';
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatHourGroup(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  const hourStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  if (isToday) return `Today ${hourStr}`;
  if (isYesterday) return `Yesterday ${hourStr}`;
  return `${formatDate(timestamp)} ${hourStr}`;
}

function getHourKey(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
}

function relativeTime(timestamp) {
  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function groupByHour(items) {
  const groups = {};
  const order = [];

  for (const item of items) {
    const key = getHourKey(item.timestamp);
    if (!groups[key]) {
      groups[key] = {
        key,
        label: formatHourGroup(item.timestamp),
        timestamp: item.timestamp,
        items: [],
      };
      order.push(key);
    }
    groups[key].items.push(item);
  }

  return order.map((key) => groups[key]);
}

export default function AgentTimeline({ activity = [], agents = [], onClose }) {
  const [selectedRange, setSelectedRange] = useState(DEFAULT_RANGE_HOURS);
  const [excludedAgents, setExcludedAgents] = useState(new Set());
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const scrollRef = useRef(null);
  const backdropRef = useRef(null);

  // Entrance animation
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIsVisible(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        handleClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-scroll to bottom on mount and when filter changes
  useEffect(() => {
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [selectedRange, excludedAgents]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose?.();
    }, 200);
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === backdropRef.current) {
        handleClose();
      }
    },
    [handleClose]
  );

  const toggleAgent = useCallback((agentName) => {
    setExcludedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentName)) {
        next.delete(agentName);
      } else {
        next.add(agentName);
      }
      return next;
    });
  }, []);

  // Derive the list of known agents from the agents prop, falling back to activity data
  const agentList = useMemo(() => {
    if (agents.length > 0) return agents;
    const seen = new Set();
    return activity.reduce((acc, item) => {
      if (!seen.has(item.agent)) {
        seen.add(item.agent);
        acc.push({
          name: item.agent,
          color: getAgentColor(item.agent),
          emoji: '',
          role: '',
          status: 'active',
        });
      }
      return acc;
    }, []);
  }, [agents, activity]);

  // Filter activity by time range and excluded agents
  const filteredActivity = useMemo(() => {
    const cutoff = Date.now() - selectedRange * 60 * 60 * 1000;
    return activity
      .filter((item) => {
        const ts = new Date(item.timestamp).getTime();
        if (ts < cutoff) return false;
        if (excludedAgents.has(item.agent)) return false;
        return true;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [activity, selectedRange, excludedAgents]);

  const hourGroups = useMemo(() => groupByHour(filteredActivity), [filteredActivity]);

  const totalCount = filteredActivity.length;

  // Compute animation classes
  const panelTransform = isVisible && !isClosing
    ? 'translate-y-0 opacity-100'
    : 'translate-y-8 opacity-0';

  const backdropOpacity = isVisible && !isClosing ? 'opacity-100' : 'opacity-0';

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center transition-opacity duration-200 ${backdropOpacity}`}
    >
      <div
        className={`w-full max-w-2xl max-h-[85vh] bg-dark-700 border border-dark-500 rounded-t-xl flex flex-col transition-all duration-300 ease-out ${panelTransform}`}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-dark-500">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent-orange animate-pulse" />
              <h2 className="text-gray-100 text-sm font-semibold tracking-wide">
                Agent Timeline
              </h2>
              <span className="text-[10px] text-gray-500 font-mono ml-1">
                {totalCount} event{totalCount !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded hover:bg-dark-600"
              aria-label="Close timeline"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {/* Time range selector */}
          <div className="flex items-center gap-1 mb-3">
            <span className="text-[10px] text-gray-500 mr-1 uppercase tracking-wider">
              Range
            </span>
            {TIME_RANGES.map((range) => (
              <button
                key={range.label}
                onClick={() => setSelectedRange(range.hours)}
                className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all duration-150 ${
                  selectedRange === range.hours
                    ? 'bg-accent-orange/20 text-accent-orange border border-accent-orange/40'
                    : 'text-gray-500 hover:text-gray-300 border border-transparent hover:border-dark-500'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* Agent filter toggles */}
          <div className="flex flex-wrap gap-1.5">
            {agentList.map((agent) => {
              const color = agent.color || getAgentColor(agent.name);
              const isExcluded = excludedAgents.has(agent.name);
              return (
                <button
                  key={agent.name}
                  onClick={() => toggleAgent(agent.name)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-150 border ${
                    isExcluded
                      ? 'border-dark-500 text-gray-600 bg-dark-600/50'
                      : 'border-transparent'
                  }`}
                  style={
                    isExcluded
                      ? {}
                      : {
                          backgroundColor: `${color}18`,
                          color: color,
                          borderColor: `${color}40`,
                        }
                  }
                  title={isExcluded ? `Show ${agent.name}` : `Hide ${agent.name}`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: isExcluded ? '#4b5563' : color,
                    }}
                  />
                  {agent.emoji ? `${agent.emoji} ` : ''}
                  {agent.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Timeline body */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 custom-scrollbar"
        >
          {hourGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="mb-3 text-gray-600"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <p className="text-[11px]">No activity in this time range</p>
              <p className="text-[10px] text-gray-600 mt-1">
                Try expanding the range or adjusting agent filters
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-[54px] top-0 bottom-0 w-px bg-dark-500" />

              {hourGroups.map((group, gi) => (
                <div key={group.key} className="mb-4 last:mb-0">
                  {/* Hour group separator */}
                  <div className="flex items-center gap-2 mb-2 relative">
                    <span className="text-[10px] font-mono text-gray-500 w-[50px] text-right flex-shrink-0">
                      {group.label.split(' ').slice(-1)[0]}
                    </span>
                    <div className="w-2 h-2 rounded-full bg-dark-500 border-2 border-dark-600 relative z-10 flex-shrink-0" />
                    <span className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">
                      {group.label.split(' ').slice(0, -1).join(' ')}
                    </span>
                    <div className="flex-1 h-px bg-dark-500/50" />
                  </div>

                  {/* Events in this hour */}
                  {group.items.map((item, ei) => {
                    const color = getAgentColor(item.agent);
                    return (
                      <div
                        key={item.id || `${gi}-${ei}`}
                        className="flex items-start gap-2 mb-2 last:mb-0 group relative"
                      >
                        {/* Timestamp column */}
                        <span className="text-[10px] font-mono text-gray-600 w-[50px] text-right flex-shrink-0 pt-0.5 group-hover:text-gray-400 transition-colors">
                          {formatTime(item.timestamp)}
                        </span>

                        {/* Dot on timeline */}
                        <div className="flex-shrink-0 relative z-10 pt-1">
                          <div
                            className="w-2.5 h-2.5 rounded-full border-2 transition-transform duration-150 group-hover:scale-125"
                            style={{
                              backgroundColor: color,
                              borderColor: `${color}60`,
                              boxShadow: `0 0 6px ${color}30`,
                            }}
                          />
                        </div>

                        {/* Event card */}
                        <div className="flex-1 min-w-0 bg-dark-600/50 rounded-lg px-3 py-2 border border-dark-500/50 hover:border-dark-500 transition-colors group-hover:bg-dark-600/80">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider"
                              style={{ color }}
                            >
                              {item.agent}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {item.action}
                            </span>
                            {item.type && (
                              <span className="ml-auto text-[9px] text-gray-600 bg-dark-700/80 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                                {item.type}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-gray-300 leading-relaxed truncate">
                              {item.description}
                            </p>
                          )}
                          <span className="text-[9px] text-gray-600 font-mono mt-1 block">
                            {relativeTime(item.timestamp)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* "Now" marker at bottom */}
              <div className="flex items-center gap-2 mt-3 relative">
                <span className="text-[10px] font-mono text-accent-orange w-[50px] text-right flex-shrink-0">
                  {formatTime(new Date().toISOString())}
                </span>
                <div className="w-2.5 h-2.5 rounded-full bg-accent-orange relative z-10 flex-shrink-0 animate-pulse" />
                <span className="text-[10px] text-accent-orange uppercase tracking-wider font-medium">
                  Now
                </span>
                <div className="flex-1 h-px bg-accent-orange/30" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-2 border-t border-dark-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-600 font-mono">
              {excludedAgents.size > 0 && (
                <>
                  {agentList.length - excludedAgents.size}/{agentList.length} agents
                </>
              )}
              {excludedAgents.size === 0 && (
                <>All agents</>
              )}
            </span>
            {excludedAgents.size > 0 && (
              <button
                onClick={() => setExcludedAgents(new Set())}
                className="text-[10px] text-accent-orange hover:text-accent-orange/80 transition-colors"
              >
                Reset filters
              </button>
            )}
          </div>
          <span className="text-[10px] text-gray-600 font-mono">
            Last {TIME_RANGES.find((r) => r.hours === selectedRange)?.label || '24h'}
          </span>
        </div>
      </div>
    </div>
  );
}
