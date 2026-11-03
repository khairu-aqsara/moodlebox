import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './ui/button'

const AUTHORS = [
  { name: 'Khairu Aqsara', github: 'khairu-aqsara' },
  { name: 'Thom Rawson', github: 'tallthom' }
]

interface AboutModalProps {
  onClose: () => void
}

export function AboutModal({ onClose }: AboutModalProps): React.JSX.Element {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    window.api.app.getVersion().then(setVersion)
  }, [])

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-title"
    >
      <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-entry bg-paper-2 shadow-lift ring-1 ring-ink">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 bg-head px-6 py-4 text-head-ink">
          <div>
            <h2
              id="about-title"
              className="font-display text-xl font-semibold leading-none tracking-display"
            >
              MoodleDocks
            </h2>
            <p className="mt-2 font-mono text-sm opacity-80">
              {version ? `Version ${version}` : ' '}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close about"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-key text-head-ink transition-colors duration-micro hover:bg-head-ink/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-6 p-6">
          <p className="text-ink-2">
            Local Moodle sites in Docker, with PHP, MySQL and phpMyAdmin.
          </p>

          <div className="flex flex-col gap-3" role="group" aria-labelledby="about-authors">
            <span id="about-authors" className="text-sm font-medium text-ink-2">
              Authors
            </span>
            <ul className="overflow-hidden rounded-key ring-1 ring-rule">
              {AUTHORS.map((author) => (
                <li
                  key={author.github}
                  className="flex items-baseline justify-between gap-4 border-t border-rule bg-sheet px-4 py-3 first:border-t-0"
                >
                  <span className="font-medium text-ink">{author.name}</span>
                  <a
                    href={`https://github.com/${author.github}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-sm font-mono text-sm text-muted-foreground underline-offset-4 hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    @{author.github}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-rule px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
