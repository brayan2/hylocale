'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  validateCredentials,
  fetchLocales,
  fetchModels,
  fetchTotalCount,
  fetchLocalisationCounts,
  fetchMissingForLocale,
} from '@/lib/hygraph'
import type {
  HygraphCredentials,
  HygraphLocale,
  HygraphModel,
  ModelLocalisationData,
  MissingEntry,
} from '@/types'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
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
  const [connectOpen, setConnectOpen] = useState(false)
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null)

  // Open connect dialog on first load
  useEffect(() => { setConnectOpen(true) }, [])

  function handleConnected(c: HygraphCredentials, dl: string) {
    setCreds(c)
    setDefaultLocale(dl)
    setConnectOpen(false)
  }

  function handleDisconnect() {
    setCreds(null)
    setDrillDown(null)
    setConnectOpen(true)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Persistent header ─────────────────────────────────────────────── */}
      <header className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Globe className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm tracking-tight">Localisation Checker</span>
            <span className="text-xs text-muted-foreground hidden sm:block">by Hygraph</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {creds ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConnectOpen(true)}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Change project</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Disconnect</span>
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setConnectOpen(true)} className="gap-1.5 text-xs">
                Connect project
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Main content — always the dashboard area ───────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        {creds ? (
          <DashboardContent
            creds={creds}
            defaultLocale={defaultLocale}
            onDrillDown={setDrillDown}
          />
        ) : (
          <EmptyState onConnect={() => setConnectOpen(true)} />
        )}
      </main>

      {/* ── Connect dialog ─────────────────────────────────────────────────── */}
      <Dialog open={connectOpen} onOpenChange={(o) => { if (!o && creds) setConnectOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect your Hygraph project</DialogTitle>
            <DialogDescription>
              Credentials stay in memory only — never stored or sent to any server.
            </DialogDescription>
          </DialogHeader>
          <ConnectForm onConnected={handleConnected} />
        </DialogContent>
      </Dialog>

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

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-32 gap-5">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Globe className="w-8 h-8 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-bold tracking-tight">No project connected</h2>
        <p className="text-muted-foreground text-sm mt-2 max-w-xs mx-auto">
          Connect your Hygraph project to see translation coverage across all models and locales.
        </p>
      </div>
      <Button onClick={onConnect} className="gap-2">
        Connect a project
      </Button>
      <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground mt-2">
        {['Read-only access', 'No account needed', 'All locales supported'].map(t => (
          <span key={t} className="bg-muted/60 px-2.5 py-1 rounded-full">{t}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Connect form ─────────────────────────────────────────────────────────────

function ConnectForm({ onConnected }: { onConnected: (c: HygraphCredentials, dl: string) => void }) {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="ep">Content API Endpoint</Label>
        <Input
          id="ep"
          type="url"
          placeholder="https://ap-southeast-2.cdn.hygraph.com/content/…/master"
          value={endpoint}
          onChange={e => setEndpoint(e.target.value)}
          required
          disabled={loading}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">Project Settings → API Access → Endpoints</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tk">API Token</Label>
        <div className="relative">
          <Input
            id="tk"
            type={showToken ? 'text' : 'password'}
            placeholder="eyJ…"
            value={token}
            onChange={e => setToken(e.target.value)}
            required
            disabled={loading}
            className="font-mono text-xs pr-10"
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Permanent Auth Token with read access only</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2.5">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" className="w-full gap-2" disabled={loading || !endpoint || !token}>
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Connecting…</> : 'Connect & check project'}
      </Button>
    </form>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

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
    a.download = 'localisation-coverage.csv'
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
                              <TooltipTrigger>
                                <button
                                  disabled={!canDrill}
                                  onClick={() => {
                                    if (!canDrill) return
                                    onDrillDown({
                                      modelApiId: row.model.apiId,
                                      modelType: row.model.id,
                                      modelDisplayName: row.model.displayName,
                                      locale: locale.apiId,
                                    })
                                  }}
                                  className={cn(
                                    'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors',
                                    cellColor(pct),
                                    canDrill ? 'cursor-pointer' : 'cursor-default',
                                  )}
                                >
                                  <StatusDot pct={pct} />
                                  {pct}%
                                </button>
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
      {/* Header */}
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

      {/* Search + actions */}
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

      {/* Scrollable list */}
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
