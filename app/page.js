'use client'

import { useState, useEffect, useCallback } from 'react'
import { AGENTS as FALLBACK_AGENTS } from '../lib/agents'
import { MOCK_TASKS, MOCK_ACTIVITY } from '../lib/mockData'
import AgentSidebar from '../components/AgentSidebar'
import KanbanBoard from '../components/KanbanBoard'
import LiveFeed from '../components/LiveFeed'
import StatsHeader from '../components/StatsHeader'
import TaskModal from '../components/TaskModal'

export default function MissionControl() {
  const [agents, setAgents] = useState(FALLBACK_AGENTS)
  const [tasks, setTasks] = useState(MOCK_TASKS)
  const [activity, setActivity] = useState(MOCK_ACTIVITY)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [selectedTask, setSelectedTask] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [feedFilter, setFeedFilter] = useState('All')
  const [dataSource, setDataSource] = useState('loading') // 'airtable' | 'mock' | 'loading'
  const [lastSync, setLastSync] = useState(null)

  // Fetch live data from Airtable
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/data')
      if (!res.ok) throw new Error('API error')
      const data = await res.json()

      if (data.agents && data.agents.length > 0) {
        setAgents(data.agents)
      }
      if (data.tasks && data.tasks.length > 0) {
        setTasks(data.tasks)
      }
      if (data.activity && data.activity.length > 0) {
        setActivity(data.activity)
      }

      setDataSource('airtable')
      setLastSync(new Date())
    } catch (err) {
      console.warn('Airtable fetch failed, using mock data:', err.message)
      setDataSource('mock')
    }
  }, [])

  // Initial fetch + polling every 15 seconds
  useEffect(() => {
    fetchData()
    const poller = setInterval(fetchData, 15000)
    return () => clearInterval(poller)
  }, [fetchData])

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const filteredTasks = selectedAgent
    ? tasks.filter(t => t.agent === selectedAgent)
    : tasks

  const stats = {
    agentsActive: agents.filter(a => a.status === 'Working' || a.status === 'Active').length,
    totalAgents: agents.length,
    tasksInQueue: tasks.filter(t => t.status !== 'Done').length,
    tasksTotal: tasks.length,
    inReview: tasks.filter(t => t.status === 'Review').length,
    completed: tasks.filter(t => t.status === 'Done').length,
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top Header Bar */}
      <StatsHeader
        stats={stats}
        currentTime={currentTime}
        dataSource={dataSource}
        lastSync={lastSync}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Agent Sidebar */}
        <AgentSidebar
          agents={agents}
          selectedAgent={selectedAgent}
          onSelectAgent={(name) => setSelectedAgent(selectedAgent === name ? null : name)}
          tasks={tasks}
        />

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto">
          <KanbanBoard
            tasks={filteredTasks}
            onTaskClick={setSelectedTask}
          />
        </div>

        {/* Live Feed */}
        <LiveFeed
          activity={activity}
          filter={feedFilter}
          onFilterChange={setFeedFilter}
        />
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          agent={agents.find(a => a.name === selectedTask.agent)}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}
