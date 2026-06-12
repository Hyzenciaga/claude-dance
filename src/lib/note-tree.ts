import type { NoteItem } from '@shared/types'

export type NoteTreeNode = {
  item: NoteItem
  children: NoteItem[]
}

export type DropIntent =
  | { type: 'reorder'; position: 'before' | 'after'; targetId: string }
  | { type: 'nest'; parentId: string }

export function buildTree(items: NoteItem[]): NoteTreeNode[] {
  const nodes: NoteTreeNode[] = []
  const map = new Map<string, NoteTreeNode>()
  for (const item of items) {
    if (item.parentId) {
      const parent = map.get(item.parentId)
      if (parent) {
        parent.children.push(item)
        continue
      }
    }
    const node: NoteTreeNode = { item, children: [] }
    nodes.push(node)
    map.set(item.id, node)
  }
  return nodes
}

export function flattenTree(nodes: NoteTreeNode[]): NoteItem[] {
  const out: NoteItem[] = []
  for (const node of nodes) {
    out.push(node.item)
    for (const child of node.children) {
      out.push(child)
    }
  }
  return out
}

export function canAcceptChild(item: NoteItem): boolean {
  return !item.parentId && !item.done
}

export function canBeNested(itemId: string, allItems: NoteItem[]): boolean {
  return !allItems.some((i) => i.parentId === itemId)
}

function extractWithChildren(items: NoteItem[], id: string): { extracted: NoteItem[]; remaining: NoteItem[] } {
  const extracted: NoteItem[] = []
  const remaining: NoteItem[] = []
  for (const item of items) {
    if (item.id === id || item.parentId === id) extracted.push(item)
    else remaining.push(item)
  }
  return { extracted, remaining }
}

export function applyDrop(items: NoteItem[], activeId: string, intent: DropIntent): NoteItem[] {
  const { extracted, remaining } = extractWithChildren(items, activeId)
  if (extracted.length === 0) return items

  if (intent.type === 'nest') {
    const nested = extracted.map((item) =>
      item.id === activeId ? { ...item, parentId: intent.parentId } : item,
    )
    const parentIdx = remaining.findIndex((i) => i.id === intent.parentId)
    if (parentIdx === -1) return items
    let insertAt = parentIdx + 1
    while (insertAt < remaining.length && remaining[insertAt].parentId === intent.parentId) {
      insertAt++
    }
    const result = [...remaining]
    result.splice(insertAt, 0, ...nested)
    return result
  }

  const unparented = extracted.map((item) =>
    item.id === activeId ? { ...item, parentId: undefined } : item,
  )

  let targetIdx = remaining.findIndex((i) => i.id === intent.targetId)
  if (targetIdx === -1) return items

  const target = remaining[targetIdx]
  if (intent.position === 'after') {
    targetIdx++
    if (!target.parentId) {
      while (targetIdx < remaining.length && remaining[targetIdx].parentId === target.id) {
        targetIdx++
      }
    }
  }

  if (target.parentId && extracted.length === 1) {
    unparented[0] = { ...unparented[0], parentId: target.parentId }
  }

  const result = [...remaining]
  result.splice(targetIdx, 0, ...unparented)
  return result
}
