import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '../store/canvas'

/**
 * Full-page mode for one node: the header's expand chip promotes the node to
 * a near-fullscreen page (store resizes it, we animate the viewport onto it)
 * and toggles back — Esc in Canvas also exits through collapseExpanded. The
 * viewport hop is animated; the frame swap is instant, which reads as the
 * panel growing into place.
 */
export function usePageExpand(id: string): { isPage: boolean; togglePage: () => void } {
  const isPage = useCanvasStore((s) => s.expanded?.id === id)
  const { setViewport } = useReactFlow()

  const togglePage = useCallback(() => {
    const s = useCanvasStore.getState()
    const vp = s.expanded?.id === id ? s.collapseExpanded() : s.expandNode(id)
    if (vp) void setViewport(vp, { duration: 300 })
  }, [id, setViewport])

  return { isPage, togglePage }
}
