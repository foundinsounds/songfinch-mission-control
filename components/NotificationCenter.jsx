'use client'

import { useState, useRef, useEffect, useMemo } from 'react'

const NOTIFICATION_TYPES = {
  task_complete: { icon: '✅', color: 'text-accent-green', bg: 'bg-green-500/10' },
  task_failed: { icon: '❌', color: 'text-accent-red', bg: 'bg-red-500/10' },
  task_review: { icon: '👁', color: 'text-accent-orange', bg: 'bg-orange-500/10' },
  agent_error: { icon: '⚠️', color: 'text-accent-red', bg: 'bg-red-500/10' },
  agent_idle: { icon: '💤', color: 'text-gray-500', bg: 'bg-gray-500/10' },
  content_ready: { icon: '📄', color: 'text-accent-blue', bg: 'bg-blue-500/10' },
  campaign_planned: { icon: '📅', color: 'text-accent-purple', bg: 'bg-purple-500/10' },
  system: { icon: '🔔', color: 'text-gray-400', bg: 'bg-gray-500/10' },
  sync: { icon: '🔄', color: 'text-accent-teal', bg: 'bg-teal-500/10' },
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const secs = Math.floor(diff / 1000)
  const mins = Math.floor(secs / 60)
  const hrs = Math.floor(mins / 60)

  if (secs < 60) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function generateNotifications(tasks, activity) {
  const notifications = []

  // Recent completed tasks
  tasks
    .filter(t => t.status === 'Done')
    .slice(0, 3)
    .forEach(t => {
      notifications.push({
        id: `done-${t.id}`,
        type: 'task_complete',
        title: 'Task Completed',
        message: `"${t.name}" completed by ${t.agent || 'system'}`,
        timestamp: t.updatedAt || t.createdAt,
        read: true,
      })
    })

  // Tasks in review
  tasks
    .filter(t => t.status === 'Review')
    .slice(0, 5)
    .forEach(t => {
      notifications.push({
        id: `review-${t.id}`,
        type: 'task_review',
        title: 'Awaiting Review',
        message: `"${t.name}" needs your approval`,
        timestamp: t.updatedAt || t.createdAt,
        read: false,
      })
    })

  // Failed tasks
  tasks
    .filter(t => t.status === 'Error' || t.status === 'Failed')
    .slice(0, 3)
    .forEach(t => {
      notifications.push({
        id: `fail-${t.id}`,
        type: 'task_failed',
        title: 'Task Failed',
        message: `"${t.name}" encountered an error`,
        timestamp: t.updatedAt || t.createdAt,
        read: false,
      })
    })

  // Recent activity items
  activity
    .slice(0, 5)
    .forEach(a => {
      const type = a.type === 'error' ? 'agent_error' : a.type === 'content' ? 'content_ready' : 'system'
      notifications.push({
        id: `act-${a.id || Math.random().toString(36).slice(2)}`,
        type,
        title: a.agent ? `${a.agent}` : 'System',
        message: a.message || 'Activity logged',
        timestamp: a.timestamp,
        read: true,
      })
    })

  // Sort by timestamp (newest first)
  notifications.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))

  return notifications.slice(0, 20)
}

export default function NotificationCenter({ tasks = [], activity = [] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [filter, setFilter] = useState('all') // all, unread, errors
  const dropdownRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const notifications = useMemo(() => generateNotifications(tasks, activity), [tasks, activity])
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications])

  const filtered = useMemo(() => {
    switch (filter) {
      case 'unread': return notifications.filter(n => !n.read)
      case 'errors': return notifications.filter(n => n.type === 'task_failed' || n.type === 'agent_error')
      default: return notifications
    }
  }, [notifications, filter])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="header-btn p-1.5 rounded transition-all relative"
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center badge-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-dark-700 border border-dark-500 rounded-lg shadow-2xl z-50 w-[340px] max-h-[480px] flex flex-col animate-slide-down">
            {/* Header */}
            <div className="px-3 py-2.5 border-b border-dark-500 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-full font-bold">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {['all', 'unread', 'errors'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`text-[9px] px-2 py-0.5 rounded-full transition-colors capitalize ${
                      filter === f
                        ? 'bg-accent-orange/15 text-accent-orange font-semibold'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <div className="p-6 text-center">
                  <span className="text-2xl">🔔</span>
                  <p className="text-[11px] text-gray-500 mt-2">No notifications</p>
                </div>
              ) : (
                filtered.map(notif => {
                  const config = NOTIFICATION_TYPES[notif.type] || NOTIFICATION_TYPES.system
                  return (
                    <div
                      key={notif.id}
                      className={`px-3 py-2.5 border-b border-dark-500/50 hover:bg-dark-600 transition-colors cursor-pointer flex items-start gap-2.5 ${
                        !notif.read ? 'bg-dark-600/30' : ''
                      }`}
                    >
                      {/* Icon */}
                      <div className={`w-7 h-7 rounded-full ${config.bg} flex items-center justify-center shrink-0 text-xs mt-0.5`}>
                        {config.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[11px] font-semibold ${config.color}`}>{notif.title}</span>
                          <span className="text-[9px] text-gray-600 shrink-0">
                            {notif.timestamp ? timeAgo(notif.timestamp) : ''}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 leading-relaxed mt-0.5 line-clamp-2">{notif.message}</p>
                      </div>

                      {/* Unread dot */}
                      {!notif.read && (
                        <div className="w-2 h-2 rounded-full bg-accent-orange shrink-0 mt-2" />
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-dark-500 flex items-center justify-between">
              <span className="text-[9px] text-gray-600">{filtered.length} notifications</span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[10px] text-accent-orange hover:text-accent-orange/80 font-medium transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
