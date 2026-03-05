'use client'

import { useCallback, useEffect, useRef } from 'react'

/**
 * Syncs specific state values to URL search params.
 * Reads initial values from URL on mount and writes changes back.
 *
 * This is a lightweight alternative to using Next.js router for
 * simple key-value state persistence. It uses the History API
 * directly to avoid full page re-renders.
 *
 * @param {Object} stateMap - { paramName: [value, setter] }
 * @param {Object} defaults - { paramName: defaultValue }
 */
export function useURLState(stateMap, defaults = {}) {
  const initialized = useRef(false)

  // Read URL params on mount and set initial state
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    try {
      const params = new URLSearchParams(window.location.search)
      Object.entries(stateMap).forEach(([param, [, setter]]) => {
        const urlValue = params.get(param)
        if (urlValue !== null && urlValue !== '') {
          // Type coercion: if default is null, keep as string or null
          const defaultVal = defaults[param]
          if (urlValue === 'null' || urlValue === '') {
            setter(defaultVal ?? null)
          } else {
            setter(urlValue)
          }
        }
      })
    } catch {
      // SSR or URL parsing error — ignore
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Write state changes to URL
  const syncToURL = useCallback(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      let changed = false

      Object.entries(stateMap).forEach(([param, [value]]) => {
        const defaultVal = defaults[param] ?? null
        if (value && value !== defaultVal) {
          if (params.get(param) !== String(value)) {
            params.set(param, String(value))
            changed = true
          }
        } else {
          if (params.has(param)) {
            params.delete(param)
            changed = true
          }
        }
      })

      if (changed) {
        const search = params.toString()
        const url = search ? `${window.location.pathname}?${search}` : window.location.pathname
        window.history.replaceState({}, '', url)
      }
    } catch {
      // SSR — ignore
    }
  }, [stateMap, defaults])

  // Sync whenever values change
  useEffect(() => {
    if (initialized.current) {
      syncToURL()
    }
  }, [syncToURL])
}

/**
 * Simple hook to read a single URL param with a default value.
 * Returns [value, setter] where setter also updates the URL.
 */
export function useURLParam(param, defaultValue = null) {
  const readFromURL = useCallback(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      return params.get(param) ?? defaultValue
    } catch {
      return defaultValue
    }
  }, [param, defaultValue])

  const writeToURL = useCallback((value) => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (value && value !== defaultValue) {
        params.set(param, String(value))
      } else {
        params.delete(param)
      }
      const search = params.toString()
      const url = search ? `${window.location.pathname}?${search}` : window.location.pathname
      window.history.replaceState({}, '', url)
    } catch {
      // SSR
    }
  }, [param, defaultValue])

  return { readFromURL, writeToURL }
}
