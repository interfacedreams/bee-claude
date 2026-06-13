/**
 * The dark veil flanking a full-page node — clicking it exits page mode,
 * like clicking off a modal.
 *
 * It renders *inside* the page node, not as a canvas overlay: the node's
 * boosted z-index covers its whole subtree, so this is the only place that
 * paints above every other node while staying under the page itself. The
 * page is full-height, so two side strips (stretched a viewport-width past
 * each edge) tint everything the page doesn't cover, without darkening the
 * page's own translucent body.
 */
export default function PageBackdrop({ onExit }: { onExit: () => void }): React.JSX.Element {
  const strip = (side: 'left' | 'right'): React.JSX.Element => (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onExit()
      }}
      className="nodrag absolute top-0 bottom-0"
      style={{
        [side === 'left' ? 'right' : 'left']: '100%',
        width: '100vw',
        background: 'rgba(0, 0, 0, 0.4)'
      }}
    />
  )
  return (
    <>
      {strip('left')}
      {strip('right')}
    </>
  )
}
