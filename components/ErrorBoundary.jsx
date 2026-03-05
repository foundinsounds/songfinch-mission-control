'use client'

import { Component } from 'react'

// ---- Error Boundary ----
// Catches React render errors and shows a recovery UI
// Wraps individual dashboard sections so one error doesn't crash everything

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error(`[ErrorBoundary] ${this.props.name || 'Unknown'}:`, error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          retry: this.handleRetry,
        })
      }

      // Default error UI
      return (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
          margin: 8,
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>💥</div>
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#f87171',
            marginBottom: 4,
          }}>
            {this.props.name ? `${this.props.name} Error` : 'Something went wrong'}
          </div>
          <div style={{
            fontSize: 12,
            color: 'var(--text-secondary, #999)',
            marginBottom: 12,
            maxWidth: 300,
            marginInline: 'auto',
          }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </div>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 600,
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => e.target.style.background = 'rgba(239, 68, 68, 0.25)'}
            onMouseOut={e => e.target.style.background = 'rgba(239, 68, 68, 0.15)'}
          >
            ↻ Retry
          </button>
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details style={{
              marginTop: 12,
              textAlign: 'left',
              fontSize: 10,
              color: '#888',
              maxHeight: 200,
              overflow: 'auto',
            }}>
              <summary style={{ cursor: 'pointer' }}>Stack Trace</summary>
              <pre style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

// ---- Inline Error Card ----
// For non-fatal errors within data fetching (lighter than ErrorBoundary)
export function ErrorCard({ title, message, onRetry, compact = false }) {
  if (compact) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: 'rgba(239, 68, 68, 0.08)',
        borderRadius: 8,
        fontSize: 12,
        color: '#f87171',
      }}>
        <span>⚠️</span>
        <span style={{ flex: 1 }}>{message || 'Error loading data'}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              background: 'none',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{
      background: 'rgba(239, 68, 68, 0.06)',
      border: '1px solid rgba(239, 68, 68, 0.15)',
      borderRadius: 10,
      padding: 16,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>⚠️</div>
      {title && <div style={{ fontSize: 13, fontWeight: 600, color: '#f87171', marginBottom: 4 }}>{title}</div>}
      <div style={{ fontSize: 12, color: 'var(--text-secondary, #999)', marginBottom: onRetry ? 10 : 0 }}>
        {message || 'Failed to load this section'}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '5px 14px',
            fontSize: 11,
            fontWeight: 600,
            background: 'rgba(239, 68, 68, 0.12)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 5,
            cursor: 'pointer',
          }}
        >
          ↻ Try Again
        </button>
      )}
    </div>
  )
}

export default ErrorBoundary
