import { useState } from 'react'
import { useReactFlow, type Viewport } from '@xyflow/react'
import { ChevronDown, ChevronRight, Folder } from 'lucide-react'
import { useCanvasStore } from '../store/canvas'

/**
 * The repo chip at the top of the left column. At the root it's just the folder
 * name with a dropdown of recent folders — any folder you've worked in is one
 * click away. Once you've descended into a subfolder (via the Folders legend) it
 * grows a breadcrumb, "repo › subfolder", whose first crumb climbs back to the
 * root. Switching the whole repo swaps the canvas, so it's blocked while a reply
 * streams.
 */
export default function FolderChip(): React.JSX.Element | null {
  const folder = useCanvasStore((s) => s.folder)
  const chooseFolder = useCanvasStore((s) => s.chooseFolder)
  const selectFolder = useCanvasStore((s) => s.selectFolder)
  const enterFolder = useCanvasStore((s) => s.enterFolder)
  const anyStreaming = useCanvasStore((s) => s.nodes.some((n) => n.data.status === 'streaming'))
  const [open, setOpen] = useState(false)
  const { setViewport } = useReactFlow()

  if (!folder) return null // folder state not fetched yet

  const apply = (vp: Viewport | null): void => {
    if (vp) void setViewport(vp)
  }
  const handleChoose = async (): Promise<void> => {
    setOpen(false)
    apply(await chooseFolder())
  }
  const handleSelect = async (path: string): Promise<void> => {
    setOpen(false)
    apply(await selectFolder(path))
  }
  const handleUp = async (): Promise<void> => {
    setOpen(false)
    apply(await enterFolder(null))
  }

  // The breadcrumb home — the repo root. Falls back to the current folder when
  // `root` is absent (e.g. a main process that predates folder navigation).
  const home = folder.root ?? folder.current
  const rootName = home ? (home.split('/').pop() ?? home) : 'Open folder…'
  // We're inside a subfolder when the canvas root sits below the repo root.
  const subName =
    folder.current && folder.root && folder.current !== folder.root
      ? (folder.current.split('/').pop() ?? null)
      : null

  // No folder open yet — a single button that launches the picker.
  if (!folder.current) {
    return (
      <button
        type="button"
        onClick={() => void handleChoose()}
        className="flex max-w-[280px] cursor-pointer items-center gap-2 rounded-[6px] border border-black bg-black px-3 py-1.5 text-[13px] font-medium text-white shadow-md transition-colors hover:bg-neutral-800"
      >
        <Folder className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{rootName}</span>
      </button>
    )
  }

  return (
    <div className="relative w-fit">
      <div className="flex max-w-[320px] items-center gap-1 rounded-[6px] border border-black bg-black px-2.5 py-1.5 text-[13px] font-medium text-white shadow-md">
        <Folder className="h-3.5 w-3.5 shrink-0" />
        {/* Root crumb: climbs back up when we're inside a subfolder. */}
        <button
          type="button"
          onClick={() => (subName ? void handleUp() : setOpen((o) => !o))}
          title={subName ? `Back to ${rootName}` : (home ?? '')}
          className={`min-w-0 truncate ${subName ? 'cursor-pointer text-white/70 hover:text-white' : 'cursor-pointer'}`}
        >
          {rootName}
        </button>
        {subName && (
          <>
            <ChevronRight className="h-3 w-3 shrink-0 text-white/50" />
            <span className="min-w-0 truncate">{subName}</span>
          </>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title="Switch folder"
          className="ml-0.5 flex shrink-0 cursor-pointer items-center text-white/70 hover:text-white"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-80 overflow-hidden rounded-[6px] border border-black bg-white shadow-xl">
            {anyStreaming && (
              <div className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-[12px] text-neutral-500">
                Wait for replies to finish before switching folders.
              </div>
            )}
            {folder.recents.map((r) => {
              const isCurrent = r.path === folder.current
              return (
                <button
                  key={r.path}
                  type="button"
                  disabled={anyStreaming || isCurrent}
                  onClick={() => void handleSelect(r.path)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                    isCurrent ? '' : 'cursor-pointer hover:bg-neutral-100'
                  } ${anyStreaming && !isCurrent ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      isCurrent ? 'bg-black' : 'bg-transparent'
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
              className={`w-full border-t border-neutral-200 px-3 py-2 text-left text-[13px] font-medium text-black transition-colors ${
                anyStreaming ? 'opacity-50' : 'cursor-pointer hover:bg-neutral-100'
              }`}
            >
              Open another folder…
            </button>
          </div>
        </>
      )}
    </div>
  )
}
