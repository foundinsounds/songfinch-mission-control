'use client'

import { useMemo } from 'react'

/**
 * useTaskSearch — fuzzy search + multi-facet quick filters for the task list.
 * Extracted from page.js to keep the search algorithm self-contained and testable.
 *
 * Scoring algorithm:
 *  - Exact field match: 100 pts
 *  - Starts-with: 80 pts
 *  - Substring: 60 pts
 *  - Character-sequence fuzzy (min 2 chars): 30 pts
 *
 * All search tokens must match at least one field (AND logic across tokens).
 */
export function useTaskSearch(tasks, searchQuery, quickFilters) {
  const filteredTasks = useMemo(() => {
    let result = tasks

    // Apply quick filters first
    const { priorities, agents: agentFilters, contentTypes, statuses } = quickFilters
    if (priorities?.length > 0) {
      result = result.filter(t => priorities.includes(t.priority))
    }
    if (agentFilters?.length > 0) {
      result = result.filter(t => t.agent && agentFilters.includes(t.agent))
    }
    if (contentTypes?.length > 0) {
      result = result.filter(t => t.contentType && contentTypes.includes(t.contentType))
    }
    if (statuses?.length > 0) {
      result = result.filter(t => t.status && statuses.includes(t.status))
    }

    // Fuzzy search — token-based scoring with typo tolerance
    if (searchQuery && searchQuery.trim().length > 0) {
      const rawQ = searchQuery.trim().toLowerCase()
      const tokens = rawQ.split(/\s+/).filter(Boolean)

      // Character-sequence fuzzy match: do all chars of pattern appear in order in str?
      const fuzzyMatch = (str, pattern) => {
        let si = 0, pi = 0
        while (si < str.length && pi < pattern.length) {
          if (str[si] === pattern[pi]) pi++
          si++
        }
        return pi === pattern.length
      }

      // Score a single token against a single field value (0 = no match)
      const scoreToken = (field, token) => {
        if (!field) return 0
        const f = field.toLowerCase()
        if (f === token) return 100          // exact field match
        if (f.startsWith(token)) return 80   // starts with
        if (f.includes(token)) return 60     // substring
        if (token.length >= 2 && fuzzyMatch(f, token)) return 30 // fuzzy sequence
        return 0
      }

      // Score a task: sum of best-field scores per token
      const scoreTask = (t) => {
        const fields = [
          t.name, t.description, t.agent, t.status,
          t.priority, t.contentType, t.campaign, t.platform,
          ...(t.tags || [])
        ]
        let total = 0
        for (const token of tokens) {
          let best = 0
          for (const f of fields) {
            const s = scoreToken(f, token)
            if (s > best) best = s
          }
          if (best === 0) return 0 // all tokens must match something
          total += best
        }
        return total
      }

      const scored = result.map(t => ({ task: t, score: scoreTask(t) }))
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
      result = scored.map(s => s.task)
    }

    return result
  }, [tasks, searchQuery, quickFilters])

  return filteredTasks
}
