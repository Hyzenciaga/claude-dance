import { create } from 'zustand'
import type { Project } from '@shared/types'
import { api } from '../lib/api'

type State = {
  projects: Project[]
  selectedProjectPath: string | null
  load: () => Promise<void>
  selectProject: (path: string | null) => void
  addProject: (path: string) => Promise<void>
  hideProject: (path: string) => Promise<void>
  archiveProject: (path: string) => Promise<void>
  unarchiveProject: (path: string) => Promise<void>
}

export const useProjects = create<State>((set) => ({
  projects: [],
  selectedProjectPath: null,
  load: async () => {
    const projects = await api().listProjects()
    set({ projects })
  },
  selectProject: (path) => set({ selectedProjectPath: path }),
  addProject: async (path) => {
    const projects = await api().addProject(path)
    set({ projects })
  },
  hideProject: async (path) => {
    const projects = await api().hideProject(path)
    set({ projects })
  },
  archiveProject: async (path) => {
    const projects = await api().archiveProject(path)
    set({ projects })
  },
  unarchiveProject: async (path) => {
    const projects = await api().unarchiveProject(path)
    set({ projects })
  },
}))
