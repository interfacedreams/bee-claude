import { useState } from 'react'
import { useReactFlow, type Viewport } from '@xyflow/react'
import { ChevronDown, Folder } from 'lucide-react'
import { useCanvasStore } from '../store/canvas'
import { useSpawn } from '../lib/useSpawn'

// New chat / new note buttons that sit beneath the repo chip: a written-out
// label plus a keycap badge showing the bare-letter shortcut.
const SPAWN_BUTTON =
  'flex cursor-pointer items-center gap-2 rounded-[14px] border border-[#EDD27E] bg-[#FEF3C7] px-3 py-1.5 text-[13px] font-medium text-[#92690B] shadow-lg transition-colors hover:bg-[#FDE68A] active:scale-95'
const KEYCAP =
  'flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-[#EDD27E] bg-white/70 px-1 text-[11px] font-semibold shadow-[0_1.5px_0_#EDD27E]'

/**
 * Current-repo indicator (top right) with a dropdown of recent repos —
 * any repo you've chatted in is one click away. Switching repos swaps
 * the whole canvas, so it's blocked while a reply is streaming.
 * New-chat / new-note buttons live just beneath it.
 */
export default function RepoChip(): React.JSX.Element | null {
  const repo = useCanvasStore((s) => s.repo)
  const chooseRepo = useCanvasStore((s) => s.chooseRepo)
  const selectRepo = useCanvasStore((s) => s.selectRepo)
  const anyStreaming = useCanvasStore((s) => s.nodes.some((n) => n.data.status === 'streaming'))
  const [open, setOpen] = useState(false)
  const { setViewport } = useReactFlow()
  const spawn = useSpawn()

  if (!repo) return null // repo state not fetched yet

  const apply = (vp: Viewport | null): void => {
    if (vp) void setViewport(vp)
  }
  const handleChoose = async (): Promise<void> => {
    setOpen(false)
    apply(await chooseRepo())
  }
  const handleSelect = async (path: string): Promise<void> => {
    setOpen(false)
    apply(await selectRepo(path))
  }

  const name = repo.current ? (repo.current.split('/').pop() ?? repo.current) : 'Open repo…'

  return (
    <div className="fixed top-4 right-4 z-20">
      <button
        type="button"
        onClick={() => (repo.current ? setOpen((o) => !o) : void handleChoose())}
        title={repo.current ?? 'Choose a repository'}
        className="flex max-w-[280px] cursor-pointer items-center gap-2 rounded-[14px] border border-[#EDD27E] bg-[#FEF3C7] px-3 py-1.5 text-[13px] font-medium text-[#92690B] shadow-lg transition-colors hover:bg-[#FDE68A]"
      >
        <Folder className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{name}</span>
        {repo.current && <ChevronDown className="h-3 w-3 shrink-0" />}
      </button>

      {repo.current && !open && (
        <div className="mt-2 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => spawn('chat')}
            title="New chat (C)"
            className={SPAWN_BUTTON}
          >
            <span>New Chat</span>
            <span className={KEYCAP}>C</span>
          </button>
          <button
            type="button"
            onClick={() => spawn('note')}
            title="New note (N)"
            className={SPAWN_BUTTON}
          >
            <span>New Note</span>
            <span className={KEYCAP}>N</span>
          </button>
        </div>
      )}

      {open && (
        <>
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-80 overflow-hidden rounded-[14px] border border-[#EDD27E] bg-white shadow-xl">
            {anyStreaming && (
              <div className="border-b border-[#EDD27E]/60 bg-[#FEF3C7]/50 px-3 py-2 text-[12px] text-[#92690B]">
                Wait for replies to finish before switching repos.
              </div>
            )}
            {repo.recents.map((r) => {
              const isCurrent = r.path === repo.current
              return (
                <button
                  key={r.path}
                  type="button"
                  disabled={anyStreaming || isCurrent}
                  onClick={() => void handleSelect(r.path)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                    isCurrent ? '' : 'cursor-pointer hover:bg-[#FEF3C7]/60'
                  } ${anyStreaming && !isCurrent ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      isCurrent ? 'bg-[#E2BF52]' : 'bg-transparent'
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-neutral-800">
                      {r.name}
                    </span>
                    <span className="block truncate text-[11px] text-neutral-400">{r.path}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-neutral-400">
                    {r.chatCount} chat{r.chatCount === 1 ? '' : 's'}
                  </span>
                </button>
              )
            })}
            <button
              type="button"
              disabled={anyStreaming}
              onClick={() => void handleChoose()}
              className={`w-full border-t border-[#EDD27E]/60 px-3 py-2 text-left text-[13px] font-medium text-[#92690B] transition-colors ${
                anyStreaming ? 'opacity-50' : 'cursor-pointer hover:bg-[#FEF3C7]/60'
              }`}
            >
              Open another repo…
            </button>
          </div>
        </>
      )}
    </div>
  )
}
