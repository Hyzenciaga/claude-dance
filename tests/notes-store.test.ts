import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  parseNotes,
  serializeNotes,
  readNotes,
  writeNotes,
  notesFilePath,
  type NoteItem,
} from '../electron/notes-store'

describe('parseNotes', () => {
  it('returns empty array for empty input', () => {
    expect(parseNotes('')).toEqual([])
    expect(parseNotes('   \n\n')).toEqual([])
  })

  it('parses unchecked items', () => {
    expect(parseNotes('- [ ] write tests')).toEqual<NoteItem[]>([
      { id: expect.any(String), done: false, text: 'write tests' },
    ])
  })

  it('parses checked items', () => {
    expect(parseNotes('- [x] shipped')).toEqual<NoteItem[]>([
      { id: expect.any(String), done: true, text: 'shipped' },
    ])
    expect(parseNotes('- [X] shipped')[0].done).toBe(true)
  })

  it('parses multiple items preserving order', () => {
    const md = '- [ ] one\n- [x] two\n- [ ] three\n'
    const items = parseNotes(md)
    expect(items.map((i) => i.text)).toEqual(['one', 'two', 'three'])
    expect(items.map((i) => i.done)).toEqual([false, true, false])
  })

  it('ignores non-checkbox lines', () => {
    const md = '# Title\n\nSome text\n- [ ] real item\n- not a checkbox\n'
    expect(parseNotes(md).map((i) => i.text)).toEqual(['real item'])
  })

  it('handles items with surrounding whitespace', () => {
    expect(parseNotes('  - [ ] indented  ')[0].text).toBe('indented')
  })

  it('handles items with leading id marker for stable identity', () => {
    const md = '- [ ] <!--id:abc--> with id\n- [x] no id\n'
    const items = parseNotes(md)
    expect(items[0].id).toBe('abc')
    expect(items[0].text).toBe('with id')
    expect(items[1].id).toMatch(/^n[a-z0-9]+$/)
  })
})

describe('serializeNotes', () => {
  it('round-trips items', () => {
    const items: NoteItem[] = [
      { id: 'a', done: false, text: 'one' },
      { id: 'b', done: true, text: 'two' },
    ]
    const md = serializeNotes(items)
    const parsed = parseNotes(md)
    expect(parsed).toEqual(items)
  })

  it('produces empty string for empty array', () => {
    expect(serializeNotes([])).toBe('')
  })

  it('escapes multi-line text into single line', () => {
    const md = serializeNotes([{ id: 'x', done: false, text: 'line one\nline two' }])
    // Newlines collapse to single space; round-trip should not break parsing
    const parsed = parseNotes(md)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].text).toBe('line one line two')
  })
})

describe('readNotes / writeNotes', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'cd-notes-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('returns empty array when file does not exist', async () => {
    const items = await readNotes(join(root, 'missing.md'))
    expect(items).toEqual([])
  })

  it('reads back what writeNotes wrote', async () => {
    const path = join(root, 'sub', 'foo.md')
    const items: NoteItem[] = [
      { id: 'a', done: false, text: 'todo one' },
      { id: 'b', done: true, text: 'done one' },
    ]
    await writeNotes(path, items)
    expect(existsSync(path)).toBe(true)
    const read = await readNotes(path)
    expect(read).toEqual(items)
  })

  it('writes empty file when items array is empty', async () => {
    const path = join(root, 'empty.md')
    await writeNotes(path, [])
    expect(existsSync(path)).toBe(true)
  })

  it('skips malformed lines without throwing', async () => {
    const path = join(root, 'mixed.md')
    writeFileSync(path, 'random\n- [ ] real\nblah\n')
    const items = await readNotes(path)
    expect(items.map((i) => i.text)).toEqual(['real'])
  })

  it('reads from an existing project directory created by another tool', async () => {
    const path = join(root, 'projects', 'tmp-foo.md')
    mkdirSync(join(root, 'projects'))
    writeFileSync(path, '- [ ] from external editor\n')
    const items = await readNotes(path)
    expect(items[0].text).toBe('from external editor')
  })
})

describe('notesFilePath', () => {
  it('builds session path under sessions/', () => {
    const p = notesFilePath({ root: '/tmp/notes', scope: 'session', key: 'abc-123' })
    expect(p).toBe('/tmp/notes/sessions/abc-123.md')
  })

  it('builds project path under projects/ using encoded cwd', () => {
    const p = notesFilePath({ root: '/tmp/notes', scope: 'project', key: '/Users/steve/foo' })
    expect(p).toBe('/tmp/notes/projects/-Users-steve-foo.md')
  })
})
