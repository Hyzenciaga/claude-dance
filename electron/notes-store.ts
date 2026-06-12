import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { encodeCwd } from '@shared/encoding'
import type { NoteItem, NoteScope } from '@shared/types'

export type { NoteItem, NoteScope }

const ITEM_RE = /^\s*-\s*\[(\s|x|X)\]\s+(.*)$/
const ID_RE = /^<!--id:([a-zA-Z0-9_-]+)-->\s*/

export function parseNotes(md: string): NoteItem[] {
  const out: NoteItem[] = []
  let lastTopLevelId: string | null = null
  for (const line of md.split('\n')) {
    const m = line.match(ITEM_RE)
    if (!m) continue
    const indent = (line.match(/^(\s*)/) ?? ['', ''])[1].length
    const done = m[1].toLowerCase() === 'x'
    let text = m[2].trim()
    let id: string
    const idMatch = text.match(ID_RE)
    if (idMatch) {
      id = idMatch[1]
      text = text.slice(idMatch[0].length).trim()
    } else {
      id = generateId()
    }
    const isChild = indent >= 2 && lastTopLevelId !== null
    const item: NoteItem = { id, done, text }
    if (isChild) {
      item.parentId = lastTopLevelId!
    } else {
      lastTopLevelId = id
    }
    out.push(item)
  }
  return out
}

export function serializeNotes(items: NoteItem[]): string {
  if (items.length === 0) return ''
  const lines = items.map((item) => {
    const indent = item.parentId ? '  ' : ''
    const box = item.done ? '[x]' : '[ ]'
    const safeText = item.text.replace(/\s*\n\s*/g, ' ').trim()
    return `${indent}- ${box} <!--id:${item.id}--> ${safeText}`
  })
  return lines.join('\n') + '\n'
}

export async function readNotes(path: string): Promise<NoteItem[]> {
  let text: string
  try {
    text = await fs.readFile(path, 'utf8')
  } catch {
    return []
  }
  return parseNotes(text)
}

export async function writeNotes(path: string, items: NoteItem[]): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true })
  await fs.writeFile(path, serializeNotes(items), 'utf8')
}

export function notesFilePath(opts: {
  root: string
  scope: NoteScope
  key: string
}): string {
  if (opts.scope === 'session') {
    return join(opts.root, 'sessions', `${opts.key}.md`)
  }
  return join(opts.root, 'projects', `${encodeCwd(opts.key)}.md`)
}

function generateId(): string {
  return 'n' + Math.random().toString(36).slice(2, 10)
}
