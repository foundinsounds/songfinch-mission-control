'use client'

import { useState, useCallback } from 'react'

/**
 * CopyButton — Copy text to clipboard with visual feedback
 *
 * Variants:
 *   - "icon" (default): Small icon-only button
 *   - "button": Text button with icon
 *   - "inline": Minimal inline trigger
 *
 * Usage:
 *   <CopyButton text={task.output} />
 *   <CopyButton text={content} variant="button" label="Copy Output" />
 */
export default function CopyButton({
  text,
  variant = 'icon',
  label = 'Copy',
  className = '',
  successDuration = 2000,
  onCopy,
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async (e) => {
    e?.stopPropagation()
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      onCopy?.()
      setTimeout(() => setCopied(false), successDuration)
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      onCopy?.()
      setTimeout(() => setCopied(false), successDuration)
    }
  }, [text, successDuration, onCopy])

  if (variant === 'icon') {
    return (
      <button
        onClick={handleCopy}
        title={copied ? 'Copied!' : label}
        className={`p-1 rounded transition-all ${
          copied
            ? 'text-accent-green bg-accent-green/10'
            : 'text-gray-500 hover:text-gray-300 hover:bg-dark-600'
        } ${className}`}
      >
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        )}
      </button>
    )
  }

  if (variant === 'button') {
    return (
      <button
        onClick={handleCopy}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
          copied
            ? 'bg-accent-green/15 text-accent-green border border-accent-green/20'
            : 'bg-dark-600 text-gray-400 border border-dark-500 hover:bg-dark-500 hover:text-gray-200'
        } ${className}`}
      >
        {copied ? (
          <>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            {label}
          </>
        )}
      </button>
    )
  }

  // inline variant
  return (
    <span
      onClick={handleCopy}
      className={`cursor-pointer transition-colors ${
        copied ? 'text-accent-green' : 'text-gray-500 hover:text-gray-300'
      } ${className}`}
      title={copied ? 'Copied!' : label}
    >
      {copied ? '\u2713' : '\u{1F4CB}'}
    </span>
  )
}

/**
 * Hook for clipboard operations without a UI component
 * Returns a copy function and copied state
 */
export function useClipboard(successDuration = 2000) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), successDuration)
      return true
    } catch {
      return false
    }
  }, [successDuration])

  return { copy, copied }
}
