import { FolderOpen, PanelRightOpen, PanelRightClose } from 'lucide-react'

type Props = {
  projectPath?: string
  sessionTitle?: string
  notesOpen?: boolean
  canShowNotes?: boolean
  onToggleNotes?: () => void
}

export function ChatHeader({
  projectPath,
  sessionTitle,
  notesOpen,
  canShowNotes,
  onToggleNotes,
}: Props) {
  const segments = projectPath ? projectPath.replace(/\/$/, '').split('/').filter(Boolean) : []
  const projectName = segments[segments.length - 1] ?? ''

  return (
    <div
      className="app-drag flex-shrink-0 h-9 flex items-center px-2.5
                 border-b border-line/60 bg-bg-base"
    >
      {/* Left spacer */}
      <div className="flex-1" />

      {/* Center: project / session breadcrumb */}
      <div className="app-no-drag flex items-center gap-1.5 min-w-0">
        {projectName && (
          <>
            <FolderOpen size={11} className="text-fg-faint shrink-0" />
            <span
              className="font-mono text-[11.5px] text-fg-subtle truncate"
              title={projectPath}
            >
              {projectName}
            </span>
          </>
        )}
        {sessionTitle && (
          <>
            <span className="text-fg-faint text-[11px]">/</span>
            <span
              className="text-[11.5px] text-fg-faint truncate max-w-[280px]"
              title={sessionTitle}
            >
              {sessionTitle}
            </span>
          </>
        )}
      </div>

      {/* Right: notes toggle */}
      <div className="flex-1 flex justify-end">
        {canShowNotes && (
          <button
            onClick={onToggleNotes}
            className="app-no-drag h-7 w-7 flex items-center justify-center rounded-lg
                       text-fg-subtle hover:text-fg-default hover:bg-bg-hover transition-colors"
            title={notesOpen ? 'Hide notes' : 'Show notes'}
            aria-label={notesOpen ? 'Hide notes panel' : 'Show notes panel'}
          >
            {notesOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
          </button>
        )}
      </div>
    </div>
  )
}
