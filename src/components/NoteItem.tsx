import { useState, useRef, useEffect, forwardRef } from 'react'
import { Trash2, CornerUpLeft, ArrowRightToLine, GripVertical, ChevronRight } from 'lucide-react'
import type { NoteItem as Item } from '@shared/types'

type Props = {
  item: Item
  depth?: 0 | 1
  hasChildren?: boolean
  collapsed?: boolean
  isDragging?: boolean
  isNestTarget?: boolean
  onToggle: () => void
  onDelete: () => void
  onRefill: () => void
  onUpdate: (newText: string) => void
  onPromote?: () => void
  onToggleCollapse?: () => void
  dragHandleProps?: Record<string, unknown>
}

export const NoteItem = forwardRef<HTMLDivElement, Props>(function NoteItem(
  {
    item, depth = 0, hasChildren, collapsed, isDragging, isNestTarget,
    onToggle, onDelete, onRefill, onUpdate, onPromote, onToggleCollapse,
    dragHandleProps,
  },
  ref,
) {
  const [hover, setHover] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function startEdit() {
    if (item.done) return
    setEditText(item.text)
    setEditing(true)
  }

  function commitEdit() {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== item.text) onUpdate(trimmed)
    setEditing(false)
  }

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={
        'group flex items-start gap-1.5 px-2 py-1.5 rounded-lg transition-colors ' +
        (depth === 1 ? 'pl-7 ' : '') +
        (isDragging ? 'opacity-30 ' : '') +
        (isNestTarget ? 'bg-accent/10 ring-1 ring-accent/40 ' : 'hover:bg-bg-hover ')
      }
    >
      {!item.done && (
        <div
          {...dragHandleProps}
          className={'mt-[3px] shrink-0 cursor-grab active:cursor-grabbing text-fg-faint ' +
            'transition-opacity ' + (hover && !editing ? 'opacity-100' : 'opacity-0')}
        >
          <GripVertical size={12} />
        </div>
      )}

      {hasChildren && onToggleCollapse ? (
        <button onClick={onToggleCollapse} className="mt-[3px] shrink-0 text-fg-subtle hover:text-fg-default">
          <ChevronRight
            size={11}
            className={'transition-transform duration-150 ' + (collapsed ? '' : 'rotate-90')}
          />
        </button>
      ) : item.done ? null : (
        <div className="w-3 shrink-0" />
      )}

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

      {editing ? (
        <input
          ref={inputRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
            if (e.key === 'Escape') { setEditing(false) }
          }}
          onBlur={commitEdit}
          className="flex-1 bg-transparent text-[12.5px] leading-[1.5] text-fg-default
                     border-b border-accent outline-none"
        />
      ) : (
        <span
          onClick={startEdit}
          className={
            'flex-1 text-[12.5px] leading-[1.5] whitespace-pre-wrap break-words ' +
            (item.done
              ? 'line-through text-fg-faint'
              : 'text-fg-default cursor-pointer hover:text-accent')
          }
        >
          {item.text}
        </span>
      )}

      <div className={'flex items-center gap-0.5 shrink-0 ' + (hover && !editing ? 'opacity-100' : 'opacity-0')}>
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
})

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="h-5 w-5 flex items-center justify-center rounded-md
                 text-fg-subtle hover:text-fg-default hover:bg-bg-active
                 transition-colors"
    >
      {children}
    </button>
  )
}
