'use client'

import { useState, useEffect, useCallback, createContext, useContext, memo } from 'react'

// ---- Toast Context ----
const ToastContext = createContext(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}

// ---- Toast Provider ----
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback(({ type = 'info', title, message, duration = 4000, action }) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, type, title, message, duration, action, createdAt: Date.now() }])

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }

    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Convenience methods
  const toast = {
    success: (title, message, opts) => addToast({ type: 'success', title, message, ...opts }),
    error: (title, message, opts) => addToast({ type: 'error', title, message, duration: 6000, ...opts }),
    warning: (title, message, opts) => addToast({ type: 'warning', title, message, ...opts }),
    info: (title, message, opts) => addToast({ type: 'info', title, message, ...opts }),
    agent: (agentName, message, opts) => addToast({ type: 'agent', title: agentName, message, ...opts }),
    remove: removeToast,
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

// ---- Toast Icons ----
const ICONS = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  agent: '🤖',
}

const COLORS = {
  success: { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.4)', text: '#4ade80' },
  error: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', text: '#f87171' },
  warning: { bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.4)', text: '#facc15' },
  info: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', text: '#60a5fa' },
  agent: { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.4)', text: '#fb923c' },
}

// ---- Toast Container ----
function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      right: 16,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxWidth: 380,
      pointerEvents: 'none',
    }}>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

// ---- Individual Toast ----
const ToastItem = memo(function ToastItem({ toast, onRemove }) {
  const [isExiting, setIsExiting] = useState(false)
  const [progress, setProgress] = useState(100)
  const colors = COLORS[toast.type] || COLORS.info

  useEffect(() => {
    if (toast.duration <= 0) return

    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / toast.duration) * 100)
      setProgress(remaining)

      if (remaining <= 0) {
        clearInterval(interval)
      }
    }, 50)

    return () => clearInterval(interval)
  }, [toast.duration])

  const handleRemove = () => {
    setIsExiting(true)
    setTimeout(() => onRemove(toast.id), 200)
  }

  return (
    <div
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        pointerEvents: 'auto',
        cursor: 'pointer',
        transform: isExiting ? 'translateX(120%)' : 'translateX(0)',
        opacity: isExiting ? 0 : 1,
        transition: 'all 0.2s ease-out',
        animation: 'toast-slide-in 0.3s ease-out',
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={handleRemove}
    >
      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>
        {ICONS[toast.type]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <div style={{
            fontWeight: 600,
            fontSize: 13,
            color: colors.text,
            marginBottom: toast.message ? 2 : 0,
          }}>
            {toast.title}
          </div>
        )}
        {toast.message && (
          <div style={{
            fontSize: 12,
            color: 'var(--text-secondary, #999)',
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}>
            {toast.message}
          </div>
        )}
        {toast.action && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              toast.action.onClick()
              handleRemove()
            }}
            style={{
              marginTop: 6,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 600,
              background: colors.border,
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          handleRemove()
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary, #666)',
          cursor: 'pointer',
          fontSize: 14,
          lineHeight: 1,
          padding: 0,
          flexShrink: 0,
        }}
      >
        ×
      </button>

      {/* Progress bar */}
      {toast.duration > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 2,
          width: `${progress}%`,
          background: colors.text,
          opacity: 0.5,
          transition: 'width 0.1s linear',
        }} />
      )}
    </div>
  )
})

export default ToastProvider
