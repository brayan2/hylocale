'use client'

import { Button } from '@/components/ui/button'
import type { ModelLocalisationData, HygraphLocale } from '@/types'
import { Download } from 'lucide-react'

interface Props {
  data: ModelLocalisationData[]
  locales: HygraphLocale[]
}

export function ExportButton({ data, locales }: Props) {
  function handleExport() {
    const rows: string[][] = [
      ['Model', 'Total Entries', ...locales.map((l) => l.displayName + ' (%)'), ...locales.map((l) => l.displayName + ' (missing)')],
    ]

    for (const row of data) {
      if (row.status !== 'done') continue
      rows.push([
        row.model.displayName,
        String(row.totalEntries),
        ...locales.map((l) => {
          const ld = row.locales.find((x) => x.locale === l.apiId)
          return String(ld?.percentage ?? 0) + '%'
        }),
        ...locales.map((l) => {
          const ld = row.locales.find((x) => x.locale === l.apiId)
          return String((ld?.total ?? 0) - (ld?.translated ?? 0))
        }),
      ])
    }

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `localisation-coverage.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasData = data.some((d) => d.status === 'done')

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={!hasData}
      className="gap-1.5 text-xs h-8"
    >
      <Download className="w-3.5 h-3.5" />
      <span className="hidden sm:block">Export CSV</span>
    </Button>
  )
}
