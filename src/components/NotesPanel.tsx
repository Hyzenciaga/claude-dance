import { useEffect, useState, useRef } from 'react'
import { Plus, FolderOpen, MessageSquare } from 'lucide-react'
import { useNotes } from '../store/notes'
import { NoteItem } from './NoteItem'

type Props = {
  sessionId: string | null  // null when no sessionId yet — session tab is disabled
  projectPath: string | null // null when no cwd
  onRefill: (text: string) => void
}

type Tab = 'session' | 'project'

export function NotesPanel({ sessionId, projectPath, onRefill }: Props) {
  const initialTab: Tab = sessionId ? 'session' : 'project'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const notes = useNotes()

  // If user is on session tab but sessionId vanishes (e.g. switched view), drop to project
  useEffect(() => {
    if (tab === 'session' && !sessionId) setTab('project')
  }, [tab, sessionId])

  // Auto-load notes whenever the active key becomes valid
  useEffect(() => {
    if (tab === 'session' && sessionId) notes.load('session', sessionId)
    if (tab === 'project' && projectPath) notes.load('project', projectPath)
  }, [tab, sessionId, projectPath, notes])

  const activeKey = tab === 'session' ? sessionId : projectPath
  const items = activeKey ? notes.items[`${tab}:${activeKey}`] ?? [] : []

  function addDraft() {
    const text = draft.trim()
    if (!text || !activeKey) return
    notes.addItem(tab, activeKey, text)
    setDraft('')
    inputRef.current?.focus()
  }

  const sessionDisabled = !sessionId

  return (
    <aside className="w-[320px] h-full flex flex-col bg-bg-panel border-l border-line shrink-0">
      <div className="app-drag h-9 flex-shrink-0" />
      <div className="px-3 pb-2 app-no-drag">
        <div className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle mb-2">
          Notes
        </div>
        <div className="flex rounded-md bg-bg-hover p-0.5">
          <TabBtn
            active={tab === 'session'}
            disabled={sessionDisabled}
            onClick={() => setTab('session')}
            icon={<MessageSquare size={11} strokeWidth={2.25} />}
            label="Session"
          />
          <TabBtn
            active={tab === 'project'}
            disabled={!projectPath}
            onClick={() => setTab('project')}
            icon={<FolderOpen size={11} strokeWidth={2.25} />}
            label="Project"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {!activeKey && (
          <div className="px-3 py-6 text-[12px] text-fg-subtle text-center">
            {tab === 'session'
              ? 'No active session yet.'
              : 'Open or start a session in a project to use notes.'}
          </div>
        )}
        {activeKey && items.length === 0 && (
          <div className="px-3 py-6 text-[12px] text-fg-subtle text-center">
            No notes yet. Add one below, or use the ↗ button next to your message.
          </div>
        )}
        {activeKey &&
          items.map((item) => (
            <NoteItem
              key={item.id}
              item={item}
              onToggle={() => notes.toggle(tab, activeKey, item.id)}
              onDelete={() => notes.remove(tab, activeKey, item.id)}
              onRefill={() => onRefill(item.text)}
              onPromote={
                tab === 'session' && projectPath
                  ? () => notes.promoteToProject(activeKey, projectPath, item.id)
                  : undefined
              }
            />
          ))}
      </div>

      {activeKey && (
        <div className="border-t border-line p-2 bg-bg-panel">
          <div className="flex items-end gap-1.5 rounded-md bg-bg-inset border border-line p-1.5
                          focus-within:border-line-strong transition-colors">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  addDraft()
                }
              }}
              placeholder="Add a note… (⌘↵)"
              rows={1}
              className="flex-1 resize-none bg-transparent text-[12.5px] leading-[1.5]
                         placeholder:text-fg-subtle min-h-[20px] max-h-[100px]"
            />
            <button
              onClick={addDraft}
              disabled={!draft.trim()}
              className="h-5 w-5 flex items-center justify-center rounded shrink-0
                         bg-fg-default text-bg-base hover:bg-fg-muted
                         disabled:bg-bg-active disabled:text-fg-faint disabled:cursor-not-allowed
                         transition-colors"
              aria-label="Add note"
            >
              <Plus size={12} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}

function TabBtn({
  active,
  disabled,
  onClick,
  icon,
  label,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        'flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded text-[11.5px] font-medium ' +
        'transition-colors disabled:opacity-40 disabled:cursor-not-allowed ' +
        (active && !disabled
          ? 'bg-bg-inset text-fg-default shadow-sm'
          : 'text-fg-muted hover:text-fg-default')
      }
    >
      {icon}
      {label}
    </button>
  )
}
