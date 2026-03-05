'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastContext = createContext(null)

let toastId = 0

/**
 * Toast types with their styling:
 * - success: Green accent, checkmark icon
 * - error: Red accent, X icon
 * - info: Blue accent, info icon
 * - warning: Orange accent, warning icon
 */
const TOAST_STYLES = {
  success: {
    bg: 'bg-accent-green/10',
    border: 'border-accent-green/30',
    text: 'text-accent-green',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
  info: {
    bg: 'bg-accent-blue/10',
    border: 'border-accent-blue/30',
    text: 'text-accent-blue',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
  warning: {
    bg: 'bg-accent-orange/10',
    border: 'border-accent-orange/30',
    text: 'text-accent-orange',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  shortcut: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/25',
    text: 'text-purple-400',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M6 16h12" />
      </svg>
    ),
    duration: 1800,
  },
}

/**
 * ToastProvider — wraps the app and provides showToast() via context.
 * Toasts auto-dismiss after duration (default 4s), stack from top-right.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  const removeToast = useCallback((id) => {
    // First mark as exiting for animation
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    // Then remove after animation
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      if (timersRef.current[id]) {
        clearTimeout(timersRef.current[id])
        delete timersRef.current[id]
      }
    }, 200)
  }, [])

  const showToast = useCallback((message, type = 'info', duration) => {
    const id = ++toastId
    const typeStyle = TOAST_STYLES[type] || TOAST_STYLES.info
    const dismissAfter = duration ?? typeStyle.duration ?? 4000
    setToasts(prev => [...prev, { id, message, type, exiting: false }])
    if (dismissAfter > 0) {
      timersRef.current[id] = setTimeout(() => removeToast(id), dismissAfter)
    }
    return id
  }, [removeToast])

  return (
    <ToastContext.Provider value={showToast}>
      {children}

      {/* Toast container — top-right stacked */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
          {toasts.map((toast) => {
            const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info
            return (
              <div
                key={toast.id}
                className={`pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-200 ${style.bg} ${style.border} ${
                  toast.exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 animate-toast-in'
                }`}
                style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}
              >
                <span className={`shrink-0 ${style.text}`}>{style.icon}</span>
                <span className="text-[12px] text-gray-200 font-medium flex-1">{toast.message}</span>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-gray-500 hover:text-gray-300 transition-colors shrink-0 ml-1"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </ToastContext.Provider>
  )
}

/**
 * Hook to access toast notifications.
 * Usage: const showToast = useToast()
 *        showToast('Task approved!', 'success')
 */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Return a no-op if not inside provider (safe fallback)
    return () => {}
  }
  return ctx
}
