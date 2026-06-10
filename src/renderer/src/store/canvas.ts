import { create } from 'zustand'
import { applyNodeChanges, type Node, type NodeChange, type Viewport } from '@xyflow/react'
import type { CanvasDoc } from '../../../shared/types'

export const NODE_W = 600
export const MAX_NODE_H = 1280
export const GAP = 24
// Placement estimate for a node whose content hasn't been measured yet.
const EST_NODE_H = 360

export interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
}

export type ChatStatus = 'empty' | 'idle' | 'streaming'

export interface ChatData {
  title: string
  messages: Message[]
  status: ChatStatus
  draft: string
  minimized: boolean
  savedHeight?: number // explicit height to restore when un-minimizing
  sessionId?: string // Agent SDK session; set after the first turn, used for resume
  [key: string]: unknown
}

export type ChatNode = Node<ChatData, 'chat'>

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const uid = (): string => crypto.randomUUID()

function makeNode(position: { x: number; y: number }, partial?: Partial<ChatData>): ChatNode {
  return {
    id: uid(),
    type: 'chat',
    position,
    width: NODE_W,
    dragHandle: '.drag-handle',
    data: { title: '', messages: [], status: 'empty', draft: '', minimized: false, ...partial }
  }
}

function boxOf(n: ChatNode): Rect {
  return {
    x: n.position.x,
    y: n.position.y,
    w: n.width ?? n.measured?.width ?? NODE_W,
    h: n.height ?? n.measured?.height ?? EST_NODE_H
  }
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** Overlap test with the required clearance baked in. */
function tooClose(a: Rect, b: Rect): boolean {
  return intersects({ x: a.x - GAP, y: a.y - GAP, w: a.w + 2 * GAP, h: a.h + 2 * GAP }, b)
}

/**
 * Nearest free spot in/near the viewport: to the right of (or below) existing
 * visible nodes, never overlapping, GAP clearance. Viewport center if empty.
 */
function findFreeSpot(nodes: ChatNode[], view: Rect): { x: number; y: number } {
  const boxes = nodes.map(boxOf)
  if (boxes.length === 0) {
    return {
      x: view.x + view.w / 2 - NODE_W / 2,
      y: view.y + Math.max(GAP, view.h / 2 - EST_NODE_H / 2)
    }
  }

  const visible = boxes.filter((b) => intersects(b, view))
  const seeds = visible.length > 0 ? visible : boxes
  const candidates = seeds.flatMap((b) => [
    { x: b.x + b.w + GAP, y: b.y },
    { x: b.x, y: b.y + b.h + GAP }
  ])

  const free = candidates.filter(
    (c) => !boxes.some((b) => tooClose({ x: c.x, y: c.y, w: NODE_W, h: EST_NODE_H }, b))
  )

  if (free.length > 0) {
    const inView = (c: { x: number; y: number }): number =>
      intersects({ x: c.x, y: c.y, w: NODE_W, h: EST_NODE_H }, view) ? 0 : 1
    free.sort((a, b) => inView(a) - inView(b) || a.x - b.x || a.y - b.y)
    return free[0]
  }

  // Everything packed — go to the right of the global bounding box.
  return {
    x: Math.max(...boxes.map((b) => b.x + b.w)) + GAP,
    y: Math.min(...boxes.map((b) => b.y))
  }
}

interface CanvasState {
  nodes: ChatNode[]
  viewport: Viewport
  loaded: boolean
  onNodesChange: (changes: NodeChange<ChatNode>[]) => void
  setViewport: (vp: Viewport) => void
  addNode: (view: Rect) => void
  setDraft: (id: string, draft: string) => void
  send: (id: string) => void
  discardNode: (id: string) => void
  toggleMinimize: (id: string) => void
  load: () => Promise<Viewport | null>
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

export const useCanvasStore = create<CanvasState>((set, get) => {
  const patchData = (id: string, patch: Partial<ChatData>): void => {
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
    }))
  }

  const persist = (): void => {
    if (!get().loaded) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const { nodes, viewport } = get()
      const doc: CanvasDoc = {
        version: 1,
        nodes: nodes.map((n) => {
          const height = n.data.minimized ? n.data.savedHeight : n.height
          return {
            id: n.id,
            position: n.position,
            width: n.width ?? NODE_W,
            ...(height != null ? { height } : {}),
            title: n.data.title,
            ...(n.data.minimized ? { minimized: true } : {}),
            ...(n.data.sessionId ? { sessionId: n.data.sessionId } : {})
          }
        }),
        edges: [],
        viewport
      }
      void window.api.canvas.save(doc)
    }, 500)
  }

  return {
    nodes: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    loaded: false,

    onNodesChange: (changes) => {
      set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) }))
      persist()
    },

    setViewport: (viewport) => {
      set({ viewport })
      persist()
    },

    addNode: (view) => {
      const node = makeNode(findFreeSpot(get().nodes, view))
      set((s) => ({ nodes: [...s.nodes, node] }))
      persist()
    },

    setDraft: (id, draft) => patchData(id, { draft }),

    discardNode: (id) => {
      set((s) => ({ nodes: s.nodes.filter((n) => n.id !== id) }))
      persist()
    },

    toggleMinimize: (id) => {
      set((s) => ({
        nodes: s.nodes.map((n) => {
          if (n.id !== id) return n
          if (n.data.minimized) {
            // expand: restore the explicit height if there was one
            return {
              ...n,
              height: n.data.savedHeight,
              data: { ...n.data, minimized: false, savedHeight: undefined }
            }
          }
          // minimize: drop the explicit height so the node collapses to the title row
          return {
            ...n,
            height: undefined,
            data: { ...n.data, minimized: true, savedHeight: n.height }
          }
        })
      }))
      persist()
    },

    send: (id) => {
      const node = get().nodes.find((n) => n.id === id)
      if (!node || node.data.status === 'streaming') return
      const text = node.data.draft.trim()
      if (!text) return

      const userMsg: Message = { id: uid(), role: 'user', text }
      const assistantMsg: Message = { id: uid(), role: 'assistant', text: '' }
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === id
            ? {
                ...n,
                // release any fixed height so the node grows with the reply (up to the max)
                height: undefined,
                data: {
                  ...n.data,
                  messages: [...node.data.messages, userMsg, assistantMsg],
                  draft: '',
                  status: 'streaming' as const,
                  title: node.data.title || text.slice(0, 60)
                }
              }
            : n
        )
      }))
      persist() // title may have changed

      void window.api.thread.send({ nodeId: id, text, sessionId: node.data.sessionId })
    },

    load: async () => {
      const doc = await window.api.canvas.load()
      if (!doc) {
        set({ loaded: true })
        return null
      }
      set({
        loaded: true,
        viewport: doc.viewport,
        nodes: doc.nodes.map((p) => ({
          ...makeNode(p.position, {
            title: p.title,
            status: p.title ? 'idle' : 'empty',
            minimized: p.minimized ?? false,
            savedHeight: p.minimized ? p.height : undefined,
            sessionId: p.sessionId
          }),
          id: p.id,
          width: p.width,
          ...(p.height != null && !p.minimized ? { height: p.height } : {})
        }))
      })
      return doc.viewport
    }
  }
})

// Stream events from the main process (one Agent SDK query per turn, any number of
// nodes streaming concurrently). Registered once at module load.
window.api.thread.onEvent((event) => {
  const { setState } = useCanvasStore
  const patch = (id: string, fn: (data: ChatData) => Partial<ChatData>): void => {
    setState((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...fn(n.data) } } : n))
    }))
  }

  if (event.type === 'session' && event.sessionId) {
    patch(event.nodeId, () => ({ sessionId: event.sessionId }))
  } else if (event.type === 'delta' && event.text) {
    patch(event.nodeId, (data) => {
      const last = data.messages[data.messages.length - 1]
      if (!last || last.role !== 'assistant') return {}
      return {
        messages: [...data.messages.slice(0, -1), { ...last, text: last.text + event.text }]
      }
    })
  } else if (event.type === 'done') {
    patch(event.nodeId, (data) => {
      if (event.ok !== false) return { status: 'idle' }
      const last = data.messages[data.messages.length - 1]
      const note = `\n\n⚠️ ${event.error ?? 'The agent run failed.'}`
      return {
        status: 'idle',
        messages:
          last && last.role === 'assistant'
            ? [...data.messages.slice(0, -1), { ...last, text: last.text + note }]
            : data.messages
      }
    })
  }
})
