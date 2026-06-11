import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStore, NODE_W } from '../store/canvas'

/**
 * Spawn a chat or note at a free spot near the current view, then center the
 * camera on it — the fresh node autofocuses, so it's type-ready when it lands.
 * Shared by the new-chat/new-note buttons and the C / N / ⌘N shortcuts.
 */
export function useSpawn(): (kind: 'chat' | 'note') => void {
  const addNode = useCanvasStore((s) => s.addNode)
  const addNote = useCanvasStore((s) => s.addNote)
  const { getViewport, setCenter } = useReactFlow()

  return useCallback(
    (kind) => {
      if (!useCanvasStore.getState().repo?.current) return
      const vp = getViewport()
      const view = {
        x: -vp.x / vp.zoom,
        y: -vp.y / vp.zoom,
        w: window.innerWidth / vp.zoom,
        h: window.innerHeight / vp.zoom
      }
      const node = kind === 'note' ? addNote(view) : addNode(view)
      // If zoomed way out, come in to a readable zoom; otherwise stay put.
      const zoom = Math.max(vp.zoom, 1)
      void setCenter(node.position.x + NODE_W / 2, node.position.y + 150, { zoom, duration: 250 })
    },
    [addNode, addNote, getViewport, setCenter]
  )
}
