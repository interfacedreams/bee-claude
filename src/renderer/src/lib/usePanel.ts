import { useCallback } from 'react'
import { useCanvasStore, type PanelMode } from '../store/canvas'

/**
 * Out-of-card docking for one node. A node can open right-docked ('panel') or
 * window-covering ('full'); both render the same body in ExpandedPanel, so its
 * canvas card shows a stub either way. `open(mode)` toggles: clicking the chip
 * for the current mode closes it, clicking the other mode's chip flips to it
 * (no remount — same ExpandedPanel, only the container resizes). Esc and the
 * panel's own chips route through these same store actions.
 */
export function usePanel(id: string): {
  docked: boolean
  mode: PanelMode | null
  open: (mode: PanelMode) => void
  collapse: () => void
} {
  const mode = useCanvasStore((s) => (s.expanded?.id === id ? s.expanded.mode : null))
  const open = useCallback(
    (next: PanelMode) => {
      const s = useCanvasStore.getState()
      if (s.expanded?.id === id && s.expanded.mode === next) s.collapseExpanded()
      else s.expandNode(id, next)
    },
    [id]
  )
  const collapse = useCallback(() => useCanvasStore.getState().collapseExpanded(), [])
  return { docked: mode !== null, mode, open, collapse }
}
