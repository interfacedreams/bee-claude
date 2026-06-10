// Shared between main and renderer. Persistence shapes for .canvas/canvas.json.

export interface PersistedNode {
  id: string
  position: { x: number; y: number }
  width: number
  height?: number // only set when the user resized; otherwise height tracks content
  title: string
  minimized?: boolean
}

export interface PersistedEdge {
  id: string
  source: string
  target: string
  sourceMessageId: string
}

export interface CanvasDoc {
  version: 1
  nodes: PersistedNode[]
  edges: PersistedEdge[]
  viewport: { x: number; y: number; zoom: number }
}
