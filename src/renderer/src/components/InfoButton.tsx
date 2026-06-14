import { useState } from 'react'
import { Brain, Info, LayoutGrid } from 'lucide-react'
import TabbedModal, { type ModalTab } from './TabbedModal'

/**
 * The "ⓘ" pill beside the settings gear (bottom left). Opens a tabbed modal —
 * same vocabulary as Settings — with a lightweight primer on how the canvas
 * works: an Overview of the two node kinds, and a Memory section that shows,
 * with an example, how the project memory index is built and what bookmarking a
 * note does. Read-only; purely explanatory.
 */
type Tab = 'overview' | 'memory'

const TABS: ModalTab[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'memory', label: 'Memory', icon: Brain }
]

export default function InfoButton(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="About this canvas"
        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[14px] border border-[#E2DAC0] bg-[#FFFDF6] text-[#92690B] shadow-lg transition-colors hover:bg-[#F2EDD8]"
      >
        <Info className="h-4 w-4" />
      </button>

      {open && (
        <TabbedModal
          title="Guide"
          titleIcon={Info}
          tabs={TABS}
          active={tab}
          onTab={(id) => setTab(id as Tab)}
          onClose={() => setOpen(false)}
        >
          {tab === 'overview' && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-[#92690B]">
                <LayoutGrid className="h-4 w-4" />
                Overview
              </h3>
              <p className="text-[13px] leading-relaxed text-neutral-700">
                The canvas holds two kinds of nodes: <strong>chats</strong> and{' '}
                <strong>resources</strong>. Resources — notes, files (PDFs and images), and web pages
                you browse — can feed into a chat as context, or be written by a chat as output.
                Connect them by dragging a node&rsquo;s port onto a chat.
              </p>
            </div>
          )}

          {tab === 'memory' && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-[#92690B]">
                <Brain className="h-4 w-4" />
                Memory
              </h3>
              <p className="text-[13px] leading-relaxed text-neutral-700">
                Bookmark a note (the ribbon icon on its header) to pin it into the project&rsquo;s
                memory. Pinned notes are compiled into a{' '}
                <code className="font-mono">MEMORY.md</code> index that&rsquo;s handed to every new
                chat, so the agent always knows they exist and can open them on demand.
              </p>
              <pre className="mt-3 overflow-x-auto rounded-[6px] bg-[#F7F2DF] px-3 py-2.5 text-[11px] leading-snug text-neutral-700">
                {`# Project memory

- [Auth ideas](Auth ideas.md) — Token
  refresh flow and open questions.
- [Roadmap](Roadmap.md) — Q3 priorities.`}
              </pre>
              <p className="mt-3 text-[13px] leading-relaxed text-neutral-700">
                Each line links the note&rsquo;s file with a one-line description (generated for
                you). Unpin and it drops back out. <code className="font-mono">CLAUDE.md</code> is
                separate — it&rsquo;s always in context, no pinning needed.
              </p>
            </div>
          )}
        </TabbedModal>
      )}
    </>
  )
}
