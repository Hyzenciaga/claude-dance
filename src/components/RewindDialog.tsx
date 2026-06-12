import { useEffect, useState } from 'react'
import { GitBranch, RotateCcw, X, Loader2, AlertCircle } from 'lucide-react'
import { api } from '../lib/api'
import { useChats } from '../store/chats'

type UserMessage = { uuid: string; text: string }

type Props = {
  sessionId: string
  projectPath: string
  channelId?: string
  onClose: () => void
  onForked: (newSessionId: string) => void
}

export function RewindDialog({ sessionId, projectPath, channelId, onClose, onForked }: Props) {
  const [messages, setMessages] = useState<UserMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null) // uuid of message being acted on
  const [rewindResult, setRewindResult] = useState<{ uuid: string; ok: boolean; detail: string } | null>(null)
  const chats = useChats()

  useEffect(() => {
    setLoading(true)
    setError(null)
    api().readUserMessages(sessionId, projectPath)
      .then((msgs) => setMessages(msgs))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [sessionId, projectPath])

  async function handleFork(msg: UserMessage) {
    setBusy(msg.uuid)
    try {
      const newSessionId = await chats.forkAndResume(
        sessionId,
        msg.uuid,
        projectPath,
        channelId,
        msg.uuid,
      )
      onForked(newSessionId)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(null)
    }
  }

  async function handleRewindFiles(msg: UserMessage) {
    if (!channelId) {
      setError('No active session channel — start the session first to rewind files.')
      return
    }
    setBusy(msg.uuid)
    try {
      const result = await api().rewindFiles(channelId, msg.uuid)
      if (!result.canRewind) {
        setRewindResult({ uuid: msg.uuid, ok: false, detail: result.error ?? 'Cannot rewind' })
      } else {
        const changed = result.filesChanged?.length ?? 0
        const ins = result.insertions ?? 0
        const del = result.deletions ?? 0
        setRewindResult({
          uuid: msg.uuid,
          ok: true,
          detail: changed > 0
            ? `${changed} file${changed !== 1 ? 's' : ''} restored (+${ins} −${del} lines)`
            : 'No file changes to restore',
        })
      }
    } catch (e) {
      setRewindResult({ uuid: msg.uuid, ok: false, detail: String(e) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-[540px] max-h-[70vh] flex flex-col bg-bg-panel border border-line rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-shrink-0">
          <div>
            <h2 className="text-[14px] font-semibold text-fg-default">Rewind conversation</h2>
            <p className="text-[11.5px] text-fg-subtle mt-0.5">
              Choose a message to branch from or restore files to
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-fg-muted
                       hover:text-fg-default hover:bg-bg-hover transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-fg-subtle text-[12.5px]">
              <Loader2 size={14} className="animate-spin" />
              Loading messages…
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 mx-4 mt-4 px-3 py-2.5 bg-red-500/10 border border-red-500/20
                            rounded-lg text-[12px] text-red-400">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {!loading && !error && messages.length === 0 && (
            <div className="flex items-center justify-center py-12 text-fg-subtle text-[12.5px]">
              No user messages found in this session
            </div>
          )}

          {!loading && messages.length > 0 && (
            <div className="py-2">
              {/* Legend */}
              <div className="flex items-center gap-4 px-5 py-2 text-[10.5px] text-fg-faint border-b border-line/50">
                <span className="flex items-center gap-1"><GitBranch size={10} /> Fork — new branch from this point (conversation + files)</span>
                <span className="flex items-center gap-1"><RotateCcw size={10} /> Files — restore disk files only</span>
              </div>

              {[...messages].reverse().map((msg, idx) => {
                const isLast = idx === 0
                const isBusy = busy === msg.uuid
                const result = rewindResult?.uuid === msg.uuid ? rewindResult : null

                return (
                  <div
                    key={msg.uuid}
                    className={'px-5 py-3 border-b border-line/40 last:border-0 ' +
                      (isLast ? 'bg-accent-subtle/30' : '')}
                  >
                    <div className="flex items-start gap-3">
                      {/* Message number from bottom */}
                      <span className="mt-0.5 text-[10px] font-mono text-fg-faint w-5 text-right shrink-0">
                        {messages.length - idx}
                      </span>

                      {/* Text */}
                      <p className="flex-1 text-[12.5px] text-fg-default leading-snug line-clamp-2 min-w-0">
                        {msg.text}
                        {isLast && (
                          <span className="ml-1.5 text-[10px] text-accent font-medium">latest</span>
                        )}
                      </p>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          disabled={isBusy || busy !== null}
                          onClick={() => handleFork(msg)}
                          title="Fork conversation from this message"
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium
                                     bg-bg-inset border border-line text-fg-muted
                                     hover:text-fg-default hover:border-line-strong hover:bg-bg-hover
                                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {isBusy ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <GitBranch size={11} />
                          )}
                          Fork
                        </button>
                        <button
                          disabled={!channelId || isBusy || busy !== null}
                          onClick={() => handleRewindFiles(msg)}
                          title={!channelId ? 'Start the session first to rewind files' : 'Restore files to this point'}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium
                                     bg-bg-inset border border-line text-fg-muted
                                     hover:text-fg-default hover:border-line-strong hover:bg-bg-hover
                                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {isBusy ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <RotateCcw size={11} />
                          )}
                          Files
                        </button>
                      </div>
                    </div>

                    {/* Rewind result inline */}
                    {result && (
                      <div className={'mt-1.5 ml-8 text-[11px] flex items-center gap-1 ' +
                        (result.ok ? 'text-green-400' : 'text-red-400')}>
                        {result.ok ? '✓' : '✗'} {result.detail}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-line flex-shrink-0 flex items-center justify-between">
          <p className="text-[11px] text-fg-faint">
            Fork creates a new session branch. Files-only rewind requires an active session.
          </p>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[12px] text-fg-muted hover:text-fg-default
                       hover:bg-bg-hover transition-colors border border-line"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
