import { Maximize2, Minimize2, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useCanvasStore, isChat, isLink, isNote } from '../store/canvas'
import { paletteFor } from '../lib/palette'
import { CHIP_BUTTON } from '../lib/nodeChrome'
import ChatBody from './ChatBody'
import NoteBody from './NoteBody'
import FileBody from './FileBody'
import TabBrowser, { LinkSearch } from './TabBrowser'

// Same paper fill as the paper-bodied nodes (notes, files, tabs).
const PAPER = '#FFFDF6'

/**
 * The reading surface: one node's content at full height, in either of two
 * sizes. 'panel' docks it to the right so the canvas stays live beside it —
 * read an article and take notes on the board at once. 'full' covers the whole
 * window for distraction-free reading. Both render the same body, so flipping
 * between them never remounts a webview. The node's canvas card swaps its body
 * for a stub (its content can only be mounted once — a webview enforces that,
 * the rest follow for symmetry) and keeps wearing its chrome: rename, delete,
 * edges, all stay on the card. Esc, the close chip here, or the card's chip
 * closes it; the other-mode chip flips between the two sizes.
 *
 * Solid fills throughout — the canvas must not ghost through a reading
 * surface.
 */
export default function ExpandedPanel(): React.JSX.Element | null {
  const node = useCanvasStore((s) => {
    const id = s.expanded?.id
    return id ? (s.nodes.find((n) => n.id === id) ?? null) : null
  })
  const mode = useCanvasStore((s) => s.expanded?.mode ?? null)
  const expandNode = useCanvasStore((s) => s.expandNode)
  const collapseExpanded = useCanvasStore((s) => s.collapseExpanded)
  if (!node || !mode) return null

  const full = mode === 'full'
  // Full screen spans the whole window — far wider than a comfortable reading
  // measure. Text bodies (chat, notes) center in a fixed reading column;
  // webviews and files still fill the width. The side panel is already narrow.
  const reading = full ? 'mx-auto w-full max-w-3xl' : ''

  const data = node.data
  const palette = paletteFor(data.color)
  const chat = isChat(node)
  const untitled = chat
    ? 'New chat'
    : isNote(node)
      ? 'Untitled note'
      : isLink(node)
        ? 'Untitled tab'
        : node.data.kind === 'pdf'
          ? 'Untitled PDF'
          : 'Untitled image'

  return (
    <aside
      style={
        {
          backgroundColor: chat ? palette.bg : PAPER,
          '--np-bg': palette.bg,
          '--np-edge': palette.edge,
          '--np-chip': `${palette.edge}99`,
          '--np-accent': palette.accent,
          '--np-deep': palette.deep,
          '--np-ring': `${palette.accent}B3`
        } as React.CSSProperties
      }
      className={
        full
          ? 'fixed inset-0 z-40 flex flex-col'
          : 'flex h-screen w-[min(52vw,880px)] shrink-0 flex-col border-l border-(--np-edge)'
      }
    >
      {/* colored header band — the same chrome the node wears on the canvas */}
      <div
        style={{ backgroundColor: palette.bg }}
        className="flex shrink-0 items-center gap-2 border-b border-(--np-edge) px-3 py-1.5"
      >
        <span
          className={`min-w-0 flex-1 truncate text-[26px] font-medium text-(--np-deep) ${
            data.title ? '' : 'opacity-50'
          }`}
        >
          {data.title || untitled}
        </span>
        <span className="shrink-0 text-[13px] text-(--np-deep) opacity-50">
          <kbd className="rounded-[4px] border border-(--np-deep)/40 px-1.5 py-0.5 text-[11px] font-semibold">
            Esc
          </kbd>{' '}
          to close
        </span>
        {/* flip to the other size without going back to the card */}
        <button
          type="button"
          onClick={() => expandNode(node.id, full ? 'panel' : 'full')}
          title={full ? 'Dock to the side' : 'Go full screen'}
          className={CHIP_BUTTON}
        >
          {full ? (
            <PanelRightOpen className="h-[25px] w-[25px]" />
          ) : (
            <Maximize2 className="h-[22px] w-[22px]" />
          )}
        </button>
        <button
          type="button"
          onClick={collapseExpanded}
          title={full ? 'Close full screen (Esc)' : 'Close side panel (Esc)'}
          className={CHIP_BUTTON}
        >
          {full ? (
            <Minimize2 className="h-[22px] w-[22px]" />
          ) : (
            <PanelRightClose className="h-[25px] w-[25px]" />
          )}
        </button>
      </div>

      {chat ? (
        <div className={`flex min-h-0 flex-1 flex-col px-2 ${reading}`}>
          <ChatBody id={node.id} focused inPanel />
        </div>
      ) : isNote(node) ? (
        <div className={`flex min-h-0 flex-1 flex-col px-2 pb-1 ${reading}`}>
          <NoteBody id={node.id} focused inPanel />
        </div>
      ) : isLink(node) ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          {node.data.url ? (
            <TabBrowser id={node.id} url={node.data.url} focused swipeNav />
          ) : (
            <LinkSearch id={node.id} active />
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <FileBody id={node.id} focused />
        </div>
      )}
    </aside>
  )
}
