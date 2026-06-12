import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { NoteItem } from './NoteItem'
import type { NoteItem as NoteItemType } from '@shared/types'

type Props = {
  item: NoteItemType
  depth: 0 | 1
  hasChildren: boolean
  collapsed: boolean
  isNestTarget: boolean
  onToggle: () => void
  onDelete: () => void
  onRefill: () => void
  onUpdate: (newText: string) => void
  onPromote?: () => void
  onToggleCollapse?: () => void
}

export function SortableNoteItem({ item, ...rest }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: item.done,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <NoteItem
        item={item}
        isDragging={isDragging}
        dragHandleProps={listeners}
        {...rest}
      />
    </div>
  )
}
