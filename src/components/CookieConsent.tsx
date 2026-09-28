import { useState } from 'react'

const STORAGE_KEY = 'voxagent-cookie-consent'

export default function CookieConsent() {
  const [choice, setChoice] = useState(() => localStorage.getItem(STORAGE_KEY))

  const saveChoice = (value: 'accepted' | 'declined') => {
    localStorage.setItem(STORAGE_KEY, value)
    setChoice(value)
  }

  if (choice) return null

  return (
    <aside
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-white/10 bg-[#09090f] px-4 py-4 text-white shadow-2xl"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-[#e2e4ef]">
          Choose whether to accept or decline cookies. Your choice is stored in this browser.{' '}
          <a className="underline underline-offset-4 hover:text-white" href="/privacy-policy">Privacy Policy</a>
          {' · '}
          <a className="underline underline-offset-4 hover:text-white" href="/terms">Terms</a>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            className="rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-[#e2e4ef] hover:bg-white/10"
            onClick={() => saveChoice('declined')}
            type="button"
          >
            Decline
          </button>
          <button
            className="rounded-md bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#5558e8]"
            onClick={() => saveChoice('accepted')}
            type="button"
          >
            Accept
          </button>
        </div>
      </div>
    </aside>
  )
}
