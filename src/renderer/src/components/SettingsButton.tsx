import { useEffect } from 'react'
import { Settings, X } from 'lucide-react'
import { useSettingsStore } from '../store/settings'

/**
 * Gear-icon pill next to the key button. Opens the global settings modal:
 * app-wide permission toggles that apply to every folder and chat. Permission
 * prompts also deep-link here via their "global settings" link. Flipping a
 * toggle takes effect immediately — even a prompt already on screen resolves
 * itself if the new setting covers it.
 */
function ToggleRow({
  label,
  description,
  checked,
  onChange
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-[#F2EDD8]"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-neutral-800">{label}</div>
        <div className="text-[12px] text-neutral-500">{description}</div>
      </div>
      <div
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-[#C9A227]' : 'bg-neutral-300'
        }`}
      >
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </div>
    </button>
  )
}

export default function SettingsButton(): React.JSX.Element {
  const open = useSettingsStore((s) => s.modalOpen)
  const setOpen = useSettingsStore((s) => s.setModalOpen)
  const permissions = useSettingsStore((s) => s.permissions)
  const loadFailed = useSettingsStore((s) => s.loadFailed)
  const load = useSettingsStore((s) => s.load)
  const update = useSettingsStore((s) => s.update)

  // Load on mount, and retry every time the modal opens unloaded.
  useEffect(() => {
    if (!permissions) void load()
  }, [open, permissions, load])

  const anyAuto = permissions?.allowWebSearch || permissions?.autoAllowAll

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Global settings"
        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[14px] border border-[#E2DAC0] bg-[#FFFDF6] text-[#92690B] shadow-lg transition-colors hover:bg-[#F2EDD8]"
      >
        <Settings className="h-4 w-4" fill={anyAuto ? 'currentColor' : 'none'} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-[440px] rounded-[14px] border border-[#E2DAC0] bg-[#FFFDF6] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#92690B]">
                <Settings className="h-4 w-4" />
                Global settings
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[#92690B] transition-colors hover:bg-[#F2EDD8]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-3 text-[12px] text-neutral-600">
              Tool permissions for every folder and chat. Changes apply immediately — a prompt
              already waiting on screen is answered too.
            </p>

            {permissions ? (
              <div className="flex flex-col gap-1">
                <ToggleRow
                  label="Allow web search"
                  description="Run WebSearch and WebFetch without asking each time."
                  checked={permissions.allowWebSearch}
                  onChange={(checked) => void update({ allowWebSearch: checked })}
                />
                <ToggleRow
                  label="Auto-allow all tools"
                  description="Skip permission prompts entirely — every tool runs unasked."
                  checked={permissions.autoAllowAll}
                  onChange={(checked) => void update({ autoAllowAll: checked })}
                />
              </div>
            ) : loadFailed ? (
              <p className="text-[12px] text-red-600">
                Couldn’t load the settings — fully restart the app and try again.
              </p>
            ) : (
              <p className="text-[12px] text-neutral-400">Loading…</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
