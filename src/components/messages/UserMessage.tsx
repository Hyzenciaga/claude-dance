import { useState, useRef, useEffect } from 'react'
import { Pencil, RotateCcw } from 'lucide-react'

type Props = {
  text: string
  onRewind?: () => void
  onEditResend?: (text: string) => void
}

export function UserMessage({ text, onRewind, onEditResend }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const hasActions = onRewind || onEditResend

  useEffect(() => {
    if (!menuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuOpen])

  return (
    <div className="px-6 py-2.5 group/user">
      <div className="mx-auto max-w-4xl flex items-start justify-end gap-1.5">
        {/* Action menu anchor */}
        {hasActions && (
          <div className="relative mt-1.5 shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="h-6 w-6 flex items-center justify-center rounded-md
                         text-fg-subtle hover:text-fg-default hover:bg-bg-active
                         opacity-0 group-hover/user:opacity-100 transition-opacity"
              title="Message actions"
              aria-label="Message actions"
            >
              <Pencil size={11} strokeWidth={2} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-bg-panel border border-line
                              rounded-xl shadow-xl overflow-hidden z-50">
                {onEditResend && (
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      onEditResend(text)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px]
                               text-fg-muted hover:bg-bg-hover hover:text-fg-default
                               text-left transition-colors"
                  >
                    <Pencil size={12} className="text-fg-subtle shrink-0" />
                    Edit &amp; resend
                  </button>
                )}
                {onRewind && (
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      onRewind()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px]
                               text-fg-muted hover:bg-bg-hover hover:text-fg-default
                               text-left transition-colors"
                  >
                    <RotateCcw size={12} className="text-fg-subtle shrink-0" />
                    Revert files
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2
                        bg-bubble-user text-bubble-user-fg text-[13.5px]
                        leading-[1.55] whitespace-pre-wrap shadow-sm">
          {text}
        </div>
      </div>
    </div>
  )
}
