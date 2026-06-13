import { useState, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

type Props = {
  trigger: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

export function Collapsible({ trigger, children, defaultOpen = false, className }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={className}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-left w-full"
        aria-expanded={open}
      >
        <ChevronRight
          size={11}
          strokeWidth={2.5}
          className={'shrink-0 text-fg-subtle transition-transform duration-150 ' + (open ? 'rotate-90' : '')}
        />
        {trigger}
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}
