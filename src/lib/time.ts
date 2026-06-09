export type Bucket = 'today' | 'yesterday' | 'thisWeek' | 'earlier'

export type HasLastMessageAt = { id: string; lastMessageAt: number }

const labelByBucket: Record<Bucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This Week',
  earlier: 'Earlier',
}

const order: Bucket[] = ['today', 'yesterday', 'thisWeek', 'earlier']

export function groupSessionsByTime<T extends HasLastMessageAt>(
  sessions: T[],
  now: number = Date.now(),
): { bucket: Bucket; label: string; sessions: T[] }[] {
  const startOfToday = startOfDay(now)
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000

  const buckets: Record<Bucket, T[]> = { today: [], yesterday: [], thisWeek: [], earlier: [] }
  for (const s of sessions) {
    if (s.lastMessageAt >= startOfToday) buckets.today.push(s)
    else if (s.lastMessageAt >= startOfYesterday) buckets.yesterday.push(s)
    else if (s.lastMessageAt >= startOfWeek) buckets.thisWeek.push(s)
    else buckets.earlier.push(s)
  }
  return order
    .filter((b) => buckets[b].length > 0)
    .map((b) => ({ bucket: b, label: labelByBucket[b], sessions: buckets[b] }))
}

function startOfDay(ts: number): number {
  const d = new Date(ts)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function relativeTime(ts: number, now: number = Date.now()): string {
  const diff = now - ts
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour
  if (diff < min) return 'just now'
  if (diff < hour) return `${Math.floor(diff / min)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  return `${Math.floor(diff / day)}d ago`
}
