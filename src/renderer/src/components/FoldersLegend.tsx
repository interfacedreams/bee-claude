import { useState } from 'react'
import { useReactFlow, type Viewport } from '@xyflow/react'
import { Folder, Minus, Plus } from 'lucide-react'
import { useCanvasStore } from '../store/canvas'

// Same opaque paper as the other corner panels.
const PAPER = '#FFFFFF'

/**
 * "Folders" panel in the top-left column, beneath the Recent list: the
 * immediate subfolders of the open repo, plus a "+ New folder" action. Always
 * shown once a repo is open (even with no subfolders yet) so a new folder is
 * always one click away. Clicking a folder descends into it (a one-level-deep
 * navigation — the canvas swaps to that folder), and the breadcrumb then offers
 * the way back up; the list always shows the repo's subfolders, so the
 * currently-entered one is just highlighted rather than drilling further.
 * Switching is blocked while a reply streams, like the folder chip. Collapses to
 * a "+ Folders" pill like the Recent panel.
 */
export default function FoldersLegend(): React.JSX.Element | null {
  const folder = useCanvasStore((s) => s.folder)
  const enterFolder = useCanvasStore((s) => s.enterFolder)
  const createFolder = useCanvasStore((s) => s.createFolder)
  const anyStreaming = useCanvasStore((s) => s.nodes.some((n) => n.data.status === 'streaming'))
  const { setViewport } = useReactFlow()
  const [collapsed, setCollapsed] = useState(false)
  // Inline new-folder row: null when idle, the typed name while naming.
  const [draft, setDraft] = useState<string | null>(null)

  // The repo root — fall back to the current folder when `root` is absent (a
  // main process that predates folder navigation).
  const home = folder?.root ?? folder?.current
  if (!home) return null

  const subfolders = folder?.subfolders ?? []
  // The entered subfolder, if any (current sits one level below root).
  const activeName =
    folder?.current && folder.current !== home ? (folder.current.split('/').pop() ?? null) : null

  const apply = (vp: Viewport | null): void => {
    if (vp) void setViewport(vp)
  }
  const go = async (name: string | null): Promise<void> => apply(await enterFolder(name))
  const commitDraft = (): void => {
    const name = (draft ?? '').trim()
    setDraft(null)
    if (name) void createFolder(name)
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="Show folders"
        className="flex w-[calc(50%-4px)] shrink-0 cursor-pointer items-center justify-start gap-1.5 overflow-hidden rounded-[14px] border border-black bg-white px-3.5 py-2 text-[12px] font-semibold text-black shadow-lg transition-colors hover:bg-neutral-100"
      >
        <Plus className="h-3.5 w-3.5" />
        Folders
      </button>
    )
  }

  return (
    <aside
      className="flex max-h-[clamp(160px,28vh,360px)] w-full flex-col overflow-hidden rounded-[14px] border border-black shadow-lg"
      style={{ backgroundColor: PAPER }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 py-1.5 pl-3.5 pr-1.5">
        <h2 className="text-[12px] font-semibold text-black">Folders</h2>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          title="Hide folders"
          className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md bg-neutral-100 text-black transition-colors hover:bg-neutral-200"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto p-1">
        {subfolders.map((name) => {
          const active = name === activeName
          return (
            <button
              key={name}
              type="button"
              disabled={anyStreaming}
              onClick={() => void go(active ? null : name)}
              title={active ? `${name} (click to go up)` : name}
              className={`flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left transition-colors ${
                active ? 'bg-neutral-100' : 'hover:bg-neutral-100'
              } ${anyStreaming ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
            >
              <Folder className="h-3 w-3 shrink-0 text-neutral-500" />
              <span
                className={`min-w-0 flex-1 truncate text-[13px] ${
                  active ? 'font-semibold text-black' : 'text-neutral-800'
                }`}
              >
                {name}
              </span>
            </button>
          )
        })}
        {draft !== null ? (
          <div className="flex w-full items-center gap-2 rounded-[7px] bg-neutral-100 px-2.5 py-1.5">
            <Folder className="h-3 w-3 shrink-0 text-neutral-500" />
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitDraft()
                else if (e.key === 'Escape') setDraft(null)
              }}
              placeholder="Folder name"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-neutral-800 outline-none placeholder:text-neutral-400"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDraft('')}
            title="Create a new folder"
            className="flex w-full cursor-pointer items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left text-[13px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-black"
          >
            <Plus className="h-3 w-3 shrink-0" />
            <span className="min-w-0 flex-1 truncate">New folder</span>
          </button>
        )}
      </div>
    </aside>
  )
}
