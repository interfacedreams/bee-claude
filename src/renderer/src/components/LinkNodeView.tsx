import { memo, useEffect, useRef, useState } from 'react'
import {
  Handle,
  NodeResizeControl,
  Position,
  ResizeControlVariant,
  type NodeProps
} from '@xyflow/react'
import {
  ArrowLeft,
  ArrowRight,
  Expand,
  Globe,
  Minus,
  Pencil,
  RotateCw,
  Search,
  Shrink,
  Trash2
} from 'lucide-react'
import { useCanvasStore, MAX_NODE_H, type LinkNode } from '../store/canvas'
import { paletteFor } from '../lib/palette'
import { registerGuest, unregisterGuest } from '../lib/pageText'
import { usePageExpand } from '../lib/usePageExpand'
import PageBackdrop from './PageBackdrop'
import { BROWSE_PARTITION } from '../../../shared/types'
import {
  CHIP_BUTTON,
  CTX_HANDLE_ID,
  ctxHandleStyle,
  DRAG_HEADER,
  HIDDEN_HANDLE
} from '../lib/nodeChrome'

// Same paper fill as notes and file nodes.
const PAPER = '#FFFDF6'

// Pages scroll inside the card, so the frame is a window — resize freely.
const RESIZE_LIMITS = { minWidth: 280, minHeight: 160, maxHeight: MAX_NODE_H }

// Some sites refuse to render for an unknown "Electron" browser — the guest
// announces itself as the plain Chrome this Chromium actually is.
const CLEAN_UA = navigator.userAgent.replace(/\s(?:bee-claude|Electron)\/\S+/g, '')

// Where a search goes.
const SEARCH_URL = 'https://www.google.com/search?q='

// The <webview> methods the tab's toolbar drives. React's HTMLWebViewElement
// is a bare HTMLElement; Electron attaches these once the guest is attached.
interface WebviewEl extends HTMLElement {
  loadURL(url: string): Promise<void>
  getURL(): string
  reload(): void
  goBack(): void
  goForward(): void
  canGoBack(): boolean
  canGoForward(): boolean
  executeJavaScript(code: string): Promise<unknown>
}

/** One box, two jobs: a URL navigates, anything else becomes a Google search
 *  ('' only for blank input). */
function toNavigableUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  try {
    if (/^https?:\/\//i.test(t)) return new URL(t).href
    // a bare domain like nuwapen.com/about — same shape canvas paste accepts
    if (!/\s/.test(t) && /^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(t)) {
      return new URL(`https://${t}`).href
    }
  } catch {
    // unparsable — treat it as a search
  }
  return `${SEARCH_URL}${encodeURIComponent(t)}`
}

