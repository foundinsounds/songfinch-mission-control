'use client'

import { useState, useMemo } from 'react'

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function ContentCalendar({ tasks, agents, onTaskClick }) {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())

  // Map tasks to calendar dates based on creation date
  const tasksByDate = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      if (!task.createdAt) return
      const date = new Date(task.createdAt)
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
          {/* Empty cells before first day */}
          {Array.from({ length: firstDay }, (_, i) => (
            <div key={`empty-${i}`} className="border-b border-r border-dark-500/50 bg-dark-900/30 min-h-[100px]" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const dayTasks = getTasksForDay(day)
            const isTodayCell = isToday(day)

            return (
              <div key={day} className={`border-b border-r border-dark-500/50 min-h-[100px] p-1.5 ${
                isTodayCell ? 'bg-accent-orange/5' : 'hover:bg-dark-700/50'
              } transition-colors`}>
                <div className={`text-[11px] font-semibold mb-1 ${
                  isTodayCell ? 'text-accent-orange' : 'text-gray-400'
                }`}>
                  {isTodayCell ? (
                    <span className="bg-accent-orange text-dark-900 px-1.5 py-0.5 rounded-full text-[10px]">{day}</span>
                  ) : day}
                </div>

                {/* Task dots */}
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 4).map(task => {
                    const agent = agents.find(a => a.name === task.agent)
                    return (
                      <button key={task.id} onClick={() => onTaskClick(task)}
                        className="w-full text-left flex items-center gap-1 px-1 py-0.5 rounded hover:bg-dark-600 transition-colors group">
                        <div className={`w-1.5 h-1.5 rounded-full ${getStatusDot(task.status)} shrink-0`} />
                        <span className="text-[9px] text-gray-400 truncate group-hover:text-gray-200">{task.name}</span>
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
    </div>
  )
}
