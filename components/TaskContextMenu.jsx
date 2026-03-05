'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const STATUSES = [
  { value: 'Inbox', label: 'Inbox' },
  { value: 'Assigned', label: 'Assigned' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Review', label: 'Review' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Done', label: 'Done' },
]

const PRIORITIES = [
  { value: 'High', label: 'High', color: 'bg-accent-red' },
  { value: 'Medium', label: 'Medium', color: 'bg-accent-yellow' },
  { value: 'Low', label: 'Low', color: 'bg-accent-green' },
]

// Inline SVG icons (12x12)
function StatusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function PriorityIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  )
}

function AgentIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function IdIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M7 15h4M15 15h2M7 11h2M13 11h4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export default function TaskContextMenu({
  x,
  y,
  task,
  onClose,
  onUpdateStatus,
  onAssignAgent,
  onChangePriority,
  agents = [],
}) {
  const menuRef = useRef(null)
  const [openSub, setOpenSub] = useState(null) // 'status' | 'priority' | 'agent' | null
  const [copiedField, setCopiedField] = useState(null) // 'name' | 'id' | null
  const [menuPos, setMenuPos] = useState({ left: x, top: y })
  const [visible, setVisible] = useState(false)

  // Smart positioning: flip if overflowing viewport
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = x
    let top = y

    if (x + rect.width > vw - 8) {
      left = x - rect.width
    }
    if (y + rect.height > vh - 8) {
      top = y - rect.height
    }
    // Clamp to viewport
    left = Math.max(8, left)
    top = Math.max(8, top)

    setMenuPos({ left, top })
    // Trigger entrance animation after positioning
    requestAnimationFrame(() => setVisible(true))
  }, [x, y])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Close on scroll
  useEffect(() => {
    function handleScroll() {
      onClose()
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [onClose])

  const handleCopy = useCallback(async (text, field) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopiedField(field)
    setTimeout(() => {
      setCopiedField(null)
      onClose()
    }, 800)
  }, [onClose])

  const handleStatusChange = useCallback((status) => {
    onUpdateStatus(task.id, status)
    onClose()
  }, [task, onUpdateStatus, onClose])

  const handlePriorityChange = useCallback((priority) => {
    onChangePriority(task.id, priority)
    onClose()
  }, [task, onChangePriority, onClose])

  const handleAgentAssign = useCallback((agentName) => {
    onAssignAgent(task.id, agentName)
    onClose()
  }, [task, onAssignAgent, onClose])

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] select-none"
      style={{
        left: menuPos.left,
        top: menuPos.top,
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.95)',
        transformOrigin: 'top left',
        transition: 'opacity 150ms ease-out, transform 150ms ease-out',
      }}
    >
      <div className="min-w-[180px] bg-dark-700/95 backdrop-blur-lg border border-dark-500 rounded-lg shadow-2xl shadow-black/50 overflow-hidden">
        {/* Status section */}
        <SectionHeader label="Status" />
        <div
          className="relative"
          onMouseEnter={() => setOpenSub('status')}
          onMouseLeave={() => setOpenSub(null)}
        >
          <MenuItem
            icon={<StatusIcon />}
            label="Change Status"
            hasSubmenu
            isSubOpen={openSub === 'status'}
          />
          {openSub === 'status' && (
            <SubMenu menuRef={menuRef} parentX={menuPos.left}>
              {STATUSES.map((s) => (
                <SubMenuItem
                  key={s.value}
                  label={s.label}
                  isActive={task.status === s.value}
                  onClick={() => handleStatusChange(s.value)}
                />
              ))}
            </SubMenu>
          )}
        </div>

        {/* Priority section */}
        <SectionHeader label="Priority" />
        <div
          className="relative"
          onMouseEnter={() => setOpenSub('priority')}
          onMouseLeave={() => setOpenSub(null)}
        >
          <MenuItem
            icon={<PriorityIcon />}
            label="Change Priority"
            hasSubmenu
            isSubOpen={openSub === 'priority'}
          />
          {openSub === 'priority' && (
            <SubMenu menuRef={menuRef} parentX={menuPos.left}>
              {PRIORITIES.map((p) => (
                <SubMenuItem
                  key={p.value}
                  label={p.label}
                  isActive={task.priority === p.value}
                  onClick={() => handlePriorityChange(p.value)}
                  dot={<span className={`inline-block w-2 h-2 rounded-full ${p.color}`} />}
                />
              ))}
            </SubMenu>
          )}
        </div>

        {/* Assign Agent section */}
        <SectionHeader label="Assign Agent" />
        <div
          className="relative"
          onMouseEnter={() => setOpenSub('agent')}
          onMouseLeave={() => setOpenSub(null)}
        >
          <MenuItem
            icon={<AgentIcon />}
            label="Assign Agent"
            hasSubmenu
            isSubOpen={openSub === 'agent'}
          />
          {openSub === 'agent' && (
            <SubMenu menuRef={menuRef} parentX={menuPos.left}>
              {agents.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-gray-500 italic">
                  No agents available
                </div>
              ) : (
                agents.map((agent) => {
                  const agentName = typeof agent === 'string' ? agent : agent.name
                  return (
                    <SubMenuItem
                      key={agentName}
                      label={agentName}
                      isActive={task.agent === agentName || task.assignedAgent === agentName}
                      onClick={() => handleAgentAssign(agentName)}
                    />
                  )
                })
              )}
            </SubMenu>
          )}
        </div>

        {/* Divider */}
        <div className="my-1 border-t border-dark-500" />

        {/* Copy Task Name */}
        <MenuItem
          icon={<CopyIcon />}
          label={copiedField === 'name' ? 'Copied!' : 'Copy Task Name'}
          onClick={() => handleCopy(task.name || task.title || '', 'name')}
          highlight={copiedField === 'name'}
        />

        {/* Copy Task ID */}
        <MenuItem
          icon={<IdIcon />}
          label={copiedField === 'id' ? 'Copied!' : 'Copy Task ID'}
          onClick={() => handleCopy(task.id || '', 'id')}
          highlight={copiedField === 'id'}
        />
      </div>
    </div>
  )
}

