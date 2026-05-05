'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  validateCredentials,
  fetchLocales,
  fetchModels,
  fetchTotalCount,
  fetchLocalisationCounts,
  fetchMissingForLocale,
  fetchLocalizationStageHealth,
} from '@/lib/hygraph'
import type {
  HygraphCredentials,
  HygraphLocale,
  HygraphModel,
  ModelLocalisationData,
  MissingEntry,
  ModelStageHealth,
} from '@/types'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Info,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Stethoscope,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DrillDown {
  modelApiId: string
  modelType: string
  modelDisplayName: string
  locale: string
}

type Tab = 'coverage' | 'diagnostics' | 'guide'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cellColor(pct: number) {
  if (pct === 100) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25'
  if (pct >= 75)   return 'bg-amber-400/15 text-amber-700 dark:text-amber-400 hover:bg-amber-400/25'
  if (pct >= 1)    return 'bg-orange-500/15 text-orange-700 dark:text-orange-400 hover:bg-orange-500/25'
  return 'bg-destructive/10 text-destructive hover:bg-destructive/20'
}

function StatusDot({ pct }: { pct: number }) {
  if (pct === 100) return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
  if (pct === 0)   return <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
  return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function AppClient() {
  const [creds, setCreds] = useState<HygraphCredentials | null>(null)
  const [defaultLocale, setDefaultLocale] = useState('en')
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('coverage')

  function handleConnected(c: HygraphCredentials, dl: string) {
    setCreds(c)
    setDefaultLocale(dl)
  }

  function handleDisconnect() {
    setCreds(null)
    setDrillDown(null)
    setActiveTab('coverage')
  }

  const tabs: { id: Tab; label: string; Icon: React.ElementType }[] = [
    { id: 'coverage',    label: 'Coverage',    Icon: Globe },
    { id: 'diagnostics', label: 'Diagnostics', Icon: Stethoscope },
    { id: 'guide',       label: 'Setup Guide', Icon: BookOpen },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Globe className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm tracking-tight">hylocale</span>
            <span className="text-xs text-muted-foreground hidden sm:block">by Hygraph</span>
          </div>

          {/* Desktop tabs */}
          <nav className="hidden sm:flex items-center gap-0.5 ml-4">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  activeTab === id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {creds && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Disconnect</span>
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>

        {/* ── Connect / connected bar ──────────────────────────────────────── */}
        <ConnectBar creds={creds} onConnected={handleConnected} onDisconnect={handleDisconnect} />

        {/* Mobile tabs */}
        <div className="sm:hidden flex border-t border-border/40">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
                activeTab === id
                  ? 'border-b-2 border-primary text-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'coverage' && (
          creds
            ? <DashboardContent creds={creds} defaultLocale={defaultLocale} onDrillDown={setDrillDown} />
            : <EmptyState />
        )}
        {activeTab === 'diagnostics' && (
          creds
            ? <DiagnosticsContent creds={creds} defaultLocale={defaultLocale} />
            : <EmptyState />
        )}
        {activeTab === 'guide' && <SetupGuideContent />}
      </main>

      {/* ── Drill-down sheet ──────────────────────────────────────────────── */}
      <Sheet open={!!drillDown} onOpenChange={(o) => { if (!o) setDrillDown(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col gap-0">
          {drillDown && creds && (
            <DrillDownPanel
              creds={creds}
              drillDown={drillDown}
              defaultLocale={defaultLocale}
              onClose={() => setDrillDown(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ─── Connect bar (header sub-row) ────────────────────────────────────────────

function ConnectBar({
  creds,
  onConnected,
  onDisconnect,
}: {
  creds: HygraphCredentials | null
  onConnected: (c: HygraphCredentials, dl: string) => void
  onDisconnect: () => void
}) {
  const [endpoint, setEndpoint] = useState('')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const ep = endpoint.trim()
      const tk = token.trim()
      if (!ep.startsWith('https://')) throw new Error('Endpoint must start with https://')
      const c = { endpoint: ep, token: tk }
      await validateCredentials(c)
      let dl = 'en'
      try { dl = (await fetchLocales(c))[0]?.apiId ?? 'en' } catch { /* fallback */ }
      onConnected(c, dl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      if (msg.includes('401') || msg.includes('403') || msg.toLowerCase().includes('unauthorized')) {
        setError('Invalid token — ensure it has Content API read access.')
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setError('Cannot reach the endpoint — check the URL and try again.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  if (creds) {
    const displayHost = creds.endpoint.replace('https://', '').split('/')[0]
    return (
      <div className="border-t border-border/40 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-9 flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="truncate hidden sm:block">{displayHost}</span>
          <span className="sm:hidden font-medium text-foreground">Project connected</span>
          <button
            onClick={onDisconnect}
            className="ml-auto flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Change project
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-border/40 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 space-y-1.5">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Input
            type="url"
            placeholder="https://ap-southeast-2.cdn.hygraph.com/content/…/master"
            value={endpoint}
            onChange={e => setEndpoint(e.target.value)}
            required
            disabled={loading}
            className="font-mono text-xs h-8 flex-1 min-w-0"
            aria-label="Content API Endpoint"
          />
          <div className="relative w-full sm:w-52 shrink-0">
            <Input
              type={showToken ? 'text' : 'password'}
              placeholder="API Token (eyJ…)"
              value={token}
              onChange={e => setToken(e.target.value)}
              required
              disabled={loading}
              className="font-mono text-xs h-8 pr-9"
              aria-label="API Token"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              tabIndex={-1}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <Button
            type="submit"
            size="sm"
            className="h-8 gap-1.5 text-xs whitespace-nowrap shrink-0"
            disabled={loading || !endpoint || !token}
          >
            {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Connecting…</> : 'Connect project'}
          </Button>
        </form>

        {error ? (
          <p className="flex items-center gap-1.5 text-[11px] text-destructive">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {error}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Project Settings → API Access → Endpoints · Credentials stay in memory only, never stored
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-32 gap-4">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
        <Globe className="w-7 h-7 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-base font-semibold tracking-tight">No project connected</h2>
        <p className="text-muted-foreground text-sm mt-1.5 max-w-xs mx-auto">
          Enter your endpoint and token in the bar above to get started.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
        {['Read-only access', 'No account needed', 'All locales supported'].map(t => (
          <span key={t} className="bg-muted/60 px-2.5 py-1 rounded-full">{t}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Coverage dashboard ───────────────────────────────────────────────────────

function DashboardContent({
  creds,
  defaultLocale,
  onDrillDown,
}: {
  creds: HygraphCredentials
  defaultLocale: string
  onDrillDown: (d: DrillDown) => void
}) {
  const [locales, setLocales] = useState<HygraphLocale[]>([])
  const [data, setData] = useState<ModelLocalisationData[]>([])
  const [booting, setBooting] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setBooting(true)
    setError(null)
    setData([])
    try {
      const [locs, models] = await Promise.all([fetchLocales(creds), fetchModels(creds)])
      setLocales(locs)
      setData(models.map(m => ({
        model: m,
        totalEntries: 0,
        locales: locs.map(l => ({ locale: l.apiId, total: 0, translated: 0, percentage: 0 })),
        status: 'loading',
      })))
      setBooting(false)

      for (const model of models) {
        try {
          const total = await fetchTotalCount(creds, model.apiId)
          const counts = await fetchLocalisationCounts(creds, model.apiId, locs.map(l => l.apiId), total)
          setData(prev => prev.map(d => d.model.id !== model.id ? d : {
            ...d,
            totalEntries: total,
            locales: locs.map(l => ({
              locale: l.apiId,
              total,
              translated: counts[l.apiId] ?? 0,
              percentage: total > 0 ? Math.round(((counts[l.apiId] ?? 0) / total) * 100) : 100,
            })),
            status: 'done',
          }))
        } catch {
          setData(prev => prev.map(d => d.model.id !== model.id ? d : { ...d, status: 'error' }))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setBooting(false)
    }
  }, [creds])

  useEffect(() => { load() }, [load])

  const done = data.filter(d => d.status === 'done')
  const overallPct = done.length && locales.length
    ? Math.round(done.flatMap(d => d.locales).reduce((s, l) => s + l.percentage, 0) / (done.length * locales.length))
    : 0

  function exportCSV() {
    const rows = [
      ['Model', 'Total', ...locales.map(l => l.displayName + ' (%)')],
      ...done.map(row => [
        row.model.displayName,
        String(row.totalEntries),
        ...locales.map(l => (row.locales.find(x => x.locale === l.apiId)?.percentage ?? 0) + '%'),
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'hylocale-coverage.csv'
    a.click()
  }

  if (error) return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <XCircle className="w-10 h-10 text-destructive" />
      <p className="font-semibold">Failed to load project</p>
      <p className="text-sm text-muted-foreground">{error}</p>
      <Button onClick={load} variant="outline" className="gap-2">
        <RefreshCw className="w-4 h-4" /> Try again
      </Button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Translation Coverage</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {booting ? 'Loading models…' : `${data.length} localised models · click any cell to inspect missing entries`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!booting && done.length > 0 && (
            <Badge variant="secondary" className={cn(
              'font-semibold tabular-nums',
              overallPct === 100 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : overallPct >= 75 ? 'bg-amber-400/15 text-amber-700 dark:text-amber-400'
                : 'bg-destructive/10 text-destructive',
            )}>
              {overallPct}% overall
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={load} className="h-8 gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!done.length} className="h-8 gap-1.5">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Matrix */}
      <div className="rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold sticky left-0 bg-muted/50 min-w-[180px] z-10">Model</th>
                <th className="text-center px-3 py-3 font-semibold min-w-[72px]">Entries</th>
                {booting
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <th key={i} className="px-3 py-3 min-w-[110px]"><Skeleton className="h-4 w-16 mx-auto" /></th>
                    ))
                  : locales.map(locale => (
                      <th key={locale.apiId} className="text-center px-3 py-3 font-semibold min-w-[110px]">
                        <div className="flex flex-col items-center gap-1">
                          <span>{locale.displayName}</span>
                          {locale.isDefault && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">default</Badge>
                          )}
                        </div>
                      </th>
                    ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {booting
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="bg-background">
                      <td className="px-4 py-3 sticky left-0 bg-background"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-3 py-3 text-center"><Skeleton className="h-4 w-10 mx-auto" /></td>
                      {Array.from({ length: 3 }).map((_, j) => (
                        <td key={j} className="px-3 py-3 text-center"><Skeleton className="h-8 w-20 mx-auto rounded-lg" /></td>
                      ))}
                    </tr>
                  ))
                : data.map(row => (
                    <tr key={row.model.id} className="bg-background hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 sticky left-0 bg-background font-medium">
                        <div className="flex items-center gap-2">
                          {row.status === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                          {row.model.displayName}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-muted-foreground">
                        {row.status === 'loading' ? <Skeleton className="h-4 w-8 mx-auto" />
                          : row.status === 'error' ? '—'
                          : row.totalEntries.toLocaleString()}
                      </td>
                      {locales.map(locale => {
                        const ld = row.locales.find(l => l.locale === locale.apiId)
                        const pct = ld?.percentage ?? 0
                        const total = ld?.total ?? 0
                        const missing = total - (ld?.translated ?? 0)
                        const canDrill = pct < 100 && total > 0 && row.status === 'done'

                        if (row.status === 'loading')
                          return <td key={locale.apiId} className="px-3 py-3 text-center"><Skeleton className="h-8 w-20 mx-auto rounded-lg" /></td>
                        if (row.status === 'error')
                          return <td key={locale.apiId} className="px-3 py-3 text-center text-muted-foreground text-xs">—</td>

                        return (
                          <td key={locale.apiId} className="px-3 py-3 text-center">
                            <Tooltip>
                              <TooltipTrigger
                                disabled={!canDrill}
                                onClick={canDrill ? () => onDrillDown({
                                  modelApiId: row.model.apiId,
                                  modelType: row.model.id,
                                  modelDisplayName: row.model.displayName,
                                  locale: locale.apiId,
                                }) : undefined}
                                className={cn(
                                  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors',
                                  cellColor(pct),
                                  canDrill ? 'cursor-pointer' : 'cursor-default',
                                )}
                              >
                                <StatusDot pct={pct} />
                                {pct}%
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                {total === 0 ? 'No entries'
                                  : pct === 100 ? `All ${total} entries translated`
                                  : <>{missing} missing of {total} · click to inspect</>}
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      {!booting && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {[
            { c: 'bg-emerald-500/15', l: '100% — fully translated' },
            { c: 'bg-amber-400/15',   l: '75–99% — mostly done' },
            { c: 'bg-orange-500/15',  l: '1–74% — needs attention' },
            { c: 'bg-destructive/10', l: '0% — not started' },
          ].map(({ c, l }) => (
            <div key={l} className="flex items-center gap-1.5">
              <div className={cn('w-3 h-3 rounded-sm', c)} />
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Drill-down panel ─────────────────────────────────────────────────────────

function DrillDownPanel({
  creds,
  drillDown,
  defaultLocale,
  onClose,
}: {
  creds: HygraphCredentials
  drillDown: DrillDown
  defaultLocale: string
  onClose: () => void
}) {
  const [entries, setEntries] = useState<MissingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(null); setProgress(0); setEntries([])
    try {
      const missing = await fetchMissingForLocale(
        creds, drillDown.modelApiId, drillDown.modelType,
        drillDown.locale, defaultLocale, n => setProgress(n),
      )
      setEntries(missing)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [creds, drillDown, defaultLocale])

  useEffect(() => { load() }, [load])

  const filtered = entries.filter(
    e => e.title.toLowerCase().includes(search.toLowerCase()) || e.id.toLowerCase().includes(search.toLowerCase()),
  )

  function exportCSV() {
    const rows = [['Entry ID', 'Title', 'Missing Locale', 'Studio URL'],
      ...entries.map(e => [e.id, e.title, drillDown.locale, e.studioUrl])]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `missing-${drillDown.locale}-${drillDown.modelApiId}.csv`
    a.click()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-0.5">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-0.5 -ml-0.5">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="font-semibold text-sm">
            {drillDown.modelDisplayName} ·{' '}
            <span className="text-primary">{drillDown.locale.replace(/_/g, '-')}</span>
          </h2>
        </div>
        <p className="text-xs text-muted-foreground ml-6">
          Entries missing a {drillDown.locale.replace(/_/g, '-')} translation
        </p>
      </div>

      {!loading && entries.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm bg-background"
            />
          </div>
          <Badge variant="secondary" className="bg-destructive/10 text-destructive shrink-0 font-semibold">
            {entries.length}
          </Badge>
          <Button variant="outline" size="sm" onClick={exportCSV} className="h-8 gap-1.5 shrink-0">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
            <XCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={load} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </Button>
          </div>
        ) : loading ? (
          <div className="px-6 py-4 space-y-3">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Scanning{progress > 0 ? ` — ${progress} checked so far` : '…'}
            </p>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2 gap-4">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-7 w-20 rounded-lg shrink-0" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="font-semibold">All translated!</p>
            <p className="text-sm text-muted-foreground">
              Every {drillDown.modelDisplayName} entry has a {drillDown.locale.replace(/_/g, '-')} localisation.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No entries match &ldquo;{search}&rdquo;
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map((entry, i) => (
              <div
                key={entry.id}
                className={cn(
                  'flex items-center justify-between px-5 py-3 gap-4 hover:bg-muted/30 transition-colors',
                  i % 2 === 1 && 'bg-muted/10',
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{entry.title || '(Untitled)'}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{entry.id}</p>
                </div>
                {entry.studioUrl !== '#' && (
                  <a href={entry.studioUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                      Studio <ExternalLink className="w-3 h-3" />
                    </Button>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && filtered.length < entries.length && (
        <div className="px-5 py-2 border-t border-border text-xs text-muted-foreground text-right shrink-0">
          Showing {filtered.length} of {entries.length}
        </div>
      )}
    </div>
  )
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

function DiagnosticsContent({
  creds,
  defaultLocale: _defaultLocale,
}: {
  creds: HygraphCredentials
  defaultLocale: string
}) {
  const [locales, setLocales] = useState<HygraphLocale[]>([])
  const [healthData, setHealthData] = useState<ModelStageHealth[]>([])
  const [booting, setBooting] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setBooting(true)
    setError(null)
    setHealthData([])
    try {
      const [locs, models] = await Promise.all([fetchLocales(creds), fetchModels(creds)])
      setLocales(locs)
      const nonDefault = locs.filter(l => !l.isDefault).map(l => l.apiId)

      setHealthData(models.map(m => ({ model: m, counts: null, status: 'loading' })))
      setBooting(false)

      for (const model of models) {
        try {
          const counts = await fetchLocalizationStageHealth(creds, model.apiId, nonDefault)
          setHealthData(prev => prev.map(d =>
            d.model.id !== model.id ? d : { ...d, counts, status: 'done' },
          ))
        } catch {
          setHealthData(prev => prev.map(d =>
            d.model.id !== model.id ? d : { ...d, status: 'error' },
          ))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setBooting(false)
    }
  }, [creds])

  useEffect(() => { load() }, [load])

  const nonDefaultLocales = locales.filter(l => !l.isDefault)
  const doneRows = healthData.filter(d => d.status === 'done')
  const allUnsupported = doneRows.length > 0 && doneRows.every(d => d.counts === null)
  const totalUnpublished = doneRows
    .flatMap(d => d.counts ?? [])
    .reduce((sum, c) => sum + c.draftOnly, 0)

  if (error) return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <XCircle className="w-10 h-10 text-destructive" />
      <p className="font-semibold">Failed to load diagnostics</p>
      <p className="text-sm text-muted-foreground">{error}</p>
      <Button onClick={load} variant="outline" className="gap-2">
        <RefreshCw className="w-4 h-4" /> Try again
      </Button>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Localization Diagnostics</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Detects entries translated but not yet published — the most common cause of null API responses after a Lokalise or Crowdin import.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!booting && !allUnsupported && totalUnpublished > 0 && (
            <Badge className="bg-amber-400/15 text-amber-700 dark:text-amber-400 font-semibold border-0">
              {totalUnpublished} unpublished
            </Badge>
          )}
          {!booting && !allUnsupported && totalUnpublished === 0 && doneRows.length > 0 && (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold border-0">
              All published
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={load} className="h-8 gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stage comparison unavailable */}
      {!booting && allUnsupported && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold">Automatic stage comparison unavailable</p>
              <p className="text-sm text-muted-foreground">
                This project&apos;s API version doesn&apos;t support querying DRAFT vs PUBLISHED counts
                programmatically. Use the manual steps below to find unpublished translations in Studio.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border p-5 space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              How to find unpublished translations manually
            </h2>
            <ol className="list-decimal list-outside pl-4 space-y-3 text-sm text-muted-foreground">
              <li>
                Open <strong>Hygraph Studio</strong> and go to <strong>Content</strong>.
              </li>
              <li>
                Select a localised model (e.g. Articles, Pages) from the left sidebar.
              </li>
              <li>
                Click the <strong>Filter</strong> button (top of the entry list) and add a{' '}
                <strong>Stage = Draft</strong> filter.
              </li>
              <li>
                Switch the locale selector (top-right of the content view) to each non-default locale in turn.
                Entries visible here exist only in Draft — they return{' '}
                <code className="bg-muted px-1 rounded text-[11px]">null</code> via the Content API.
              </li>
              <li>
                Select all Draft-only entries and click <strong>Publish</strong> to make them live.
              </li>
              <li>Repeat for each localised model.</li>
            </ol>
            <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
              <strong>Tip:</strong> After publishing, refresh the Coverage tab here to confirm translation
              percentages updated — this is the fastest way to verify the fix worked.
            </div>
          </div>
        </div>
      )}

      {/* Stage health matrix */}
      {booting ? (
        <div className="rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold sticky left-0 bg-muted/50 min-w-[180px]">Model</th>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <th key={i} className="px-3 py-3 min-w-[150px]"><Skeleton className="h-4 w-16 mx-auto" /></th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="bg-background">
                    <td className="px-4 py-3 sticky left-0 bg-background"><Skeleton className="h-4 w-32" /></td>
                    {Array.from({ length: 3 }).map((_, j) => (
                      <td key={j} className="px-3 py-3 text-center"><Skeleton className="h-8 w-32 mx-auto rounded-lg" /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : nonDefaultLocales.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Globe className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">This project only has one locale — nothing to diagnose.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold sticky left-0 bg-muted/50 min-w-[180px] z-10">Model</th>
                  {nonDefaultLocales.map(l => (
                    <th key={l.apiId} className="text-center px-3 py-3 font-semibold min-w-[160px]">
                      {l.displayName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {healthData.map(row => (
                  <tr key={row.model.id} className="bg-background hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 sticky left-0 bg-background font-medium">
                      {row.model.displayName}
                    </td>
                    {nonDefaultLocales.map(locale => {
                      if (row.status === 'loading')
                        return (
                          <td key={locale.apiId} className="px-3 py-3 text-center">
                            <Skeleton className="h-8 w-32 mx-auto rounded-lg" />
                          </td>
                        )

                      if (row.status === 'error')
                        return (
                          <td key={locale.apiId} className="px-3 py-3 text-center text-muted-foreground text-xs">
                            —
                          </td>
                        )

                      if (row.counts === null)
                        return (
                          <td key={locale.apiId} className="px-3 py-3 text-center">
                            <span className="text-xs text-muted-foreground italic">no draft access</span>
                          </td>
                        )

                      const count = row.counts.find(c => c.locale === locale.apiId)
                      const draftOnly = count?.draftOnly ?? 0
                      const published = count?.published ?? 0

                      return (
                        <td key={locale.apiId} className="px-3 py-3 text-center">
                          {draftOnly > 0 ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-amber-400/15 text-amber-700 dark:text-amber-400 cursor-default">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  {draftOnly} unpublished
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-72">
                                {draftOnly} {locale.displayName} translation{draftOnly !== 1 ? 's' : ''} exist in Draft
                                but {draftOnly !== 1 ? 'have' : 'has'} not been published. These entries return{' '}
                                <code>null</code> via the Content API. Open them in Studio and click Publish.
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              {published} published
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Known patterns */}
      <div className="rounded-xl border border-border p-5 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Common localization failure patterns
        </h2>
        <div className="space-y-4 text-sm">
          <div className="flex gap-3">
            <span className="shrink-0 w-5 h-5 rounded-full bg-amber-400/15 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
            <div className="space-y-1">
              <p className="font-medium">Imported but not published</p>
              <p className="text-muted-foreground text-xs">
                After a Lokalise or Crowdin import, translations land in <strong>Draft</strong> stage. The Content API only
                serves <strong>Published</strong> content by default, so these entries return <code className="bg-muted px-1 rounded text-[11px]">null</code>.
                Use the table above to spot mismatches. Fix: open each entry in Studio and click <em>Publish</em>.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="shrink-0 w-5 h-5 rounded-full bg-amber-400/15 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center justify-center mt-0.5">2</span>
            <div className="space-y-1">
              <p className="font-medium">Nested components returning null</p>
              <p className="text-muted-foreground text-xs">
                An entry may be translated and published, but if a <em>referenced component</em> inside it lacks the same
                locale translation, that reference field returns <code className="bg-muted px-1 rounded text-[11px]">null</code>.
                Check each component model in the Coverage tab. Fix: open each component and publish its locale variant.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="shrink-0 w-5 h-5 rounded-full bg-amber-400/15 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center justify-center mt-0.5">3</span>
            <div className="space-y-1">
              <p className="font-medium">Bulk import fails silently</p>
              <p className="text-muted-foreground text-xs">
                Lokalise may report a successful bulk import while content doesn&apos;t actually sync. Verify by checking the
                Coverage tab immediately after each import. Workaround: use single-entry exports for reliability.
                Large batch operations (&gt;10 entries) are most prone to this issue.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Setup Guide ──────────────────────────────────────────────────────────────

type Integration = 'lokalise' | 'crowdin' | 'smartling'

function SetupGuideContent() {
  const [integration, setIntegration] = useState<Integration>('lokalise')

  const integrations: { id: Integration; label: string; tag: string; tagColor: string }[] = [
    { id: 'lokalise',  label: 'Lokalise',           tag: 'Most common',   tagColor: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
    { id: 'crowdin',   label: 'Crowdin Enterprise', tag: 'Setup issues',  tagColor: 'bg-amber-400/15 text-amber-700 dark:text-amber-400' },
    { id: 'smartling', label: 'Smartling',          tag: 'Complex models', tagColor: 'bg-purple-500/15 text-purple-700 dark:text-purple-400' },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Integration Setup Guide</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Step-by-step setup, credential requirements, and known issue workarounds for each integration.
        </p>
      </div>

      {/* Integration picker */}
      <div className="flex gap-2 flex-wrap">
        {integrations.map(({ id, label, tag, tagColor }) => (
          <button
            key={id}
            onClick={() => setIntegration(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
              integration === id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            {label}
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded font-semibold',
              integration === id ? 'bg-white/20 text-white' : tagColor,
            )}>
              {tag}
            </span>
          </button>
        ))}
      </div>

      {/* Guide content */}
      {integration === 'lokalise' && (
        <div className="space-y-5">
          <InfoBox variant="info">
            Lokalise works well for simple content models. Limitations surface at scale with nested/relational content
            and large bulk operations. Use single-entry exports for reliability until bulk sync issues are resolved.
          </InfoBox>

          <GuideSection title="Prerequisites">
            <ol className="list-decimal list-outside pl-4 space-y-1.5 text-sm text-muted-foreground">
              <li>Hygraph project with localisation enabled (at least 2 locales)</li>
              <li>Lokalise account with a project created for your content</li>
              <li>Hygraph Permanent Auth Token with <strong>Content API read/write</strong> access</li>
            </ol>
          </GuideSection>

          <GuideSection title="Connect Lokalise to Hygraph">
            <ol className="list-decimal list-outside pl-4 space-y-2 text-sm text-muted-foreground">
              <li>In Hygraph Studio, go to <strong>Apps → Browse Apps → Lokalise</strong> and click Install.</li>
              <li>In the app settings, paste your <strong>Hygraph Content API endpoint</strong> and a token with read/write access.</li>
              <li>In Lokalise, create a project and note the <strong>Project ID</strong> (found in Project Settings).</li>
              <li>Back in Hygraph, enter the Lokalise Project ID and your <strong>Lokalise API token</strong>.</li>
              <li>Click <strong>Save &amp; Test Connection</strong> — a green checkmark confirms the link.</li>
            </ol>
          </GuideSection>

          <GuideSection title="Known issues &amp; workarounds">
            <div className="space-y-4">
              <Issue
                title="Bulk export/import fails silently"
                severity="high"
                description="The UI reports success but content doesn't appear in Lokalise, or imported translations don't come back to Hygraph."
                workaround="Export and import one entry at a time. For batches, keep under 5 entries per operation. After each import, verify in the Coverage tab that counts changed. Engineering is tracking this in BND-4253."
              />
              <Issue
                title="Translated content returns null after import"
                severity="high"
                description="After importing translations from Lokalise, the localized fields appear correct in Studio but return null when queried via the Content API."
                workaround="The import writes to Draft stage. You must open each translated entry in Studio and click Publish to make it live. Use the Diagnostics tab to spot entries in this state. This is the most common support request."
              />
              <Issue
                title="Nested / referenced components not syncing"
                severity="medium"
                description="Top-level entries translate correctly, but components referenced inside them (e.g. hero blocks, card components) remain in the default locale only."
                workaround="Lokalise currently syncs at the entry level, not the reference level. Translate and publish each referenced component model separately. A page-level bulk sync feature is tracked in BND-4253."
              />
            </div>
          </GuideSection>

          <GuideSection title="When to escalate to Smartling">
            <p className="text-sm text-muted-foreground">
              Consider Smartling when the customer has: large volumes of structured relational content, automated
              translation workflows, multiple nested component models, or has already hit repeated Lokalise bulk
              failures. See the Smartling tab for details.
            </p>
          </GuideSection>
        </div>
      )}

      {integration === 'crowdin' && (
        <div className="space-y-5">
          <InfoBox variant="warning">
            The most common Crowdin Enterprise setup issue is the <strong>Organization Name</strong> field — the
            correct value is not always obvious and differs between Crowdin.com and Crowdin Enterprise accounts.
          </InfoBox>

          <GuideSection title="Crowdin.com vs Crowdin Enterprise">
            <p className="text-sm text-muted-foreground">
              These are two separate products with different credential requirements. Verify which one the customer
              has before troubleshooting.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-border p-3 space-y-1">
                <p className="font-semibold text-foreground">Crowdin.com</p>
                <p className="text-muted-foreground">Standard SaaS. Organization Name field: <strong>leave blank</strong>.</p>
              </div>
              <div className="rounded-lg border border-border p-3 space-y-1">
                <p className="font-semibold text-foreground">Crowdin Enterprise</p>
                <p className="text-muted-foreground">Self-hosted / enterprise. Organization Name: use your <strong>subdomain</strong> (e.g. if your URL is <code>mycompany.crowdin.com</code>, enter <code>mycompany</code>).</p>
              </div>
            </div>
          </GuideSection>

          <GuideSection title="Generate a PAT with correct scopes">
            <ol className="list-decimal list-outside pl-4 space-y-2 text-sm text-muted-foreground">
              <li>In Crowdin (or Crowdin Enterprise), go to <strong>Account Settings → API → Personal Access Tokens</strong>.</li>
              <li>Click <strong>New Token</strong>.</li>
              <li>Under Scopes, select <strong>All</strong> (or at minimum: <em>Projects</em> with full access). Tokens scoped to a single project have caused &quot;Invalid credentials&quot; errors even with correct credentials.</li>
              <li>Copy the token — it&apos;s only shown once.</li>
            </ol>
          </GuideSection>

          <GuideSection title="Connect Crowdin to Hygraph">
            <ol className="list-decimal list-outside pl-4 space-y-2 text-sm text-muted-foreground">
              <li>In Hygraph Studio, go to <strong>Apps → Crowdin</strong> and click Install.</li>
              <li><strong>API Key</strong>: paste the PAT you created above.</li>
              <li><strong>Project ID</strong>: found in your Crowdin project URL (numeric ID).</li>
              <li><strong>Organization Name</strong>: follow the Crowdin.com vs Enterprise guidance above.</li>
              <li>Click <strong>Save</strong>. If you see &quot;Invalid credentials&quot;, double-check Organization Name first, then verify the PAT scope.</li>
            </ol>
          </GuideSection>

          <GuideSection title="Troubleshooting Invalid credentials">
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Work through these in order:</p>
              <ol className="list-decimal list-outside pl-4 space-y-1.5">
                <li>Confirm you&apos;re using Crowdin Enterprise, not Crowdin.com (or vice versa).</li>
                <li>Try leaving Organization Name <strong>blank</strong> first, regardless of account type.</li>
                <li>If blank doesn&apos;t work for Enterprise, use only the subdomain part of your URL.</li>
                <li>Regenerate the PAT with <strong>all scopes</strong> selected.</li>
                <li>Ensure the API token was generated from the correct Crowdin workspace (Enterprise workspaces are separate from personal accounts).</li>
              </ol>
            </div>
          </GuideSection>
        </div>
      )}

      {integration === 'smartling' && (
        <div className="space-y-5">
          <InfoBox variant="info">
            Smartling is better suited than Lokalise for high-volume structured content, automated translation
            pipelines, and complex nested content models. Recommend it when customers have already hit Lokalise
            scale limitations.
          </InfoBox>

          <GuideSection title="When to choose Smartling over Lokalise">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Smartling is the better fit when the customer has:</p>
              <ul className="list-disc list-outside pl-4 space-y-1.5">
                <li>Large content volumes (hundreds or thousands of entries across multiple locales)</li>
                <li>Deeply nested or relational content models (components referencing other components)</li>
                <li>Automated translation workflows (TM leverage, MT integration, review pipelines)</li>
                <li>Experienced repeated bulk import/export failures with Lokalise</li>
                <li>Enterprise teams requiring audit trails and workflow approval processes</li>
              </ul>
              <p className="mt-2">Lokalise is still the right choice for simpler setups with a small number of locales and flat content models.</p>
            </div>
          </GuideSection>

          <GuideSection title="Connect Smartling to Hygraph">
            <ol className="list-decimal list-outside pl-4 space-y-2 text-sm text-muted-foreground">
              <li>In Hygraph Studio, go to <strong>Apps → Smartling</strong> and click Install.</li>
              <li>From your Smartling account, copy the <strong>User Identifier</strong> and <strong>Token Secret</strong> (found under Account Settings → API).</li>
              <li>Also copy your <strong>Project ID</strong> from the Smartling project settings.</li>
              <li>Paste all three values into the Hygraph Smartling app settings and click Save.</li>
              <li>Verify the connection — Smartling should list your Hygraph models for field mapping.</li>
            </ol>
          </GuideSection>

          <GuideSection title="Key differences in workflow">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Compared to Lokalise, expect these workflow differences:</p>
              <ul className="list-disc list-outside pl-4 space-y-1.5">
                <li>Translations are submitted as <strong>jobs</strong> with explicit review and approval steps.</li>
                <li>Translation Memory (TM) is leveraged automatically across projects — faster and cheaper for repetitive content.</li>
                <li>Bulk operations are more reliable at scale due to Smartling&apos;s queue-based architecture.</li>
                <li>Translations still land in <strong>Draft</strong> after import — use the Diagnostics tab to verify publish state.</li>
              </ul>
            </div>
          </GuideSection>
        </div>
      )}
    </div>
  )
}

// ─── Setup guide sub-components ───────────────────────────────────────────────

function InfoBox({ children, variant }: { children: React.ReactNode; variant: 'info' | 'warning' }) {
  const styles = variant === 'warning'
    ? 'border-amber-400/40 bg-amber-400/5'
    : 'border-blue-500/30 bg-blue-500/5'
  const Icon = variant === 'warning' ? AlertTriangle : Info
  const iconColor = variant === 'warning' ? 'text-amber-500' : 'text-blue-500'

  return (
    <div className={cn('rounded-xl border p-4 flex gap-3', styles)}>
      <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', iconColor)} />
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

function GuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-5 space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  )
}

function Issue({
  title,
  severity,
  description,
  workaround,
}: {
  title: string
  severity: 'high' | 'medium'
  description: string
  workaround: string
}) {
  const severityColor = severity === 'high'
    ? 'bg-destructive/10 text-destructive'
    : 'bg-amber-400/15 text-amber-700 dark:text-amber-400'

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm font-medium">{title}</p>
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide', severityColor)}>
          {severity}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="rounded-lg bg-muted/50 px-3 py-2">
        <p className="text-xs"><span className="font-semibold">Workaround:</span> {workaround}</p>
      </div>
    </div>
  )
}
