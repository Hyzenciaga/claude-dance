export type Bucket = 'recent' | 'week' | 'month' | 'earlier'

export type HasLastMessageAt = { id: string; lastMessageAt: number }

const labelByBucket: Record<Bucket, string> = {
  recent: '近 3 天',
  week: '一周',
  month: '一个月',
  earlier: '更早',
}

const order: Bucket[] = ['recent', 'week', 'month', 'earlier']

const DAY = 24 * 60 * 60 * 1000

export function groupByTime<T>(
  items: T[],
  getTime: (item: T) => number,
  now: number = Date.now(),
): { bucket: Bucket; label: string; items: T[] }[] {
  const cutoff3d = now - 3 * DAY
  const cutoff7d = now - 7 * DAY
  const cutoff30d = now - 30 * DAY

  const buckets: Record<Bucket, T[]> = { recent: [], week: [], month: [], earlier: [] }
  for (const item of items) {
    const t = getTime(item)
    if (t >= cutoff3d) buckets.recent.push(item)
    else if (t >= cutoff7d) buckets.week.push(item)
    else if (t >= cutoff30d) buckets.month.push(item)
    else buckets.earlier.push(item)
  }
  return order
    .filter((b) => buckets[b].length > 0)
    .map((b) => ({ bucket: b, label: labelByBucket[b], items: buckets[b] }))
}

export function groupSessionsByTime<T extends HasLastMessageAt>(
  sessions: T[],
  now: number = Date.now(),
): { bucket: Bucket; label: string; sessions: T[] }[] {
  return groupByTime(sessions, (s) => s.lastMessageAt, now)
    .map((g) => ({ bucket: g.bucket, label: g.label, sessions: g.items }))
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
