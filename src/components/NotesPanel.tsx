import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Plus, FolderOpen, MessageSquare, ChevronDown } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useNotes } from '../store/notes'
import { NoteItem } from './NoteItem'
import { SortableNoteItem } from './SortableNoteItem'
import { buildTree, applyDrop, canAcceptChild, canBeNested, type DropIntent } from '../lib/note-tree'

type Props = {
  sessionId: string | null
  projectPath: string | null
  onRefill: (text: string) => void
}

type Tab = 'session' | 'project'

export function NotesPanel({ sessionId, projectPath, onRefill }: Props) {
  const initialTab: Tab = sessionId ? 'session' : 'project'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [draft, setDraft] = useState('')
  const [showDone, setShowDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const notes = useNotes()

  const [dragActiveId, setDragActiveId] = useState<string | null>(null)
  const [dropIntent, setDropIntent] = useState<DropIntent | null>(null)
  const pointerYRef = useRef(0)

  useEffect(() => {
    function onMove(e: PointerEvent) { pointerYRef.current = e.clientY }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  useEffect(() => {
    if (tab === 'session' && !sessionId) setTab('project')
  }, [tab, sessionId])

  useEffect(() => {
    if (tab === 'session' && sessionId) notes.load('session', sessionId)
    if (tab === 'project' && projectPath) notes.load('project', projectPath)
  }, [tab, sessionId, projectPath, notes])

  const activeKey = tab === 'session' ? sessionId : projectPath
  const items = activeKey ? notes.items[`${tab}:${activeKey}`] ?? [] : []

  const activeItems = useMemo(() => items.filter((i) => !i.done), [items])
  const doneItems = useMemo(() => items.filter((i) => i.done), [items])
  const tree = useMemo(() => buildTree(activeItems), [activeItems])
  const collapsedSet = activeKey ? notes.collapsed[`${tab}:${activeKey}`] ?? new Set<string>() : new Set<string>()

  const sortableIds = useMemo(() => {
    const ids: string[] = []
    for (const node of tree) {
      ids.push(node.item.id)
      if (!collapsedSet.has(node.item.id)) {
        for (const child of node.children) ids.push(child.id)
      }
    }
    return ids
  }, [tree, collapsedSet])

  const dragItem = useMemo(
    () => dragActiveId ? activeItems.find((i) => i.id === dragActiveId) ?? null : null,
    [dragActiveId, activeItems],
  )

  function addDraft() {
    const text = draft.trim()
    if (!text || !activeKey) return
    notes.addItem(tab, activeKey, text)
    setDraft('')
    inputRef.current?.focus()
  }

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragActiveId(String(event.active.id))
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      setDropIntent(null)
      return
    }

    const overRect = over.rect
    const pointerY = pointerYRef.current

    const relativeY = overRect.height > 0
      ? Math.max(0, Math.min(1, (pointerY - overRect.top) / overRect.height))
      : 0.5

    const overId = String(over.id)
    const activeId = String(active.id)
    const overItem = activeItems.find((i) => i.id === overId)
    if (!overItem) return

    if (relativeY < 0.25) {
      setDropIntent({ type: 'reorder', position: 'before', targetId: overId })
    } else if (relativeY > 0.75) {
      setDropIntent({ type: 'reorder', position: 'after', targetId: overId })
    } else if (canAcceptChild(overItem) && canBeNested(activeId, activeItems)) {
      setDropIntent({ type: 'nest', parentId: overId })
    } else {
      setDropIntent({
        type: 'reorder',
        position: relativeY < 0.5 ? 'before' : 'after',
        targetId: overId,
      })
    }
  }, [activeItems])

  const handleDragEnd = useCallback((_event: DragEndEvent) => {
    if (!dragActiveId || !dropIntent || !activeKey) {
      setDragActiveId(null)
      setDropIntent(null)
      return
    }

    const newActive = applyDrop(activeItems, dragActiveId, dropIntent)
    notes.setItems(tab, activeKey, [...newActive, ...doneItems])

    if (dropIntent.type === 'nest') {
      const ck = `${tab}:${activeKey}`
      const cs = notes.collapsed[ck]
      if (cs?.has(dropIntent.parentId)) {
        notes.toggleCollapse(tab, activeKey, dropIntent.parentId)
      }
    }

    setDragActiveId(null)
    setDropIntent(null)
  }, [dragActiveId, dropIntent, activeKey, activeItems, doneItems, tab, notes])

  const handleDragCancel = useCallback(() => {
    setDragActiveId(null)
    setDropIntent(null)
  }, [])

  const sessionDisabled = !sessionId

  return (
    <aside className="w-[320px] h-full flex flex-col bg-bg-panel border-l border-line shrink-0">
      <div className="app-drag h-9 flex-shrink-0" />
      <div className="px-3 pb-2 app-no-drag">
        <div className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle mb-2">
          Notes
        </div>
        <div className="flex rounded-lg bg-bg-hover p-0.5">
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

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2">
        {!activeKey && (
          <div className="px-3 py-6 text-[12px] text-fg-subtle text-center">
            {tab === 'session'
              ? 'No active session yet.'
              : 'Open or start a session in a project to use notes.'}
          </div>
        )}
        {activeKey && items.length === 0 && (
          <div className="px-3 py-6 text-[12px] text-fg-subtle text-center">
            No notes yet. Add one below, or use the arrow button next to your message.
          </div>
        )}

        {activeKey && activeItems.length > 0 && (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {tree.map((node) => (
                <div key={node.item.id}>
                  {dropIntent?.type === 'reorder' && dropIntent.position === 'before'
                    && dropIntent.targetId === node.item.id && (
                    <div className="h-[2px] bg-accent mx-2 my-0.5 rounded-full" />
                  )}
                  <SortableNoteItem
                    item={node.item}
                    depth={0}
                    hasChildren={node.children.length > 0}
                    collapsed={collapsedSet.has(node.item.id)}
                    isNestTarget={dropIntent?.type === 'nest' && dropIntent.parentId === node.item.id}
                    onToggle={() => notes.toggle(tab, activeKey, node.item.id)}
                    onDelete={() => notes.remove(tab, activeKey, node.item.id)}
                    onRefill={() => onRefill(node.item.text)}
                    onUpdate={(t) => notes.updateText(tab, activeKey, node.item.id, t)}
                    onPromote={
                      tab === 'session' && projectPath
                        ? () => notes.promoteToProject(activeKey, projectPath, node.item.id)
                        : undefined
                    }
                    onToggleCollapse={
                      node.children.length > 0
                        ? () => notes.toggleCollapse(tab, activeKey!, node.item.id)
                        : undefined
                    }
                  />
                  {!collapsedSet.has(node.item.id) && node.children.map((child) => (
                    <div key={child.id}>
                      {dropIntent?.type === 'reorder' && dropIntent.position === 'before'
                        && dropIntent.targetId === child.id && (
                        <div className="h-[2px] bg-accent mx-2 ml-7 my-0.5 rounded-full" />
                      )}
                      <SortableNoteItem
                        item={child}
                        depth={1}
                        hasChildren={false}
                        collapsed={false}
                        isNestTarget={false}
                        onToggle={() => notes.toggle(tab, activeKey, child.id)}
                        onDelete={() => notes.remove(tab, activeKey, child.id)}
                        onRefill={() => onRefill(child.text)}
                        onUpdate={(t) => notes.updateText(tab, activeKey, child.id, t)}
                        onPromote={
                          tab === 'session' && projectPath
                            ? () => notes.promoteToProject(activeKey, projectPath, child.id)
                            : undefined
                        }
                      />
                      {dropIntent?.type === 'reorder' && dropIntent.position === 'after'
                        && dropIntent.targetId === child.id && (
                        <div className="h-[2px] bg-accent mx-2 ml-7 my-0.5 rounded-full" />
                      )}
                    </div>
                  ))}
                  {dropIntent?.type === 'reorder' && dropIntent.position === 'after'
                    && dropIntent.targetId === node.item.id && node.children.length === 0 && (
                    <div className="h-[2px] bg-accent mx-2 my-0.5 rounded-full" />
                  )}
                </div>
              ))}
            </SortableContext>
            <DragOverlay>
              {dragItem && (
                <div className="opacity-90 shadow-lg rounded-lg">
                  <NoteItem
                    item={dragItem}
                    depth={dragItem.parentId ? 1 : 0}
                    onToggle={() => {}}
                    onDelete={() => {}}
                    onRefill={() => {}}
                    onUpdate={() => {}}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {activeKey && doneItems.length > 0 && (
        <button
          onClick={() => setShowDone((v) => !v)}
          className="flex items-center gap-2 px-4 py-1.5 w-full shrink-0
                     text-[10.5px] text-fg-faint hover:text-fg-subtle transition-colors"
        >
          <div className="flex-1 border-t border-line" />
          <span className="uppercase tracking-wide whitespace-nowrap flex items-center gap-1">
            <ChevronDown
              size={10}
              className={'transition-transform ' + (showDone ? 'rotate-180' : '')}
            />
            Completed {doneItems.length}
          </span>
          <div className="flex-1 border-t border-line" />
        </button>
      )}

      {showDone && activeKey && doneItems.length > 0 && (
        <div className="overflow-y-auto max-h-[200px] px-2 pb-1 shrink-0">
          {doneItems.map((item) => (
            <NoteItem
              key={item.id}
              item={item}
              onToggle={() => notes.toggle(tab, activeKey, item.id)}
              onDelete={() => notes.remove(tab, activeKey, item.id)}
              onRefill={() => onRefill(item.text)}
              onUpdate={(t) => notes.updateText(tab, activeKey, item.id, t)}
              onPromote={
                tab === 'session' && projectPath
                  ? () => notes.promoteToProject(activeKey, projectPath, item.id)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {activeKey && (
        <div className="border-t border-line p-2 bg-bg-panel">
          <div className="flex items-center gap-1.5 rounded-lg bg-bg-inset border border-line px-2 py-1.5
                          focus-within:border-line-strong transition-colors">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addDraft()
                }
              }}
              placeholder="Add a note… (↵)"
              className="flex-1 bg-transparent text-[12.5px] leading-[1.5]
                         placeholder:text-fg-subtle"
            />
            <button
              onClick={addDraft}
              disabled={!draft.trim()}
              className="h-5 w-5 flex items-center justify-center rounded-md shrink-0
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
        'flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded-md text-[11.5px] font-medium ' +
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
