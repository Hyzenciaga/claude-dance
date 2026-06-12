import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { AskUserQuestionRequest, AskQuestion, QuestionOption } from '@shared/types'

type Result = { cancelled: true } | { cancelled: false; answers: Record<string, string>; response?: string }

type Props = {
  request: AskUserQuestionRequest
  onRespond: (result: Result) => void
}

type Selections = Record<string, string | string[]>

function OptionButton({
  option, selected, multi, onClick, onHover,
}: {
  option: QuestionOption
  selected: boolean
  multi: boolean
  onClick: () => void
  onHover: (preview: string | undefined) => void
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => onHover(option.preview)}
      onMouseLeave={() => onHover(undefined)}
      className={
        'w-full flex items-start gap-2.5 px-3 py-2 rounded-md border text-left transition-colors ' +
        (selected
          ? 'border-accent/60 bg-accent/10 text-fg-default'
          : 'border-line bg-bg-base hover:border-accent/30 hover:bg-bg-hover text-fg-muted')
      }
    >
      <span className={
        'mt-0.5 shrink-0 w-3.5 h-3.5 rounded-' + (multi ? 'sm' : 'full') +
        ' border flex items-center justify-center transition-colors ' +
        (selected ? 'border-accent bg-accent' : 'border-line/60')
      }>
        {selected && <Check size={9} strokeWidth={3} className="text-white" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="text-[12px] font-medium block">{option.label}</span>
        {option.description && (
          <span className="text-[11px] text-fg-subtle block mt-0.5">{option.description}</span>
        )}
      </span>
    </button>
  )
}

