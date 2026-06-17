import { useCallback, useState } from 'react'

/**
 * Drop-in replacement for `useState(false)` that remembers a legend's
 * collapsed/expanded state across reloads. Whether a corner panel (Actions,
 * Folders, Memory, Recent) is hidden is an app-wide UI preference, not canvas
 * data — so, like the model/effort selectors, it lives in localStorage rather
 * than canvas.json. Each legend passes its own stable key.
 */
export function usePersistedCollapse(key: string): [boolean, (collapsed: boolean) => void] {
  const storageKey = `bee-claude:legend-collapsed:${key}`
  const [collapsed, set] = useState(() => localStorage.getItem(storageKey) === '1')

  const setCollapsed = useCallback(
    (next: boolean) => {
      set(next)
      localStorage.setItem(storageKey, next ? '1' : '0')
    },
    [storageKey]
  )

  return [collapsed, setCollapsed]
}
