import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

export type NotificationPrefs = {
  onResult: boolean
  onPermission: boolean
  onError: boolean
}

export type AppData = {
  manual: string[]
  hidden: string[]
  archived: string[]
  archivedSessions: string[]
  notifications: NotificationPrefs
  sessionPermissionModes: Record<string, string>
}

const DEFAULT_NOTIFICATIONS: NotificationPrefs = { onResult: true, onPermission: true, onError: true }

const DEFAULT: AppData = { manual: [], hidden: [], archived: [], archivedSessions: [], notifications: DEFAULT_NOTIFICATIONS, sessionPermissionModes: {} }

export async function readAppData(path: string): Promise<AppData> {
  try {
    const text = await fs.readFile(path, 'utf8')
    const parsed = JSON.parse(text) as Partial<AppData>
    return {
      manual: Array.isArray(parsed.manual) ? parsed.manual : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
      archived: Array.isArray(parsed.archived) ? parsed.archived : [],
      archivedSessions: Array.isArray(parsed.archivedSessions) ? parsed.archivedSessions : [],
      notifications: { ...DEFAULT_NOTIFICATIONS, ...(parsed.notifications as Partial<NotificationPrefs> | undefined) },
      sessionPermissionModes: (parsed.sessionPermissionModes && typeof parsed.sessionPermissionModes === 'object' && !Array.isArray(parsed.sessionPermissionModes)) ? parsed.sessionPermissionModes as Record<string, string> : {},
    }
  } catch {
    return { ...DEFAULT }
  }
}

export async function writeAppData(path: string, data: AppData): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true })
  await fs.writeFile(path, JSON.stringify(data, null, 2), 'utf8')
}
