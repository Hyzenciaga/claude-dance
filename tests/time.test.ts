import { describe, expect, it } from 'vitest'
import { groupSessionsByTime, type Bucket } from '../src/lib/time'

const day = 24 * 60 * 60 * 1000

describe('groupSessionsByTime', () => {
  const now = Date.parse('2026-06-09T12:00:00.000Z')

  it('classifies recent (within 3 days)', () => {
    const sessions = [{ id: '1', lastMessageAt: now - 60_000 }]
    const groups = groupSessionsByTime(sessions, now)
    expect(groups[0].bucket).toBe<Bucket>('recent')
    expect(groups[0].sessions).toHaveLength(1)
  })

  it('classifies week (3-7 days)', () => {
    const groups = groupSessionsByTime([{ id: '1', lastMessageAt: now - 4 * day }], now)
    expect(groups.find((g) => g.bucket === 'week')!.sessions).toHaveLength(1)
  })

  it('classifies month (7-30 days)', () => {
    const groups = groupSessionsByTime([{ id: '1', lastMessageAt: now - 14 * day }], now)
    expect(groups.find((g) => g.bucket === 'month')!.sessions).toHaveLength(1)
  })

  it('classifies earlier (>30 days)', () => {
    const groups = groupSessionsByTime([{ id: '1', lastMessageAt: now - 31 * day }], now)
    expect(groups.find((g) => g.bucket === 'earlier')!.sessions).toHaveLength(1)
  })

  it('omits empty buckets', () => {
    const groups = groupSessionsByTime([{ id: '1', lastMessageAt: now }], now)
    expect(groups.map((g) => g.bucket)).toEqual(['recent'])
  })
})
