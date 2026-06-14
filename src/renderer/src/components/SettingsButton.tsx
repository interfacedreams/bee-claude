import { useEffect, useState } from 'react'
import { KeyRound, Settings, Wrench } from 'lucide-react'
import { useSettingsStore } from '../store/settings'
import AuthSection from './AuthSection'
import TabbedModal, { type ModalTab } from './TabbedModal'

/**
 * Gear-icon pill in the bottom-left toolbar. Opens the global settings modal,
 * a tabbed panel covering app-wide configuration: the Claude subscription
 * token and tool permission toggles that apply to every folder and chat.
 * Permission prompts deep-link here via their "global settings" link. Flipping
 * a toggle takes effect immediately — even a prompt already on screen resolves
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

type Tab = 'subscription' | 'permissions'

const TABS: ModalTab[] = [
  { id: 'subscription', label: 'Subscription', icon: KeyRound },
  { id: 'permissions', label: 'Permissions', icon: Wrench }
]

export default function SettingsButton(): React.JSX.Element {
  const open = useSettingsStore((s) => s.modalOpen)
  const setOpen = useSettingsStore((s) => s.setModalOpen)
  const permissions = useSettingsStore((s) => s.permissions)
  const loadFailed = useSettingsStore((s) => s.loadFailed)
  const load = useSettingsStore((s) => s.load)
  const update = useSettingsStore((s) => s.update)

  const [tab, setTab] = useState<Tab>('subscription')

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
        <TabbedModal
          title="Settings"
          titleIcon={Settings}
          tabs={TABS}
          active={tab}
          onTab={(id) => setTab(id as Tab)}
          onClose={() => setOpen(false)}
        >
          {tab === 'subscription' && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-[#92690B]">
                <KeyRound className="h-4 w-4" />
                Claude subscription
              </h3>
              <AuthSection />
            </div>
          )}

          {tab === 'permissions' && (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-[#92690B]">
                <Wrench className="h-4 w-4" />
                Tool permissions
              </h3>
              <p className="mb-3 text-[12px] text-neutral-600">
                Permissions for every folder and chat. Changes apply immediately — a prompt already
                waiting on screen is answered too.
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
          )}
        </TabbedModal>
      )}
    </>
  )
}
