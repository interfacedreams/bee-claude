import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, type LucideIcon } from 'lucide-react'

export interface ModalTab {
  id: string
  label: string
  icon: LucideIcon
}

/**
 * The shared modal shell for the bottom-left dialogs (Settings, Info): a true
 * centered modal over a dark backdrop, with a top row of icon + label tabs and
 * a scrollable content panel beneath. Callers own tab state and render the
 * active tab's content as children. One visual vocabulary for every config/help
 * sheet.
 *
 * Rendered through a portal to document.body so the backdrop escapes the
 * bottom-left toolbar's stacking context (z-10) and actually dims everything —
 * the corner legends and top-right pickers (z-20) included.
 */
export default function TabbedModal({
  title,
  titleIcon: TitleIcon,
  tabs,
  active,
  onTab,
  onClose,
  children
}: {
  title: string
  titleIcon: LucideIcon
  tabs: ModalTab[]
  active: string
  onTab: (id: string) => void
  onClose: () => void
  children: React.ReactNode
}): React.JSX.Element {
  // Escape closes, like any modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="flex h-[420px] w-[600px] flex-col overflow-hidden rounded-[14px] border border-[#E2DAC0] bg-[#FFFDF6] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar: title + horizontal icon/label tabs + close */}
        <div className="flex shrink-0 items-center gap-2 border-b border-[#E2DAC0] bg-[#FBF7E9] px-3 py-2">
          <h2 className="mr-1 flex items-center gap-2 px-1.5 text-[13px] font-semibold text-[#92690B]">
            <TitleIcon className="h-4 w-4" />
            {title}
          </h2>
          {tabs.map((t) => {
            const Icon = t.icon
            const isActive = t.id === active
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTab(t.id)}
                className={`flex cursor-pointer items-center gap-2 rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  isActive ? 'bg-[#F2EDD8] text-[#92690B]' : 'text-neutral-600 hover:bg-[#F2EDD8]/60'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t.label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#92690B] transition-colors hover:bg-[#F2EDD8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content: the active tab's body */}
        <div className="relative flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body
  )
}
