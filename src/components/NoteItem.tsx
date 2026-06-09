import { useState } from 'react'
import { Trash2, CornerUpLeft, ArrowRightToLine } from 'lucide-react'
import type { NoteItem as Item } from '@shared/types'

type Props = {
  item: Item
  onToggle: () => void
  onDelete: () => void
  onRefill: () => void
  onPromote?: () => void // session-scope only
}

export function NoteItem({ item, onToggle, onDelete, onRefill, onPromote }: Props) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group flex items-start gap-2 px-2 py-1.5 rounded-md
                 hover:bg-bg-hover transition-colors"
    >
      <button
        onClick={onToggle}
        className={
          'mt-[3px] shrink-0 w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center ' +
          (item.done
            ? 'bg-accent border-accent text-white'
            : 'border-line-strong hover:border-fg-subtle')
        }
        aria-pressed={item.done}
      >
        {item.done && (
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M2.5 6.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <span
        className={
          'flex-1 text-[12.5px] leading-[1.5] whitespace-pre-wrap break-words ' +
          (item.done ? 'line-through text-fg-faint' : 'text-fg-default')
        }
      >
        {item.text}
      </span>
      <div className={'flex items-center gap-0.5 shrink-0 ' + (hover ? 'opacity-100' : 'opacity-0')}>
        <IconBtn label="Send to input" onClick={onRefill}>
          <CornerUpLeft size={11} />
        </IconBtn>
        {onPromote && (
          <IconBtn label="Promote to project" onClick={onPromote}>
            <ArrowRightToLine size={11} />
          </IconBtn>
        )}
        <IconBtn label="Delete" onClick={onDelete}>
          <Trash2 size={11} />
        </IconBtn>
      </div>
    </div>
  )
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="h-5 w-5 flex items-center justify-center rounded
                 text-fg-subtle hover:text-fg-default hover:bg-bg-active
                 transition-colors"
    >
      {children}
    </button>
  )
}
