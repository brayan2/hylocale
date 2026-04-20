import type { HygraphCredentials, HygraphLocale, HygraphModel, MissingEntry } from '@/types'

async function gql(
  endpoint: string,
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  return json.data
}

function unwrapType(ref: { kind: string; name?: string; ofType?: unknown }): string | null {
  if (!ref) return null
  if (ref.name) return ref.name
  if (ref.ofType) return unwrapType(ref.ofType as typeof ref)
  return null
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function validateCredentials(creds: HygraphCredentials): Promise<void> {
  await gql(creds.endpoint, creds.token, `{ __typename }`)
}

export async function fetchLocales(creds: HygraphCredentials): Promise<HygraphLocale[]> {
  const data = await gql(creds.endpoint, creds.token, `
    query { __type(name: "Locale") { enumValues { name } } }
  `)
  const values: Array<{ name: string }> = data?.__type?.enumValues ?? []
  if (!values.length) throw new Error('No locales found — is localisation enabled on this project?')
  return values.map((v, i) => ({
    id: v.name,
    apiId: v.name,
    displayName: v.name.replace(/_/g, '-'),
    isDefault: i === 0,
  }))
}

export async function fetchModels(creds: HygraphCredentials): Promise<HygraphModel[]> {
  // Two separate queries — combining them triggers a 500 on some Hygraph instances
  const [typesData, queryData] = await Promise.all([
    gql(creds.endpoint, creds.token, `
      query { __schema { types { name kind fields { name } } } }
    `),
    gql(creds.endpoint, creds.token, `
      query { __schema { queryType { fields { name } } } }
    `),
  ])

  const localizedTypes = new Set<string>()
  for (const t of typesData.__schema.types as Array<{
    name: string; kind: string; fields: Array<{ name: string }> | null
  }>) {
    if (t.kind === 'OBJECT' && !t.name.startsWith('__') && t.fields?.some(f => f.name === 'localizations'))
      localizedTypes.add(t.name)
  }

  const allFieldNames = new Set<string>(
    (queryData.__schema.queryType.fields as Array<{ name: string }>).map(f => f.name),
  )

  // Match each localized type to its plural query field by convention
  function pluralApiId(typeName: string): string | null {
    const c = typeName.charAt(0).toLowerCase() + typeName.slice(1)
    // Already plural (type name ends with s and exact field exists with Connection)
    if (allFieldNames.has(c) && allFieldNames.has(c + 'Connection')) return c
    // Regular pluralisation: add s
    if (allFieldNames.has(c + 's') && allFieldNames.has(c + 'sConnection')) return c + 's'
    // y → ies
    if (c.endsWith('y')) {
      const ies = c.slice(0, -1) + 'ies'
      if (allFieldNames.has(ies) && allFieldNames.has(ies + 'Connection')) return ies
    }
    // add es
    if (allFieldNames.has(c + 'es') && allFieldNames.has(c + 'esConnection')) return c + 'es'
    return null
  }

  const models: HygraphModel[] = []
  for (const typeName of localizedTypes) {
    const apiId = pluralApiId(typeName)
    if (apiId) {
      models.push({
        id: typeName,
        apiId,
        displayName: typeName.replace(/([A-Z])/g, ' $1').trim(),
        isLocalized: true,
      })
    }
  }
  return models
}

export async function fetchTotalCount(creds: HygraphCredentials, modelApiId: string): Promise<number> {
  const data = await gql(creds.endpoint, creds.token, `
    query { result: ${modelApiId}Connection { aggregate { count } } }
  `)
  return data.result?.aggregate?.count ?? 0
}

export async function fetchLocalisationCounts(
  creds: HygraphCredentials,
  modelApiId: string,
  locales: string[],
  total: number,
): Promise<Record<string, number>> {
  // Try server-side count first (fast)
  try {
    return await countViaWhere(creds, modelApiId, locales)
  } catch {
    // 500 from server — fall back to scanning entries client-side (reliable)
    return await countViaScan(creds, modelApiId, locales, total)
  }
}

async function countViaWhere(
  creds: HygraphCredentials,
  modelApiId: string,
  locales: string[],
): Promise<Record<string, number>> {
  const aliases = locales
    .map(
      l => `${l}: ${modelApiId}Connection(where: { localizations_some: { locale: ${l} } }) {
        aggregate { count }
      }`,
    )
    .join('\n')

  const data = await gql(creds.endpoint, creds.token, `query { ${aliases} }`)
  const counts: Record<string, number> = {}
  for (const l of locales) counts[l] = data[l]?.aggregate?.count ?? 0
  return counts
}

async function countViaScan(
  creds: HygraphCredentials,
  modelApiId: string,
  locales: string[],
  total: number,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = Object.fromEntries(locales.map(l => [l, 0]))
  const PAGE = 500
  let skip = 0

  while (skip < total) {
    const data = await gql(creds.endpoint, creds.token, `
      query {
        entries: ${modelApiId}(first: ${PAGE}, skip: ${skip}) {
          localizations { locale }
        }
      }
    `)
    const entries: Array<{ localizations: Array<{ locale: string }> }> = data.entries ?? []
    for (const entry of entries) {
      const has = new Set(entry.localizations.map(l => l.locale))
      for (const l of locales) if (has.has(l)) counts[l]++
    }
    if (entries.length < PAGE) break
    skip += PAGE
  }
  return counts
}

async function fetchTitleField(creds: HygraphCredentials, modelType: string): Promise<string | null> {
  try {
    const data = await gql(creds.endpoint, creds.token, `
      query { __type(name: "${modelType}") {
        fields { name type { kind name ofType { kind name } } }
      } }
    `)
    const fields: Array<{ name: string; type: { name?: string; ofType?: { name?: string } } }> =
      data.__type?.fields ?? []
    for (const c of ['title', 'name', 'headline', 'label', 'slug', 'displayName']) {
      const f = fields.find(x => x.name === c)
      if (f && (f.type.name === 'String' || f.type.ofType?.name === 'String')) return c
    }
  } catch { /* ignore */ }
  return null
}

export async function fetchMissingForLocale(
  creds: HygraphCredentials,
  modelApiId: string,
  modelType: string,
  locale: string,
  defaultLocale: string,
  onProgress?: (n: number) => void,
): Promise<MissingEntry[]> {
  const PAGE = 100
  const missing: MissingEntry[] = []
  let skip = 0
  let hasMore = true
  const projectId = extractProjectId(creds.endpoint)
  const titleField = await fetchTitleField(creds, modelType)

  while (hasMore) {
    try {
      const data = await gql(creds.endpoint, creds.token, `
        query {
          entries: ${modelApiId}(locales: [${defaultLocale}], first: ${PAGE}, skip: ${skip}) {
            id
            ${titleField ?? ''}
            localizations(locales: [${locale}]) { locale }
          }
        }
      `)
      const entries: Array<{
        id: string; localizations: Array<{ locale: string }>; [k: string]: unknown
      }> = data.entries ?? []

      for (const e of entries) {
        if (!e.localizations.some(l => l.locale === locale)) {
          missing.push({
            id: e.id,
            title: titleField ? String(e[titleField] ?? '') || e.id : e.id,
            missingLocales: [locale],
            studioUrl: projectId
              ? `https://app.hygraph.com/${projectId}/master/content/${modelType}/view/${e.id}`
              : '#',
          })
        }
      }
      onProgress?.(skip + entries.length)
      hasMore = entries.length === PAGE
      skip += PAGE
    } catch {
      hasMore = false
    }
  }
  return missing
}

function extractProjectId(endpoint: string): string {
  return endpoint.match(/\/content\/([a-zA-Z0-9]+)\//)?.[1] ?? ''
}
