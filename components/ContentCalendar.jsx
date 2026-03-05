'use client'

import { useState, useMemo } from 'react'
import { AGENTS } from '../lib/agents'

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const CONTENT_TYPES = ['Ad Copy', 'Social Post', 'Video Script', 'Blog Post', 'Landing Page', 'Strategy', 'General']
const PRIORITIES = ['High', 'Medium', 'Low']

export default function ContentCalendar({ tasks, agents, onTaskClick, onRefresh }) {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [showScheduleModal, setShowScheduleModal] = useState(null) // date string or null
  const [scheduling, setScheduling] = useState(false)
  const [newTask, setNewTask] = useState({
    name: '', description: '', agent: '', contentType: 'General', priority: 'Medium',
  })

  // Extract scheduled date from description metadata (fallback when Airtable field missing)
  function extractScheduledDate(task) {
    if (task.scheduledDate) return task.scheduledDate
    // Look for "Scheduled: YYYY-MM-DD" in description metadata
    const match = task.description?.match(/Scheduled:\s*(\d{4}-\d{2}-\d{2})/)
    if (match) return match[1]
    return null
  }

  // Map tasks to calendar dates — prefer scheduledDate, then description metadata, then createdAt
  const tasksByDate = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      const dateStr = extractScheduledDate(task) || task.createdAt
      if (!dateStr) return
      const date = new Date(dateStr)
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      if (!map[key]) map[key] = []
      map[key].push(task)
    })
    return map
  }, [tasks])

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const isToday = (day) => today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1) }
    else setCurrentMonth(currentMonth - 1)
  }

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1) }
    else setCurrentMonth(currentMonth + 1)
  }

  const getTasksForDay = (day) => {
    const key = `${currentYear}-${currentMonth}-${day}`
    return tasksByDate[key] || []
  }

  const getStatusDot = (status) => {
    switch (status) {
      case 'Done': return 'bg-accent-green'
      case 'Review': return 'bg-accent-orange'
      case 'In Progress': return 'bg-accent-blue'
      case 'Assigned': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  // Convert dateKey (YYYY-M-D) to ISO date string for Airtable
  function dateKeyToISO(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number)
    const date = new Date(y, m, d)
    return date.toISOString().split('T')[0] // YYYY-MM-DD
  }

  // Schedule a task on a specific date
  async function handleScheduleTask(e) {
    e.preventDefault()
    if (!newTask.name.trim()) return
    setScheduling(true)
    try {
      const scheduledDate = showScheduleModal ? dateKeyToISO(showScheduleModal) : undefined
      const res = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTask.name,
          description: newTask.description,
          agent: newTask.agent || undefined,
          contentType: newTask.contentType,
          priority: newTask.priority,
          status: newTask.agent ? 'Assigned' : 'Inbox',
          scheduledDate,
        }),
      })
      if (res.ok) {
        setShowScheduleModal(null)
        setNewTask({ name: '', description: '', agent: '', contentType: 'General', priority: 'Medium' })
        if (onRefresh) onRefresh()
      }
    } catch (err) {
      console.error('Failed to schedule task:', err)
    }
    setScheduling(false)
  }

  // Stats for the month
  const monthStats = useMemo(() => {
    let total = 0, done = 0, review = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const dayTasks = getTasksForDay(d)
      total += dayTasks.length
      done += dayTasks.filter(t => t.status === 'Done').length
      review += dayTasks.filter(t => t.status === 'Review').length
    }
    return { total, done, review }
  }, [currentMonth, currentYear, tasksByDate, daysInMonth])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between shrink-0 bg-dark-800/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="text-gray-500 hover:text-gray-200 transition-colors p-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <h2 className="text-sm font-bold text-gray-200 w-40 text-center">{MONTHS[currentMonth]} {currentYear}</h2>
            <button onClick={nextMonth} className="text-gray-500 hover:text-gray-200 transition-colors p-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
          <button onClick={() => { setCurrentMonth(today.getMonth()); setCurrentYear(today.getFullYear()) }}
            className="text-[10px] px-2 py-1 bg-dark-600 text-gray-400 rounded hover:text-gray-200 transition-colors">
            Today
          </button>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="text-gray-500">{monthStats.total} tasks</span>
          <span className="text-green-400">{monthStats.done} done</span>
          <span className="text-orange-400">{monthStats.review} review</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-dark-500">
          {DAYS.map(day => (
            <div key={day} className="px-2 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-dark-800/30">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 flex-1">
          {Array.from({ length: firstDay }, (_, i) => (
            <div key={`empty-${i}`} className="border-b border-r border-dark-500/50 bg-dark-900/30 min-h-[100px]" />
          ))}

          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const dayTasks = getTasksForDay(day)
            const isTodayCell = isToday(day)
            const dateKey = `${currentYear}-${currentMonth}-${day}`

            return (
              <div key={day} className={`border-b border-r border-dark-500/50 min-h-[100px] p-1.5 group relative ${
                isTodayCell ? 'bg-accent-orange/5' : 'hover:bg-dark-700/50'
              } transition-colors`}>
                <div className="flex items-center justify-between mb-1">
                  <div className={`text-[11px] font-semibold ${
                    isTodayCell ? 'text-accent-orange' : 'text-gray-400'
                  }`}>
                    {isTodayCell ? (
                      <span className="bg-accent-orange text-dark-900 px-1.5 py-0.5 rounded-full text-[10px]">{day}</span>
                    ) : day}
                  </div>
                  {/* Schedule button — appears on hover */}
                  <button
                    onClick={() => setShowScheduleModal(dateKey)}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-accent-orange transition-all p-0.5"
                    title="Schedule task"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                </div>

                {/* Task dots */}
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 4).map(task => {
                    const agent = agents.find(a => a.name === task.agent)
                    return (
                      <button key={task.id} onClick={() => onTaskClick(task)}
                        className="w-full text-left flex items-center gap-1 px-1 py-0.5 rounded hover:bg-dark-600 transition-colors group/task">
                        {agent ? (
                          <span className="text-[9px] shrink-0">{agent.emoji}</span>
                        ) : (
                          <div className={`w-1.5 h-1.5 rounded-full ${getStatusDot(task.status)} shrink-0`} />
                        )}
                        <span className="text-[9px] text-gray-400 truncate group-hover/task:text-gray-200">{task.name}</span>
                      </button>
                    )
                  })}
                  {dayTasks.length > 4 && (
                    <span className="text-[9px] text-gray-600 px-1">+{dayTasks.length - 4} more</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Schedule Task Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowScheduleModal(null)}>
          <div className="bg-dark-800 border border-dark-500 rounded-xl w-[480px] max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-dark-500 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-200">Schedule Agent Task</h3>
                {showScheduleModal && (
                  <p className="text-[10px] text-accent-orange mt-0.5">
                    {(() => { const [y,m,d] = showScheduleModal.split('-').map(Number); return new Date(y,m,d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) })()}
                  </p>
                )}
              </div>
              <button onClick={() => setShowScheduleModal(null)} className="text-gray-500 hover:text-gray-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleScheduleTask} className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Task Name *</label>
                <input
                  type="text"
                  value={newTask.name}
                  onChange={e => setNewTask(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Write Valentine's Day ad copy..."
                  className="w-full bg-dark-600 border border-dark-400 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-accent-orange focus:outline-none"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Description</label>
                <textarea
                  value={newTask.description}
                  onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                  placeholder="Brief for the agent..."
                  rows={3}
                  className="w-full bg-dark-600 border border-dark-400 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-accent-orange focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Assign Agent</label>
                  <select
                    value={newTask.agent}
                    onChange={e => setNewTask(p => ({ ...p, agent: e.target.value }))}
                    className="w-full bg-dark-600 border border-dark-400 rounded-lg px-2 py-2 text-sm text-gray-200 focus:border-accent-orange focus:outline-none"
                  >
                    <option value="">Auto-assign</option>
                    {(agents.length > 0 ? agents : AGENTS).map(a => (
                      <option key={a.id || a.name} value={a.name}>{a.emoji} {a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Content Type</label>
                  <select
                    value={newTask.contentType}
                    onChange={e => setNewTask(p => ({ ...p, contentType: e.target.value }))}
                    className="w-full bg-dark-600 border border-dark-400 rounded-lg px-2 py-2 text-sm text-gray-200 focus:border-accent-orange focus:outline-none"
                  >
                    {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))}
                    className="w-full bg-dark-600 border border-dark-400 rounded-lg px-2 py-2 text-sm text-gray-200 focus:border-accent-orange focus:outline-none"
                  >
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Agent preview */}
              {newTask.agent && (() => {
                const selectedAgent = (agents.length > 0 ? agents : AGENTS).find(a => a.name === newTask.agent)
                if (!selectedAgent) return null
                return (
                  <div className="bg-dark-600 rounded-lg p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                      style={{ backgroundColor: `${selectedAgent.color}15`, border: `1.5px solid ${selectedAgent.color}` }}>
                      {selectedAgent.emoji}
                    </div>
                    <div>
                      <div className="text-xs font-semibold" style={{ color: selectedAgent.color }}>{selectedAgent.name}</div>
                      <div className="text-[10px] text-gray-500">{selectedAgent.role}</div>
                    </div>
                    <div className="ml-auto text-[9px] text-gray-600 bg-dark-500 px-2 py-0.5 rounded">
                      Will be assigned immediately
                    </div>
                  </div>
                )
              })()}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={scheduling || !newTask.name.trim()}
                  className="flex-1 bg-accent-orange text-dark-900 font-semibold text-sm py-2.5 rounded-lg hover:bg-accent-orange/90 transition-colors disabled:opacity-50"
                >
                  {scheduling ? 'Scheduling...' : 'Schedule Task'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(null)}
                  className="px-4 py-2.5 bg-dark-600 text-gray-400 text-sm rounded-lg hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
