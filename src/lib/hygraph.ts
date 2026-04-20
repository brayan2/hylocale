import type { HygraphCredentials, HygraphLocale, HygraphModel, MissingEntry } from '@/types'

const INTROSPECTION_QUERY = `
  query IntrospectSchema {
    __schema {
      types {
        name
        kind
        fields {
          name
          type {
            name
            kind
          }
        }
      }
    }
  }
`

const LOCALES_QUERY = `
  query GetLocales {
    _locales: __type(name: "_Locales") {
      enumValues {
        name
      }
    }
  }
`

async function gql(endpoint: string, token: string, query: string, variables = {}) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!res.ok) {
    throw new Error(`Hygraph API error: ${res.status} ${res.statusText}`)
  }

  const json = await res.json()
  if (json.errors?.length) {
    throw new Error(json.errors[0].message)
  }
  return json.data
}

export async function validateCredentials(creds: HygraphCredentials): Promise<void> {
  await gql(creds.endpoint, creds.token, `{ __typename }`)
}

export async function fetchLocales(creds: HygraphCredentials): Promise<HygraphLocale[]> {
  const data = await gql(creds.endpoint, creds.token, LOCALES_QUERY)
  const values: Array<{ name: string }> = data?._locales?.enumValues ?? []

  return values.map((v, i) => ({
    id: v.name,
    apiId: v.name,
    displayName: v.name.replace('_', '-'),
    isDefault: i === 0,
  }))
}

export async function fetchModels(creds: HygraphCredentials): Promise<HygraphModel[]> {
  const data = await gql(creds.endpoint, creds.token, INTROSPECTION_QUERY)
  const types = data.__schema.types as Array<{
    name: string
    kind: string
    fields: Array<{ name: string; type: { name: string; kind: string } }> | null
  }>

  return types
    .filter(
      (t) =>
        t.kind === 'OBJECT' &&
        !t.name.startsWith('__') &&
        !t.name.startsWith('_') &&
        !t.name.startsWith('Aggregate') &&
        !t.name.startsWith('Page') &&
        t.fields !== null &&
        t.fields.some((f) => f.name === 'locale'),
    )
    .map((t) => ({
      id: t.name,
      apiId: t.name.charAt(0).toLowerCase() + t.name.slice(1) + 's',
      displayName: t.name.replace(/([A-Z])/g, ' $1').trim(),
      isLocalized: true,
    }))
}

export async function fetchLocalisationCounts(
  creds: HygraphCredentials,
  modelName: string,
  locales: string[],
): Promise<Record<string, number>> {
  const countQuery = `
    query CountLocales($locales: [Locale!]!) {
      ${locales
        .map(
          (locale) => `
        ${locale}: ${modelName}Connection(locales: [${locale}], where: { localizations_some: { locale: ${locale} } }) {
          aggregate { count }
        }
      `,
        )
        .join('\n')}
    }
  `

  const data = await gql(creds.endpoint, creds.token, countQuery)
  const counts: Record<string, number> = {}
  for (const locale of locales) {
    counts[locale] = data[locale]?.aggregate?.count ?? 0
  }
  return counts
}

export async function fetchTotalCount(
  creds: HygraphCredentials,
  modelName: string,
): Promise<number> {
  const query = `
    query TotalCount {
      connection: ${modelName}Connection {
        aggregate { count }
      }
    }
  `
  const data = await gql(creds.endpoint, creds.token, query)
  return data.connection?.aggregate?.count ?? 0
}

export async function fetchMissingForLocale(
  creds: HygraphCredentials,
  modelName: string,
  modelType: string,
  locale: string,
  endpoint: string,
  onProgress?: (fetched: number) => void,
): Promise<MissingEntry[]> {
  const PAGE_SIZE = 100
  const missing: MissingEntry[] = []
  let skip = 0
  let hasMore = true

  const projectId = extractProjectId(endpoint)

  while (hasMore) {
    const query = `
      query FetchEntries($skip: Int!) {
        entries: ${modelName}(
          locales: [en]
          first: ${PAGE_SIZE}
          skip: $skip
        ) {
          id
          localizations { locale }
          ... on ${modelType} {
            ${getTitleField(modelType)}
          }
        }
      }
    `

    try {
      const data = await gql(creds.endpoint, creds.token, query, { skip })
      const entries = data.entries ?? []

      for (const entry of entries) {
        const translatedLocales = (entry.localizations ?? []).map(
          (l: { locale: string }) => l.locale,
        )
        if (!translatedLocales.includes(locale)) {
          missing.push({
            id: entry.id,
            title: entry.title ?? entry.name ?? entry.slug ?? entry.id,
            missingLocales: [locale],
            studioUrl: projectId
              ? `https://app.hygraph.com/${projectId}/master/content/${modelType}/view/${entry.id}`
              : '#',
          })
        }
      }

      onProgress?.(skip + entries.length)
      hasMore = entries.length === PAGE_SIZE
      skip += PAGE_SIZE
    } catch {
      hasMore = false
    }
  }

  return missing
}

function extractProjectId(endpoint: string): string {
  const match = endpoint.match(/\/([a-zA-Z0-9]{20,})\//)
  return match?.[1] ?? ''
}

function getTitleField(modelType: string): string {
  const common = ['title', 'name', 'slug', 'headline', 'label']
  return common.map((f) => `${f}`).join('\n          ')
}