function LinkNodeView({ id, data, selected }: NodeProps<LinkNode>): React.JSX.Element {
  const setTitle = useCanvasStore((s) => s.setTitle)
  const setLinkUrl = useCanvasStore((s) => s.setLinkUrl)
  const requestDelete = useCanvasStore((s) => s.requestDelete)
  const toggleMinimize = useCanvasStore((s) => s.toggleMinimize)
  const setCtxConnectSource = useCanvasStore((s) => s.setCtxConnectSource)
  const armed = useCanvasStore((s) => s.ctxConnectSource === id)
  const { isPage, togglePage } = usePageExpand(id)

  const titleRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const [editingTitle, setEditingTitle] = useState(false)
  if (data.minimized && editingTitle) setEditingTitle(false)

  // The birth state: no URL yet, the body is one search-or-link box.
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!editingTitle) return
    titleRef.current?.focus()
    titleRef.current?.select()
  }, [editingTitle])

  // Type-and-Enter without an extra click: the box takes the keyboard the
  // moment the tab is born.
  useEffect(() => {
    if (data.url || data.minimized) return
    searchRef.current?.focus()
  }, [data.url, data.minimized])

  const commitDraft = (): void => {
    const url = toNavigableUrl(draft)
    if (url) setLinkUrl(id, url)
  }

  const palette = paletteFor(data.color)

  return (
    <div
      style={
        {
          backgroundColor: isPage ? PAPER : `${PAPER}D9`, // solid as a page
          '--np-bg': palette.bg,
          '--np-edge': palette.edge,
          '--np-chip': `${palette.edge}99`,
          '--np-accent': palette.accent,
          '--np-deep': palette.deep,
          '--np-ring': `${palette.accent}B3`
        } as React.CSSProperties
      }
      className={`flex h-full w-full flex-col border border-(--np-edge) shadow-md ${
        isPage ? '' : 'rounded-[14px]'
      } ${selected ? 'ring-2 ring-(--np-ring)' : ''}`}
    >
      {isPage && <PageBackdrop onExit={togglePage} />}
      {/* hidden layout anchors (left/right) for any future edges */}
      <Handle type="target" position={Position.Left} isConnectable={false} style={HIDDEN_HANDLE} />
      <Handle type="source" position={Position.Right} isConnectable={false} style={HIDDEN_HANDLE} />
      {/* the context connector: drag this circle onto a chat's circle — or
          tap it and the arrow follows the cursor until a click on a chat
          commits (ContextConnectOverlay) — to let that chat read this page
          (each send extracts the rendered page from this tab's guest;
          WebFetch is the fallback when the guest isn't mounted) */}
      <Handle
        id={CTX_HANDLE_ID}
        type="source"
        position={Position.Bottom}
        isConnectable
        isConnectableEnd={false}
        title="Drag — or tap, then click a chat — to attach this page as context"
        onClick={(e) => {
          // keep the tap from reaching the overlay's window listener,
          // which treats any stray click as cancel
          e.stopPropagation()
          setCtxConnectSource(armed ? null : id)
        }}
        className={`ctx-handle ${armed ? 'ctx-armed' : ''}`}
        style={ctxHandleStyle(palette.accent, 'bottom')}
      />

      {!data.minimized && !isPage && data.url && (
        <>
          <NodeResizeControl
            position="right"
            variant={ResizeControlVariant.Line}
            {...RESIZE_LIMITS}
            style={{ borderColor: 'transparent', borderWidth: 5 }}
          />
          <NodeResizeControl
            position="bottom"
            variant={ResizeControlVariant.Line}
            {...RESIZE_LIMITS}
            style={{ borderColor: 'transparent', borderWidth: 5 }}
          />
          <NodeResizeControl
            position="bottom-right"
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

      {/* The colored header band only exists before a URL (drag/delete home
          for the search box) and as the minimized chip — a live tab's browser
          toolbar is its chrome, so a second bar would be redundant. */}
      {(!data.url || data.minimized) && (
        <div
          style={{ backgroundColor: isPage ? palette.bg : `${palette.bg}D9` }}
          className={`${isPage ? '' : DRAG_HEADER} flex shrink-0 items-center gap-2 px-3 py-1.5 ${
            isPage
              ? 'border-b border-(--np-edge)'
              : data.minimized
                ? 'rounded-[13px]'
                : 'rounded-t-[13px] border-b border-(--np-edge)'
          }`}
        >
          {!data.minimized && !isPage && (
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
            onClick={togglePage}
            title={isPage ? 'Exit full page (Esc)' : 'Open full page'}
            className={CHIP_BUTTON}
          >
            {isPage ? (
              <Shrink className="h-[25px] w-[25px]" />
            ) : (
              <Expand className="h-[25px] w-[25px]" />
            )}
          </button>
          {editingTitle && !data.minimized ? (
            <input
              ref={titleRef}
              value={data.title}
              placeholder="Untitled tab"
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
              {data.title || 'Untitled tab'}
            </span>
          )}
          {/* where the tab is right now — data.url tracks every navigation, so
            this reads true even minimized or zoomed out (title is flex-1, so
            the URL sits against the buttons) */}
          {data.url && (
            <span
              title={data.url}
              className="max-w-[45%] shrink-[2] truncate text-[17px] text-(--np-deep) opacity-60"
            >
              {data.url.replace(/^https?:\/\/(www\.)?/, '')}
            </span>
          )}
          <div className="nodrag relative ml-auto flex shrink-0 items-center gap-1">
            {!data.minimized && (
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                title="Rename this tab"
                className={CHIP_BUTTON}
              >
                <Pencil className="h-[25px] w-[25px]" />
              </button>
            )}
            <button
              type="button"
              onClick={() => requestDelete(id)}
              title="Delete this tab"
              className={CHIP_BUTTON}
            >
              <Trash2 className="h-[25px] w-[25px]" />
            </button>
          </div>
        </div>
      )}

      {!data.minimized && (
        // The body is the page (scroll, not drag) — the browser toolbar
        // (or the birth-state header band) moves the node.
        <div
          className={`min-h-0 flex-1 overflow-hidden ${
            isPage ? '' : data.url ? 'rounded-[13px]' : 'rounded-b-[13px]'
          }`}
        >
          {!data.url ? (
            <form
              className="flex h-full w-full items-center gap-2 px-3"
              onSubmit={(e) => {
                e.preventDefault()
                commitDraft()
              }}
            >
              <Search className="h-5 w-5 shrink-0 text-(--np-deep) opacity-60" />
              <input
                ref={searchRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Search Google or paste a link"
                spellCheck={false}
                className="nodrag min-w-0 flex-1 cursor-text rounded-[10px] border border-(--np-edge) bg-white px-3 py-2 text-[15px] text-neutral-800 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-(--np-ring)"
              />
            </form>
          ) : (
            // full-page, the page always gets the pointer — no select-first click
            <TabBrowser
              id={id}
              url={data.url}
              focused={!!selected || isPage}
              isPage={isPage}
              togglePage={togglePage}
            />
          )}
        </div>
      )}
    </div>
  )
}

const TOOL_BUTTON =
  'nodrag flex shrink-0 cursor-pointer items-center justify-center rounded-[6px] p-1 text-(--np-deep) ' +
  'transition-colors hover:bg-(--np-chip) disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent'

/**
 * The tab: an Electron <webview> guest under a slim browser toolbar. A guest
 * is its own top-level frame, so X-Frame-Options / frame-ancestors can't
 * refuse it the way they would an iframe (which is why google.com works here
 * at all), and it scrolls natively.
 *
 * All tabs share one session partition — their own persistent cookie jar,
 * logged into nothing in the app or the user's browser. Pop-opens
 * (target=_blank, window.open) navigate the same guest: one tab per card, by
 * design (main's window-open handler routes them back via the partition).
 *
 * The guest mounts once on the URL the tab was born with; from there the user
 * browses inside it (results, links, the address box), and every navigation
 * syncs back to the node's data.url — that's what a context edge hands to a
 * chat, and where the tab reopens on canvas reload.
 *
 * Focus-gating follows the transcript convention by other means — wheel
 * events over a guest never reach the embedder, so an unfocused card lays a
 * transparent shield over the page instead: clicks select the node (which
 * lifts the shield) and wheels bubble to the pane as a canvas pan. Focused,
 * the page gets the pointer for real — scroll it, click around it.
 */
function TabBrowser({
  id,
  url,
  focused,
  isPage,
  togglePage
}: {
  id: string
  url: string
  focused: boolean
  isPage: boolean
  togglePage: () => void
}): React.JSX.Element {
  const webviewRef = useRef<HTMLWebViewElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const wv = (): WebviewEl | null => webviewRef.current as WebviewEl | null

  // The guest's src is fixed to the birth URL: navigation happens through
  // loadURL and in-page clicks, never by remounting (a remount would wipe the
  // guest's own history). data.url changing back to us is just our own sync.
  const [initialUrl] = useState(url)

  const [address, setAddress] = useState(url) // what's in the box (mid-edit)
  const [pageUrl, setPageUrl] = useState(url) // what's actually loaded
  const [canBack, setCanBack] = useState(false)
  const [canFwd, setCanFwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    const el = wv()
    if (!el) return
    // While the guest lives, sends can read its rendered page (pageText) —
    // a minimized tab unmounts the guest, so its link falls back to WebFetch.
    registerGuest(id, el)
    const sync = (): void => {
      const current = el.getURL()
      setPageUrl(current)
      setCanBack(el.canGoBack())
      setCanFwd(el.canGoForward())
      // never clobber an address the user is mid-typing
      if (document.activeElement !== inputRef.current) setAddress(current)
      useCanvasStore.getState().syncTabUrl(id, current)
    }
    const onNavigate = (): void => {
      setFailed(null)
      sync()
    }
    const onStart = (): void => setLoading(true)
    const onStop = (): void => {
      setLoading(false)
      sync()
    }
    const onFail = (e: Event): void => {
      const ev = e as Event & { errorCode: number; errorDescription: string; isMainFrame: boolean }
      // -3 is ERR_ABORTED — routine for redirects and in-page navigations
      if (ev.isMainFrame && ev.errorCode !== -3) {
        setFailed(ev.errorDescription || `error ${ev.errorCode}`)
      }
    }
    el.addEventListener('did-navigate', onNavigate)
    el.addEventListener('did-navigate-in-page', sync)
    el.addEventListener('did-start-loading', onStart)
    el.addEventListener('did-stop-loading', onStop)
    el.addEventListener('did-fail-load', onFail)
    return () => {
      unregisterGuest(id, el)
      el.removeEventListener('did-navigate', onNavigate)
      el.removeEventListener('did-navigate-in-page', sync)
      el.removeEventListener('did-start-loading', onStart)
      el.removeEventListener('did-stop-loading', onStop)
      el.removeEventListener('did-fail-load', onFail)
    }
  }, [id])

  const go = (): void => {
    const next = toNavigableUrl(address)
    if (!next) return
    setFailed(null)
    // rejections (aborted loads) also surface via did-fail-load — ignore here
    void wv()
      ?.loadURL(next)
      .catch(() => {})
    inputRef.current?.blur() // hand the keyboard to the page
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* The toolbar IS the tab's header: drag surface, node color, and the
          card controls (minimize / full page / delete) on the right. */}
      <div
        style={{
          backgroundColor: isPage
            ? 'var(--np-bg)'
            : 'color-mix(in srgb, var(--np-bg) 85%, transparent)'
        }}
        className={`${isPage ? '' : DRAG_HEADER} flex shrink-0 items-center gap-1 border-b border-(--np-edge) px-2 py-1`}
      >
        <button
          type="button"
          onClick={() => wv()?.goBack()}
          disabled={!canBack}
          title="Back"
          className={TOOL_BUTTON}
        >
          <ArrowLeft className="h-[20px] w-[20px]" />
        </button>
        <button
          type="button"
          onClick={() => wv()?.goForward()}
          disabled={!canFwd}
          title="Forward"
          className={TOOL_BUTTON}
        >
          <ArrowRight className="h-[20px] w-[20px]" />
        </button>
        <button type="button" onClick={() => wv()?.reload()} title="Reload" className={TOOL_BUTTON}>
          <RotateCw className={`h-[20px] w-[20px] ${loading ? 'animate-spin' : ''}`} />
        </button>
        <form
          className="min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            go()
          }}
        >
          <input
            ref={inputRef}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              // Escape backs out to the loaded page's URL
              if (e.key === 'Escape') {
                e.preventDefault()
                setAddress(pageUrl)
                e.currentTarget.blur()
              }
            }}
            placeholder="Search Google or paste a link"
            spellCheck={false}
            className="nodrag w-full cursor-text rounded-[8px] border border-(--np-edge) bg-white px-2.5 py-1 text-[14px] text-neutral-800 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-(--np-ring)"
          />
        </form>
        {!isPage && (
          <button
            type="button"
            onClick={() => useCanvasStore.getState().toggleMinimize(id)}
            title="Minimize"
            className={TOOL_BUTTON}
          >
            <Minus className="h-[20px] w-[20px]" />
          </button>
        )}
        <button
          type="button"
          onClick={togglePage}
          title={isPage ? 'Exit full page (Esc)' : 'Open full page'}
          className={TOOL_BUTTON}
        >
          {isPage ? (
            <Shrink className="h-[20px] w-[20px]" />
          ) : (
            <Expand className="h-[20px] w-[20px]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => useCanvasStore.getState().requestDelete(id)}
          title="Delete this tab"
          className={TOOL_BUTTON}
        >
          <Trash2 className="h-[20px] w-[20px]" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 bg-white">
        <webview
          ref={webviewRef}
          src={initialUrl}
          // eslint-disable-next-line react/no-unknown-property -- a real <webview> attribute (in React's own types); the lint rule just doesn't know the tag
          partition={BROWSE_PARTITION}
          // eslint-disable-next-line react/no-unknown-property -- same as above
          useragent={CLEAN_UA}
          style={{ display: 'flex', width: '100%', height: '100%' }}
        />
        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white text-neutral-400">
            <Globe className="h-8 w-8" />
            <span className="max-w-full truncate px-3 text-[13px]">{pageUrl}</span>
            <span className="px-3 text-[12px]">Couldn’t load this page ({failed})</span>
          </div>
        )}
        {!focused && !failed && <div className="absolute inset-0" />}
      </div>
    </div>
  )
}

export default memo(LinkNodeView)
