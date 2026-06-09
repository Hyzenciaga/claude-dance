import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

export type AppData = {
  manual: string[]
  hidden: string[]
}

const DEFAULT: AppData = { manual: [], hidden: [] }

export async function readAppData(path: string): Promise<AppData> {
  try {
    const text = await fs.readFile(path, 'utf8')
    const parsed = JSON.parse(text) as Partial<AppData>
    return {
      manual: Array.isArray(parsed.manual) ? parsed.manual : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
    }
  } catch {
    return { ...DEFAULT }
  }
}

export async function writeAppData(path: string, data: AppData): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true })
  await fs.writeFile(path, JSON.stringify(data, null, 2), 'utf8')
}
