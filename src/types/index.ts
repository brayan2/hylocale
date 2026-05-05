export interface HygraphCredentials {
  endpoint: string
  token: string
}

export interface HygraphLocale {
  id: string
  apiId: string
  displayName: string
  isDefault: boolean
}

export interface HygraphModel {
  id: string
  apiId: string
  displayName: string
  isLocalized: boolean
}

export interface LocaleCount {
  locale: string
  total: number
  translated: number
  percentage: number
}

export interface ModelLocalisationData {
  model: HygraphModel
  totalEntries: number
  locales: LocaleCount[]
  status: 'loading' | 'done' | 'error'
}

export interface MissingEntry {
  id: string
  title: string
  missingLocales: string[]
  studioUrl: string
}

export interface DrillDownData {
  modelApiId: string
  modelDisplayName: string
  locale: string
  missing: MissingEntry[]
  total: number
}

export interface StageHealthCount {
  locale: string
  published: number
  draftOnly: number
}

export interface ModelStageHealth {
  model: HygraphModel
  counts: StageHealthCount[] | null
  status: 'loading' | 'done' | 'error'
}
