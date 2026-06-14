import { useMemo, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { Bookmark, FileCode2, Minus, Plus } from 'lucide-react'
import { useCanvasStore, isNote, type CanvasNode } from '../store/canvas'
import { paletteFor } from '../lib/palette'

// Same paper as the other corner legends — one family.
const PAPER = '#FFFDF6'

/**
 * "Memory" legend on the canvas's left edge: the durable context every new chat
 * sees. At the top, a CLAUDE.md jump link (the project's always-on
 * instructions); beneath it, the pinned notes that make up the project memory
 * index. Clicking any entry centers the viewport on its node (the same jump the
 * Recent panel does). The app owns the index end to end — the user curates it
 * only by pinning and unpinning notes; the generated MEMORY.md itself is no
 * longer shown here (the pinned list above is the same information, legible),
 * and the Info popover explains how the index is built.
 *
 * Always present (CLAUDE.md alone is enough to populate it). Positioning is
 * owned by the top-left overlay container in Canvas, which stacks it under the
 * Actions legend.
 */
export default function MemoryLegend(): React.JSX.Element | null {
  const nodes = useCanvasStore((s) => s.nodes)
  const toggleMinimize = useCanvasStore((s) => s.toggleMinimize)
  const { fitView } = useReactFlow()
  const [collapsed, setCollapsed] = useState(false)

  const pinned = useMemo(() => nodes.filter((n) => isNote(n) && n.data.pinned), [nodes])
  // The always-present CLAUDE.md node — surfaced here as a jump link so the
  // project's instructions are reachable from the same "what the agent sees" panel.
  const claudeMd = useMemo(
    () => nodes.find((n) => isNote(n) && n.data.system === 'claudeMd'),
    [nodes]
  )

  const focusNode = (node: CanvasNode): void => {
    const fit = (): void => {
      void fitView({ nodes: [{ id: node.id }], duration: 300, padding: 0.1, maxZoom: 1 })
    }
    if (node.data.minimized) {
      toggleMinimize(node.id)
      setTimeout(fit, 50)
    } else {
      fit()
    }
  }

  // Nothing to show — no CLAUDE.md node yet and nothing pinned.
  if (!claudeMd && pinned.length === 0) return null

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="Show project memory"
        className="flex cursor-pointer items-center gap-1.5 rounded-[14px] border border-[#E2DAC0] bg-[#FFFDF6] px-3.5 py-2 text-[12px] font-semibold text-[#92690B] shadow-lg transition-colors hover:bg-[#F2EDD8]"
      >
        <Plus className="h-3.5 w-3.5" />
        Memory
      </button>
    )
  }

  return (
    <aside
      className="flex max-h-[clamp(240px,40vh,520px)] w-56 flex-col overflow-hidden rounded-[14px] border border-[#E2DAC0] shadow-lg"
      style={{ backgroundColor: PAPER }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[#E2DAC0] py-1.5 pl-3.5 pr-1.5">
        <h2 className="text-[12px] font-semibold text-[#92690B]">Memory</h2>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          title="Hide project memory"
          className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md bg-[#F2EDD8] text-[#92690B] transition-colors hover:bg-[#E2DAC0]"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto p-1">
        {/* CLAUDE.md — the project's instructions, every chat sees them. Click
            to jump to its node on the canvas (same as a pinned note). */}
        {claudeMd && (
          <button
            type="button"
            onClick={() => focusNode(claudeMd)}
            title="The project's CLAUDE.md — instructions every chat sees"
            className="flex w-full cursor-pointer items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left transition-colors hover:bg-[#F2EDD8]"
          >
            <FileCode2 className="h-3.5 w-3.5 shrink-0 text-[#92690B]" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#92690B]">
              CLAUDE.md
            </span>
          </button>
        )}

        {claudeMd && pinned.length > 0 && <div className="my-1 border-t border-[#EFE7CC]" />}

        {pinned.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => focusNode(n)}
            title={n.data.title || 'Untitled note'}
            className={`flex w-full cursor-pointer items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left transition-colors hover:bg-[#F2EDD8] ${
              n.selected ? 'bg-[#F2EDD8]' : ''
            }`}
          >
            <Bookmark
              className="h-3 w-3 shrink-0"
              style={{ color: paletteFor(n.data.color).accent }}
              fill="currentColor"
            />
            <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-800">
              {n.data.title || <span className="text-neutral-400 italic">Untitled note</span>}
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}
