import { useState } from 'react'
import { useLocation } from 'react-router'
import './notice.css'

const KEY = 'notice-dismissed'

/** One-time disclaimer shown at the top of the index. */
export function Notice() {
  const { pathname } = useLocation()
  const [hidden, setHidden] = useState(() => sessionStorage.getItem(KEY) === '1')
  if (hidden || pathname !== '/') return null
  return (
    <div className="notice" role="note">
      <p>
        Please note: these are visual representations and simulations of projects I&apos;ve worked on, not the
        projects exactly as they are.
      </p>
      <button
        type="button"
        aria-label="Dismiss note"
        onClick={() => {
          sessionStorage.setItem(KEY, '1')
          setHidden(true)
        }}
      >
        ×
      </button>
    </div>
  )
}
