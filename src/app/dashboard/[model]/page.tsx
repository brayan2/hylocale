import { DrillDownClient } from '@/components/drill-down-client'

export default async function DrillDownPage({
  params,
  searchParams,
}: {
  params: Promise<{ model: string }>
  searchParams: Promise<{ locale?: string; displayName?: string }>
}) {
  const { model } = await params
  const { locale, displayName } = await searchParams

  return (
    <DrillDownClient
      modelApiId={decodeURIComponent(model)}
      locale={locale ?? ''}
      modelDisplayName={displayName ?? model}
    />
  )
}
