import { memo, useEffect, useRef, useState } from 'react'
import {
  Handle,
  NodeResizeControl,
  Position,
  ResizeControlVariant,
  useReactFlow,
  type NodeProps
} from '@xyflow/react'
import { Expand, ImageOff, Minus, Pencil, Trash2 } from 'lucide-react'
import { useCanvasStore, MAX_NODE_H, type FileNode } from '../store/canvas'
import { paletteFor } from '../lib/palette'
import {
  CHIP_BUTTON,
  CTX_HANDLE_ID,
  ctxHandleStyle,
  DRAG_HEADER,
  HIDDEN_HANDLE
} from '../lib/nodeChrome'

// Same paper fill as notes — it shows through as letterboxing when the node's
// box drifts off the image's aspect ratio.
const PAPER = '#FFFDF6'

// All three resize controls keep the aspect ratio, so the image always
// (nearly) fills the frame — Figma-style corner/edge scaling.
const RESIZE_LIMITS = { minWidth: 240, minHeight: 120, maxHeight: MAX_NODE_H }

function FileNodeView({ id, data, selected }: NodeProps<FileNode>): React.JSX.Element {
  const setTitle = useCanvasStore((s) => s.setTitle)
  const requestDelete = useCanvasStore((s) => s.requestDelete)
  const toggleMinimize = useCanvasStore((s) => s.toggleMinimize)
  const setCtxConnectSource = useCanvasStore((s) => s.setCtxConnectSource)
  const armed = useCanvasStore((s) => s.ctxConnectSource === id)
  const { fitView } = useReactFlow()

  const titleRef = useRef<HTMLInputElement>(null)

  // The title is static text (part of the header drag surface) until the user
  // enters rename mode via the pencil button or a double-click on the title.
  // Renaming relabels the node only — the image file keeps its name.
  const [editingTitle, setEditingTitle] = useState(false)
  if (data.minimized && editingTitle) setEditingTitle(false)

  useEffect(() => {
    if (!editingTitle) return
    titleRef.current?.focus()
    titleRef.current?.select()
  }, [editingTitle])

  const palette = paletteFor(data.color)

  const expandAndCenter = (): void => {
    const fit = (): void => {
      void fitView({ nodes: [{ id }], duration: 300, padding: 0.1, maxZoom: 1 })
    }
    if (data.minimized) {
      toggleMinimize(id)
      // let React Flow re-measure the expanded node before fitting to it
      setTimeout(fit, 50)
    } else {
      fit()
    }
  }

  return (
    <div
      style={
        {
          backgroundColor: `${PAPER}D9`,
          '--np-bg': palette.bg,
          '--np-edge': palette.edge,
          '--np-chip': `${palette.edge}99`,
          '--np-accent': palette.accent,
          '--np-deep': palette.deep,
          '--np-ring': `${palette.accent}B3`
        } as React.CSSProperties
      }
      className={`flex h-full w-full flex-col rounded-[14px] border border-(--np-edge) shadow-md ${
        selected ? 'ring-2 ring-(--np-ring)' : ''
      }`}
    >
      {/* hidden layout anchors (left/right) for any future edges */}
      <Handle type="target" position={Position.Left} isConnectable={false} style={HIDDEN_HANDLE} />
      <Handle type="source" position={Position.Right} isConnectable={false} style={HIDDEN_HANDLE} />
      {/* the context connector: drag this circle onto a chat's circle — or
          tap it and the arrow follows the cursor until a click on a chat
          commits (ContextConnectOverlay) — to let that chat see this image */}
      <Handle
        id={CTX_HANDLE_ID}
        type="source"
        position={Position.Bottom}
        isConnectable
        isConnectableEnd={false}
        title="Drag — or tap, then click a chat — to attach this image as context"
        onClick={(e) => {
          // keep the tap from reaching the overlay's window listener,
          // which treats any stray click as cancel
          e.stopPropagation()
          setCtxConnectSource(armed ? null : id)
        }}
        className={`ctx-handle ${armed ? 'ctx-armed' : ''}`}
        style={ctxHandleStyle(palette.accent, 'bottom')}
      />

      {!data.minimized && (
        <>
          <NodeResizeControl
            position="right"
            variant={ResizeControlVariant.Line}
            keepAspectRatio
            {...RESIZE_LIMITS}
            style={{ borderColor: 'transparent', borderWidth: 5 }}
          />
          <NodeResizeControl
            position="bottom"
            variant={ResizeControlVariant.Line}
            keepAspectRatio
            {...RESIZE_LIMITS}
            style={{ borderColor: 'transparent', borderWidth: 5 }}
          />
          <NodeResizeControl
            position="bottom-right"
            keepAspectRatio
            {...RESIZE_LIMITS}
            style={{
              background: 'transparent',
              border: 'none',
              width: 16,
              height: 16,
              cursor: 'nwse-resize'
            }}
          />
        </>
      )}

      {/* colored header band, same chrome as chats and notes */}
      <div
        style={{ backgroundColor: `${palette.bg}D9` }}
        className={`${DRAG_HEADER} flex shrink-0 items-center gap-2 px-3 py-1.5 ${
          data.minimized ? 'rounded-[13px]' : 'rounded-t-[13px] border-b border-(--np-edge)'
        }`}
      >
        {!data.minimized && (
          <button
            type="button"
            onClick={() => toggleMinimize(id)}
            title="Minimize"
            className={CHIP_BUTTON}
          >
            <Minus className="h-[25px] w-[25px]" />
          </button>
        )}
        <button
          type="button"
          onClick={expandAndCenter}
          title={data.minimized ? 'Expand' : 'Zoom to fit'}
          className={CHIP_BUTTON}
        >
          <Expand className="h-[25px] w-[25px]" />
        </button>
        {editingTitle && !data.minimized ? (
          <input
            ref={titleRef}
            value={data.title}
            placeholder="Untitled image"
            onChange={(e) => setTitle(id, e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault()
                setEditingTitle(false)
              }
            }}
            className="nodrag min-w-0 flex-1 cursor-text truncate bg-transparent text-[26px] font-medium text-(--np-deep) outline-none placeholder:text-(--np-deep) placeholder:opacity-50"
          />
        ) : (
          <span
            onDoubleClick={() => {
              if (!data.minimized) setEditingTitle(true)
            }}
            title={data.minimized ? undefined : 'Double-click to rename'}
            className={`min-w-0 flex-1 truncate text-[26px] font-medium text-(--np-deep) ${data.title ? '' : 'opacity-50'}`}
          >
            {data.title || 'Untitled image'}
          </span>
        )}
        <div className="nodrag relative ml-auto flex shrink-0 items-center gap-1">
          {!data.minimized && (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              title="Rename this image"
              className={CHIP_BUTTON}
            >
              <Pencil className="h-[25px] w-[25px]" />
            </button>
          )}
          <button
            type="button"
            onClick={() => requestDelete(id)}
            title="Delete this image"
            className={CHIP_BUTTON}
          >
            <Trash2 className="h-[25px] w-[25px]" />
          </button>
        </div>
      </div>

      {!data.minimized && (
        // The whole image is a drag surface — grab anywhere to move the node.
        <div className={`${DRAG_HEADER} min-h-0 flex-1 overflow-hidden rounded-b-[13px]`}>
          {data.dataUrl ? (
            <img
              src={data.dataUrl}
              alt={data.title}
              draggable={false}
              className="h-full w-full object-contain select-none"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-neutral-400">
              <ImageOff className="h-8 w-8" />
              <span className="max-w-full truncate px-3 text-[13px]">
                {data.file ?? 'Image missing'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(FileNodeView)
