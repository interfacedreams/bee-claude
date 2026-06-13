import { PanelRight } from 'lucide-react'

/**
 * What a node's canvas card shows in place of its body while the content is
 * docked in the side panel. Clicking it brings the content back (closes the
 * panel) — the same toggle as the header chip.
 */
export default function DockedStub({ onClick }: { onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Close the side panel"
      className="nodrag flex min-h-[120px] flex-1 cursor-pointer flex-col items-center justify-center gap-2 text-(--np-deep) opacity-50 transition-opacity hover:opacity-80"
    >
      <PanelRight className="h-8 w-8" />
      <span className="text-[14px] font-medium">Open in the side panel</span>
    </button>
  )
}
