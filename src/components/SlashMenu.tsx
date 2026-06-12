import { useEffect, useRef } from 'react'
import type { SlashCommand } from '../lib/slash-commands'

type Props = {
  commands: SlashCommand[]
  activeIndex: number
  onSelect: (cmd: SlashCommand) => void
}

export function SlashMenu({ commands, activeIndex, onSelect }: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (commands.length === 0) return null

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 z-50
                 bg-bg-panel border border-line rounded-xl shadow-2xl
                 max-h-[240px] overflow-y-auto"
    >
      {commands.map((cmd, i) => (
        <button
          key={cmd.command}
          ref={i === activeIndex ? activeRef : undefined}
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(cmd)
          }}
          className={
            'w-full flex items-center gap-3 px-3 py-1.5 text-left text-[12.5px] ' +
            'transition-colors cursor-default ' +
            (i === activeIndex
              ? 'bg-accent/15 text-fg-default'
              : 'text-fg-muted hover:bg-bg-hover hover:text-fg-default')
          }
        >
          <span className="font-mono font-medium text-accent shrink-0">{cmd.command}</span>
          <span className="text-fg-subtle truncate">{cmd.description}</span>
        </button>
      ))}
    </div>
  )
}
