import { useState } from 'react'
import { ArrowLeft, Palette, Monitor, Sun, Moon } from 'lucide-react'

type Props = {
  onBack: () => void
}

type SettingsTab = 'appearance'

export function SettingsPage({ onBack }: Props) {
  const [tab, setTab] = useState<SettingsTab>('appearance')
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('light')

  return (
    <div className="flex h-full bg-bg-base">
      {/* Left: settings nav */}
      <aside className="w-[220px] h-full flex flex-col bg-bg-panel border-r border-line">
        <div className="app-drag h-9 flex-shrink-0" />
        <div className="px-3 pb-3 app-no-drag">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[12.5px] text-fg-muted hover:text-fg-default
                       transition-colors mb-3"
          >
            <ArrowLeft size={13} strokeWidth={2.25} />
            Back
          </button>
          <div className="text-[13px] font-semibold text-fg-default">Settings</div>
        </div>
        <nav className="flex-1 px-2 app-no-drag">
          <NavItem
            icon={<Palette size={13} />}
            label="Appearance"
            active={tab === 'appearance'}
            onClick={() => setTab('appearance')}
          />
        </nav>
      </aside>

      {/* Right: settings content */}
      <main className="flex-1 flex flex-col min-h-0">
        <div className="app-drag h-9 flex-shrink-0" />
        <div className="flex-1 overflow-y-auto px-8 py-4">
          {tab === 'appearance' && (
            <div>
              <h2 className="text-[15px] font-semibold text-fg-default mb-1">Appearance</h2>
              <p className="text-[12.5px] text-fg-muted mb-5">Customize how ClaudeDance looks.</p>

              <div className="mb-6">
                <label className="text-[12.5px] font-medium text-fg-default block mb-2.5">Theme</label>
                <div className="flex gap-3">
                  <ThemeCard
                    icon={<Sun size={18} strokeWidth={1.5} />}
                    label="Light"
                    selected={theme === 'light'}
                    onClick={() => setTheme('light')}
                  />
                  <ThemeCard
                    icon={<Moon size={18} strokeWidth={1.5} />}
                    label="Dark"
                    selected={theme === 'dark'}
                    onClick={() => setTheme('dark')}
                  />
                  <ThemeCard
                    icon={<Monitor size={18} strokeWidth={1.5} />}
                    label="Auto"
                    selected={theme === 'auto'}
                    onClick={() => setTheme('auto')}
                  />
                </div>
                <p className="text-[11px] text-fg-subtle mt-2">
                  {theme === 'auto'
                    ? 'Follows your system preference.'
                    : theme === 'dark'
                      ? 'Dark theme is coming soon.'
                      : 'Currently active.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={
        'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] font-medium ' +
        'transition-colors mb-0.5 ' +
        (active
          ? 'bg-bg-hover text-fg-default'
          : 'text-fg-muted hover:bg-bg-hover/60 hover:text-fg-default')
      }
    >
      {icon}
      {label}
    </button>
  )
}

function ThemeCard({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={
        'flex flex-col items-center gap-2 px-5 py-4 rounded-lg border transition-all ' +
        (selected
          ? 'border-accent bg-accent-subtle text-fg-default shadow-sm'
          : 'border-line bg-bg-inset text-fg-muted hover:border-line-strong hover:text-fg-default')
      }
    >
      {icon}
      <span className="text-[12px] font-medium">{label}</span>
    </button>
  )
}
