import { useState, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'

export function ThinkingIndicator() {
  const [elapsed, setElapsed] = useState(0)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="px-6 py-2 pb-1">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => setExpanded((o) => !o)}
          className="flex items-center gap-2.5 text-fg-subtle hover:text-fg-default transition-colors"
        >
          <ChevronRight
            size={11}
            strokeWidth={2.5}
            className={'shrink-0 text-fg-subtle transition-transform duration-150 ' +
                        (expanded ? 'rotate-90' : '')}
          />
          <span className="thinking-star text-[15px] leading-none select-none">✢</span>
          <span className="text-[12.5px]">
            Thinking…{' '}
            <span className="text-fg-faint">({elapsed}s)</span>
          </span>
        </button>

        {/* Collapsible area for future thinking content */}
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="ml-6 mt-1 text-[12px] text-fg-muted italic">
              Thinking process will appear here when available…
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