function QuestionStep({
  q,
  selection,
  onChange,
}: {
  q: AskQuestion
  selection: string | string[]
  onChange: (val: string | string[]) => void
}) {
  const [hoveredPreview, setHoveredPreview] = useState<string | undefined>()
  const [otherText, setOtherText] = useState(() => {
    // Restore freeform if current value doesn't match any option label
    if (!q.multiSelect) {
      const s = typeof selection === 'string' ? selection : ''
      const known = q.options.some((o) => o.label === s)
      return known ? '' : s
    }
    return ''
  })
  const [showOther, setShowOther] = useState(() => {
    if (!q.multiSelect) {
      const s = typeof selection === 'string' ? selection : ''
      return s.length > 0 && !q.options.some((o) => o.label === s)
    }
    return false
  })
  const otherInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showOther) otherInputRef.current?.focus()
  }, [showOther])

  function toggleOption(label: string) {
    if (q.multiSelect) {
      const arr = Array.isArray(selection) ? selection : []
      onChange(arr.includes(label) ? arr.filter((x) => x !== label) : [...arr, label])
    } else {
      onChange(label)
      setShowOther(false)
      setOtherText('')
    }
  }

  function handleOtherToggle() {
    const next = !showOther
    setShowOther(next)
    if (!q.multiSelect) onChange(next ? otherText : '')
    if (!next) setOtherText('')
  }

  function handleOtherInput(val: string) {
    setOtherText(val)
    if (!q.multiSelect) onChange(val)
  }

  const hasPreview = q.options.some((o) => o.preview)

  return (
    <div className={hasPreview ? 'flex gap-3' : ''}>
      <div className={`flex flex-col gap-1.5 ${hasPreview ? 'w-1/2' : 'w-full'}`}>
        {q.options.map((opt) => {
          const isSelected = q.multiSelect
            ? Array.isArray(selection) && selection.includes(opt.label)
            : selection === opt.label
          return (
            <OptionButton
              key={opt.label}
              option={opt}
              selected={isSelected}
              multi={q.multiSelect}
              onClick={() => toggleOption(opt.label)}
              onHover={setHoveredPreview}
            />
          )
        })}
        {/* Other */}
        <button
          onClick={handleOtherToggle}
          className={
            'w-full flex items-start gap-2.5 px-3 py-2 rounded-md border text-left transition-colors ' +
            (showOther
              ? 'border-accent/60 bg-accent/10 text-fg-default'
              : 'border-line bg-bg-base hover:border-accent/30 hover:bg-bg-hover text-fg-muted')
          }
        >
          <span className={
            'mt-0.5 shrink-0 w-3.5 h-3.5 rounded-' + (q.multiSelect ? 'sm' : 'full') +
            ' border flex items-center justify-center transition-colors ' +
            (showOther ? 'border-accent bg-accent' : 'border-line/60')
          }>
            {showOther && <Check size={9} strokeWidth={3} className="text-white" />}
          </span>
          <span className="text-[12px] font-medium">Other</span>
        </button>
        {showOther && (
          <input
            ref={otherInputRef}
            value={otherText}
            onChange={(e) => handleOtherInput(e.target.value)}
            placeholder="Type your answer…"
            className="w-full px-3 py-2 rounded-md border border-accent/40 bg-bg-base
                       text-[12px] text-fg-default placeholder:text-fg-subtle
                       focus:outline-none focus:border-accent"
          />
        )}
      </div>
      {hasPreview && (
        <div className="w-1/2 rounded-md border border-line bg-bg-inset overflow-hidden min-h-[120px]">
          {hoveredPreview ? (
            <pre className="p-2.5 text-[11px] font-mono leading-[1.5] text-fg-muted whitespace-pre-wrap break-all overflow-auto h-full">
              {hoveredPreview}
            </pre>
          ) : (
            <div className="h-full flex items-center justify-center text-[11px] text-fg-faint p-4">
              Hover an option to preview
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function AskUserDialog({ request, onRespond }: Props) {
  const total = request.questions.length
  const [step, setStep] = useState(0)
  const [selections, setSelections] = useState<Selections>(() => {
    const init: Selections = {}
    for (const q of request.questions) init[q.question] = q.multiSelect ? [] : ''
    return init
  })
  const [freeformText, setFreeformText] = useState('')

  const q: AskQuestion = request.questions[step]
  const sel = selections[q.question] ?? (q.multiSelect ? [] : '')

  function setFor(val: string | string[]) {
    setSelections((s) => ({ ...s, [q.question]: val }))
  }

  function stepAnswered(): boolean {
    if (q.multiSelect) return Array.isArray(sel) && sel.length > 0
    return typeof sel === 'string' && sel.length > 0
  }

  function handleNext() {
    if (step < total - 1) setStep(step + 1)
  }

  function handleBack() {
    if (step > 0) setStep(step - 1)
  }

  function handleSubmit() {
    const answers: Record<string, string> = {}
    for (const q of request.questions) {
      const s = selections[q.question]
      answers[q.question] = Array.isArray(s) ? s.join(', ') : (s ?? '')
    }
    onRespond({ cancelled: false, answers, response: freeformText.trim() || undefined })
  }

  function handleCancel() {
    onRespond({ cancelled: true })
  }

  const isLast = step === total - 1
  const allAnswered = request.questions.every((q) => {
    const s = selections[q.question]
    return q.multiSelect ? Array.isArray(s) && s.length > 0 : typeof s === 'string' && s.length > 0
  })

  return (
    <div className="px-6 py-2">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg border border-accent/30 bg-accent-subtle overflow-hidden">

          {/* Header with step indicators */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-accent/20">
            <MessageSquare size={13} className="text-accent shrink-0" />
            <span className="text-[12px] font-medium text-fg-default flex-1">Claude is asking…</span>

            {/* Step pills — clickable to jump back to any visited step */}
            {total > 1 && (
              <div className="flex items-center gap-1">
                {request.questions.map((sq, idx) => {
                  const answered = (() => {
                    const s = selections[sq.question]
                    return sq.multiSelect ? Array.isArray(s) && s.length > 0 : typeof s === 'string' && s.length > 0
                  })()
                  const isCurrent = idx === step
                  return (
                    <button
                      key={sq.question}
                      onClick={() => setStep(idx)}
                      title={sq.header}
                      className={
                        'h-5 px-1.5 rounded text-[10px] font-medium transition-colors ' +
                        (isCurrent
                          ? 'bg-accent text-white'
                          : answered
                            ? 'bg-accent/20 text-accent hover:bg-accent/30'
                            : 'bg-bg-inset text-fg-faint hover:bg-bg-hover')
                      }
                    >
                      {sq.header.length > 8 ? sq.header.slice(0, 8) + '…' : sq.header}
                    </button>
                  )
                })}
              </div>
            )}

            <button
              onClick={handleCancel}
              className="ml-1 p-0.5 rounded text-fg-subtle hover:text-fg-default hover:bg-bg-hover transition-colors"
              title="Cancel — Claude will continue without an answer"
            >
              <X size={12} />
            </button>
          </div>

          {/* Current question */}
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint bg-bg-inset border border-line px-1.5 py-0.5 rounded">
                {q.header}
              </span>
              <span className="text-[12.5px] text-fg-default">{q.question}</span>
              {total > 1 && (
                <span className="ml-auto text-[10.5px] text-fg-faint shrink-0">
                  {step + 1} / {total}
                </span>
              )}
            </div>
            <QuestionStep q={q} selection={sel} onChange={setFor} />
          </div>

          {/* Freeform notes — only on last step */}
          {isLast && (
            <div className="px-3 pb-3">
              <div className="text-[11px] text-fg-subtle mb-1 mt-2">Additional notes (optional)</div>
              <textarea
                value={freeformText}
                onChange={(e) => setFreeformText(e.target.value)}
                placeholder="Any extra context for Claude…"
                rows={2}
                className="w-full px-3 py-2 rounded-md border border-line bg-bg-base
                           text-[12px] text-fg-default placeholder:text-fg-subtle
                           focus:outline-none focus:border-accent resize-none"
              />
            </div>
          )}

          {/* Footer nav */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-accent/20">
            <button
              onClick={handleBack}
              disabled={step === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px]
                         text-fg-muted hover:text-fg-default hover:bg-bg-hover border border-line
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={12} />
              Back
            </button>

            <div className="flex items-center gap-2">
              {!isLast ? (
                <button
                  onClick={handleNext}
                  disabled={!stepAnswered()}
                  className="flex items-center gap-1 px-3 py-1 rounded-md text-[12px]
                             text-white bg-accent hover:bg-accent-hover
                             disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight size={12} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!allAnswered}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px]
                             text-white bg-accent hover:bg-accent-hover
                             disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Check size={12} />
                  Submit
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
