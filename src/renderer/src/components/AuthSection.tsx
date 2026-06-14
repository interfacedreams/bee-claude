import { useEffect, useState } from 'react'
import type { AuthStatus } from '../../../shared/types'

/**
 * Claude-subscription section of the global settings modal. A subscription
 * OAuth token (the output of `claude setup-token`) can be pasted here; when one
 * is stored the agent runs on the user's Claude plan instead of the .env
 * ANTHROPIC_API_KEY. Takes effect immediately — each turn spawns a fresh SDK
 * subprocess. Lives inside SettingsButton's modal; it owns its own auth state.
 */
export default function AuthSection(): React.JSX.Element {
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.api.auth.status().then(setStatus)
  }, [])

  const save = async (): Promise<void> => {
    const token = draft.trim()
    if (!token.startsWith('sk-ant-')) {
      setError('That doesn’t look like a Claude token — expected it to start with sk-ant-')
      return
    }
    setBusy(true)
    setError(null)
    try {
      setStatus(await window.api.auth.setToken(token))
      setDraft('')
    } catch {
      setError('Couldn’t save the token. Check it and try again.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      setStatus(await window.api.auth.clearToken())
    } finally {
      setBusy(false)
    }
  }

  const usingSub = status?.method === 'subscription'

  return (
    <div className="flex flex-col">
      <p className="mb-1 text-[12px] text-neutral-600">
        {usingSub ? (
          <>
            Chats run on your Claude plan with the stored token{' '}
            <span className="font-mono">…{status?.tokenSuffix}</span>.
          </>
        ) : status?.method === 'apiKey' ? (
          'Chats currently bill the ANTHROPIC_API_KEY from .env.'
        ) : (
          'No credentials found — paste a token below to get started.'
        )}
      </p>
      <p className="mb-3 text-[12px] text-neutral-600">
        Run <code className="rounded bg-[#F2EDD8] px-1 font-mono">claude setup-token</code> in a
        terminal, sign in with your Claude account, and paste the{' '}
        <span className="font-mono">sk-ant-oat…</span> token here. It replaces the API key until you
        remove it.
      </p>

      <input
        type="password"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save()
        }}
        placeholder="sk-ant-oat01-…"
        spellCheck={false}
        className="mb-2 w-full rounded-[7px] border border-[#E2DAC0] bg-white px-2.5 py-1.5 font-mono text-[12px] outline-none focus:border-[#C9A227]"
      />
      {error && <p className="mb-2 text-[12px] text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        {usingSub && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            title={
              status?.hasApiKey
                ? 'Go back to the .env API key'
                : 'Remove the token (no API key fallback found)'
            }
            className="cursor-pointer rounded-[7px] px-3 py-1.5 text-[12px] font-medium text-neutral-500 transition-colors hover:bg-[#F2EDD8] disabled:opacity-50"
          >
            Remove token
          </button>
        )}
        <button
          type="button"
          disabled={busy || draft.trim() === ''}
          onClick={() => void save()}
          className="cursor-pointer rounded-[7px] border border-black bg-black px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-default disabled:opacity-40"
        >
          Save token
        </button>
      </div>
    </div>
  )
}
