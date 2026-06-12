import { useState, useEffect } from 'react'

export function ThinkingIndicator() {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="px-6 py-2 pb-1">
      <div className="mx-auto max-w-4xl flex items-center gap-2.5 text-fg-subtle">
        <span className="thinking-star text-[15px] leading-none select-none">✢</span>
        <span className="text-[12.5px]">
          Thinking…{' '}
          <span className="text-fg-faint">({elapsed}s)</span>
        </span>
      </div>
    </div>
  )
}
