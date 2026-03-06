'use client'

import { memo } from 'react'

/**
 * Breadcrumb — Contextual navigation trail for the Roundtable SPA.
 *
 * Builds a crumb chain from current app state:
 *   Dashboard  ›  [View Name]  ›  [Agent Filter]  ›  [Selected Task]
 *
 * Each segment is clickable to navigate back to that level.
 * Uses WAI-ARIA breadcrumb pattern for accessibility.
 *
 * Props:
 *   currentView     — Active view key (e.g. 'kanban', 'analytics')
 *   selectedAgent   — Currently filtered agent name, or null
 *   selectedTask    — Currently open task object, or null
 *   onNavigate      — Callback: ({ view, agent, task }) => void
 */

const VIEW_LABELS = {
  kanban: 'Board',
  list: 'List',
  inbox: 'Inbox',
  approvals: 'Approvals',
  calendar: 'Calendar',
  campaigns: 'Campaigns',
  analytics: 'Analytics',
  agents: 'Agent Activity',
  content: 'Content Library',
  templates: 'Templates',
  abtests: 'A/B Tests',
  scoring: 'Scoring',
  skills: 'Skills',
  batch: 'Batch Ops',
  intelligence: 'Intelligence',
  workload: 'Workload',
  webhooks: 'Webhooks',
}

const VIEW_ICONS = {
  kanban: '📋',
  list: '📝',
  inbox: '📥',
  approvals: '✅',
  calendar: '📅',
  campaigns: '📊',
  analytics: '📈',
  agents: '🤖',
  content: '🎨',
  templates: '📄',
  abtests: '🧪',
  scoring: '🏆',
  skills: '⚡',
  batch: '⚙️',
  intelligence: '🧠',
  workload: '📦',
  webhooks: '🔗',
}

function ChevronSeparator() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-dark-400 shrink-0 mx-0.5"
      aria-hidden="true"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}

const Breadcrumb = memo(function Breadcrumb({
  currentView = 'kanban',
  selectedAgent = null,
  selectedTask = null,
  onNavigate,
}) {
  // Build the crumb chain
  const crumbs = []

  // 1. Root — always present
  crumbs.push({
    key: 'root',
    label: 'Roundtable',
    icon: '⚡',
    onClick: () => onNavigate?.({ view: 'kanban', agent: null, task: null }),
  })

  // 2. Current view
  crumbs.push({
    key: 'view',
    label: VIEW_LABELS[currentView] || currentView,
    icon: VIEW_ICONS[currentView] || '📋',
    onClick: () => onNavigate?.({ view: currentView, agent: null, task: null }),
  })

  // 3. Agent filter (if active)
  if (selectedAgent) {
    crumbs.push({
      key: 'agent',
      label: selectedAgent,
      icon: '🤖',
      onClick: () => onNavigate?.({ view: currentView, agent: selectedAgent, task: null }),
    })
  }

  // 4. Selected task (if viewing detail)
  if (selectedTask) {
    const taskLabel = selectedTask.title
      ? selectedTask.title.length > 32
        ? selectedTask.title.slice(0, 30) + '…'
        : selectedTask.title
      : selectedTask.name
        ? selectedTask.name.length > 32
          ? selectedTask.name.slice(0, 30) + '…'
          : selectedTask.name
        : 'Task'

    crumbs.push({
      key: 'task',
      label: taskLabel,
      icon: '📌',
      isCurrent: true,
    })
  } else {
    // Mark the last crumb as current
    crumbs[crumbs.length - 1].isCurrent = true
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="px-3 sm:px-4 py-1.5 flex items-center gap-0 overflow-x-auto scrollbar-hide shrink-0 bg-dark-800/20 border-b border-dark-600/30"
    >
      <ol className="flex items-center gap-0 list-none m-0 p-0">
        {crumbs.map((crumb, i) => (
          <li key={crumb.key} className="flex items-center gap-0">
            {i > 0 && <ChevronSeparator />}

            {crumb.isCurrent ? (
              <span
                className="text-[11px] text-gray-300 font-medium px-1.5 py-0.5 rounded flex items-center gap-1 whitespace-nowrap"
                aria-current="page"
              >
                <span className="text-[10px] leading-none">{crumb.icon}</span>
                {crumb.label}
              </span>
            ) : (
              <button
                onClick={crumb.onClick}
                className="text-[11px] text-gray-500 hover:text-gray-300 hover:bg-dark-600/50 px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 whitespace-nowrap"
              >
                <span className="text-[10px] leading-none">{crumb.icon}</span>
                {crumb.label}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
})

export default Breadcrumb
