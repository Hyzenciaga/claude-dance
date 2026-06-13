import { useState, useCallback, createContext, useContext, useRef, type ReactNode } from 'react'

type ToastItem = { id: number; message: string; type: 'success' | 'error' }

const ToastContext = createContext<(message: string, type?: 'success' | 'error') => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2000)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              'px-4 py-2 rounded-lg text-[13px] font-medium shadow-lg border ' +
              'animate-[toast-in_200ms_ease-out] ' +
              (t.type === 'error'
                ? 'bg-red-500/90 text-white border-red-400/50'
                : 'bg-bg-panel text-fg-default border-line')
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
