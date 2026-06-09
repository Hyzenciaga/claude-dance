import { useEffect, useState } from 'react'
import { api } from './lib/api'
import type { Project } from '@shared/types'

export default function App() {
  const [projects, setProjects] = useState<Project[]>([])
  useEffect(() => {
    api().listProjects().then(setProjects)
  }, [])
  return (
    <div style={{ padding: 24 }}>
      <h1>ClaudeDance</h1>
      <p>Found {projects.length} projects</p>
      <ul>
        {projects.slice(0, 10).map((p) => (
          <li key={p.path}>
            {p.path} — {p.sessionCount} sessions
          </li>
        ))}
      </ul>
    </div>
  )
}
