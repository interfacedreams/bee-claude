import { useRef, type Ref } from 'react'
import { useCanvasStore, isNote } from '../store/canvas'
import { paletteFor } from '../lib/palette'
import { useForwardedWheel } from '../lib/useForwardedWheel'
import NoteEditor, { type NoteEditorHandle } from './NoteEditor'

/**
 * A note's ruled-paper editor body, driven by the node id straight from the
 * store — the same component serves the canvas card and the side panel (only
 * one renders at a time: the card shows a stub while the note is docked).
 *
 * `focused` gates wheel routing on the canvas (an unfocused card pans the
 * board); the panel passes inPanel, which scrolls natively instead.
 */
export default function NoteBody({
  id,
  focused,
  inPanel = false,
  editorRef
}: {
  id: string
  focused: boolean
  inPanel?: boolean
  editorRef?: Ref<NoteEditorHandle>
}): React.JSX.Element | null {
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === id))
  const setNoteContent = useCanvasStore((s) => s.setNoteContent)
  const discardNode = useCanvasStore((s) => s.discardNode)
  const scrollRef = useRef<HTMLDivElement>(null)

  const data = node && isNote(node) ? node.data : undefined

  // Scrolling the note body requires focus (the node is selected by clicking
  // it); otherwise the wheel pans the canvas. The panel scrolls natively.
  useForwardedWheel(scrollRef, !inPanel && !!data, focused)

  if (!data) return null
  const streaming = data.status === 'streaming'
  // A note is discardable while it has no substance yet.
  const blank = !data.content && !data.title && !data.sessionId
  const palette = paletteFor(data.color)

  return (
    <div className="nodrag mx-1 my-1 flex min-h-0 flex-1 cursor-auto flex-col overflow-hidden">
      <div
        ref={scrollRef}
        style={{
          // ruled notepad lines, aligned to the 26px text grid and tinted
          // to the palette; `local` makes them scroll with the content
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent 25px, ${palette.edge}59 25px, ${palette.edge}59 26px)`,
          backgroundAttachment: 'local',
          backgroundPosition: '0 8px'
        }}
        className="nowheel select-text transcript-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-1 text-[15px] leading-[26px] text-neutral-900"
      >
        <NoteEditor
          ref={editorRef}
          content={data.content}
          readOnly={streaming}
          onChange={(md) => setNoteContent(id, md)}
          onEscape={() => {
            if (blank) discardNode(id)
          }}
        />
        {/* same typing indicator as chat replies, while the AI writes */}
        {streaming && (
          <div className="animate-pulse px-3 py-1 tracking-widest text-neutral-400">●●●</div>
        )}
      </div>
    </div>
  )
}
