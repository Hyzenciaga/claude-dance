import { describe, expect, it } from 'vitest'
import { groupSessionsByTime, type Bucket } from '../src/lib/time'

const day = 24 * 60 * 60 * 1000

describe('groupSessionsByTime', () => {
  const now = Date.parse('2026-06-09T12:00:00.000Z')

  it('classifies today', () => {
    const sessions = [{ id: '1', lastMessageAt: now - 60_000 }]
    const groups = groupSessionsByTime(sessions, now)
    expect(groups[0].bucket).toBe<Bucket>('today')
    expect(groups[0].sessions).toHaveLength(1)
  })

  it('classifies yesterday', () => {
    const yesterday = Date.parse('2026-06-08T20:00:00.000Z')
    const groups = groupSessionsByTime([{ id: '1', lastMessageAt: yesterday }], now)
    expect(groups.find((g) => g.bucket === 'yesterday')!.sessions).toHaveLength(1)
  })

  it('classifies this week', () => {
    const groups = groupSessionsByTime([{ id: '1', lastMessageAt: now - 4 * day }], now)
    expect(groups.find((g) => g.bucket === 'thisWeek')!.sessions).toHaveLength(1)
  })

  it('classifies earlier', () => {
    const groups = groupSessionsByTime([{ id: '1', lastMessageAt: now - 30 * day }], now)
    expect(groups.find((g) => g.bucket === 'earlier')!.sessions).toHaveLength(1)
  })

  it('omits empty buckets', () => {
    const groups = groupSessionsByTime([{ id: '1', lastMessageAt: now }], now)
    expect(groups.map((g) => g.bucket)).toEqual(['today'])
  })
})
