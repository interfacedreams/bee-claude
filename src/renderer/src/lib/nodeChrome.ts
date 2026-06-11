// Shared chrome for canvas nodes (chat and note views).

// Every header chip button (minimize/expand/fork/delete) shares this shape:
// rounded square, icon centered, palette chip fill that darkens to accent on hover.
export const CHIP_BUTTON =
  'nodrag flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-(--np-chip) text-(--np-deep) transition-colors hover:bg-(--np-accent)'

// The header band is the node's only drag surface — React Flow matches its
// `drag-handle` class via the node's dragHandle selector (see store/canvas.ts).
// Interactive children opt out with `nodrag` (CHIP_BUTTON includes it).
export const DRAG_HEADER = 'drag-handle cursor-grab active:cursor-grabbing'

// React Flow's default handle is a visible 6px dot — these are layout anchors only.
export const HIDDEN_HANDLE: React.CSSProperties = {
  opacity: 0,
  pointerEvents: 'none',
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  border: 'none',
  background: 'transparent'
}