// Section header (9px, uppercase, muted)
function SectionHeader({ label }) {
  return (
    <div className="px-3 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-wider text-gray-500">
      {label}
    </div>
  )
}

// Main menu item
function MenuItem({ icon, label, onClick, hasSubmenu = false, isSubOpen = false, highlight = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors ${
        highlight
          ? 'text-accent-green bg-accent-green/10'
          : 'text-gray-300 hover:bg-dark-600/70 hover:text-white'
      } ${isSubOpen ? 'bg-dark-600/70 text-white' : ''}`}
    >
      <span className="flex-shrink-0 text-gray-400">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {hasSubmenu && (
        <span className="flex-shrink-0 text-gray-500">
          <ChevronIcon />
        </span>
      )}
    </button>
  )
}

// Sub-menu container with smart horizontal positioning
function SubMenu({ children, menuRef, parentX }) {
  const subRef = useRef(null)
  const [side, setSide] = useState('right')

  useEffect(() => {
    if (!subRef.current || !menuRef.current) return
    const parentRect = menuRef.current.getBoundingClientRect()
    const subRect = subRef.current.getBoundingClientRect()
    const vw = window.innerWidth

    if (parentRect.right + subRect.width > vw - 8) {
      setSide('left')
    } else {
      setSide('right')
    }
  }, [menuRef, parentX])

  return (
    <div
      ref={subRef}
      className={`absolute top-0 z-[10000] min-w-[150px] bg-dark-700/95 backdrop-blur-lg border border-dark-500 rounded-lg shadow-2xl shadow-black/50 overflow-hidden ${
        side === 'right' ? 'left-full ml-1' : 'right-full mr-1'
      }`}
    >
      {children}
    </div>
  )
}

// Sub-menu item
function SubMenuItem({ label, isActive, onClick, dot }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors ${
        isActive
          ? 'text-accent-orange bg-accent-orange/10'
          : 'text-gray-300 hover:bg-dark-600/70 hover:text-white'
      }`}
    >
      {dot && <span className="flex-shrink-0">{dot}</span>}
      <span className="flex-1 text-left">{label}</span>
      {isActive && (
        <span className="flex-shrink-0 text-accent-orange">
          <CheckIcon />
        </span>
      )}
    </button>
  )
}
