import { Maximize2, Minimize2, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { CHIP_BUTTON } from '../lib/nodeChrome'
import type { PanelMode } from '../store/canvas'

/**
 * The two header chips every node card carries: open in the right-docked side
 * panel, or open full screen. Each chip toggles its own mode (and flips from
 * the other), so a card open in one size can jump straight to the other. The
 * active mode's chip wears its "close" icon. Mirrors the chips ExpandedPanel
 * shows in the open header.
 */
export default function PanelChips({
  mode,
  open
}: {
  mode: PanelMode | null
  open: (mode: PanelMode) => void
}): React.JSX.Element {
  return (
    <>
      <button
        type="button"
        onClick={() => open('panel')}
        title={mode === 'panel' ? 'Close side panel (Esc)' : 'Open in side panel'}
        className={CHIP_BUTTON}
      >
        {mode === 'panel' ? (
          <PanelRightClose className="h-[25px] w-[25px]" />
        ) : (
          <PanelRightOpen className="h-[25px] w-[25px]" />
        )}
      </button>
      <button
        type="button"
        onClick={() => open('full')}
        title={mode === 'full' ? 'Close full screen (Esc)' : 'Open full screen'}
        className={CHIP_BUTTON}
      >
        {mode === 'full' ? (
          <Minimize2 className="h-[22px] w-[22px]" />
        ) : (
          <Maximize2 className="h-[22px] w-[22px]" />
        )}
      </button>
    </>
  )
}
