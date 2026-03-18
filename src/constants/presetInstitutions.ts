import type { InstitutionKind } from '../types'

export interface PresetInstitution {
  key: string
  name: string
  kind: InstitutionKind
  fallbackDomain: string
  logoPath: string
}

export const PRESET_INSTITUTIONS: PresetInstitution[] = [
  {
    key: 'intesa-sanpaolo',
    name: 'Intesa Sanpaolo',
    kind: 'bank',
    fallbackDomain: 'intesasanpaolo.com',
    logoPath: '/logos/intesa-sanpaolo.ico',
  },
  {
    key: 'unicredit',
    name: 'UniCredit',
    kind: 'bank',
    fallbackDomain: 'unicredit.it',
    logoPath: '/logos/unicredit.ico',
  },
  {
    key: 'banco-bpm',
    name: 'Banco BPM',
    kind: 'bank',
    fallbackDomain: 'bancobpm.it',
    logoPath: '/logos/banco-bpm.ico',
  },
  {
    key: 'bper',
    name: 'BPER Banca',
    kind: 'bank',
    fallbackDomain: 'bper.it',
    logoPath: '/logos/bper.ico',
  },
  {
    key: 'mps',
    name: 'Monte dei Paschi di Siena',
    kind: 'bank',
    fallbackDomain: 'mps.it',
    logoPath: '/logos/mps.ico',
  },
  {
    key: 'fineco',
    name: 'Fineco',
    kind: 'bank',
    fallbackDomain: 'finecobank.com',
    logoPath: '/logos/fineco.ico',
  },
  {
    key: 'credem',
    name: 'Credem',
    kind: 'bank',
    fallbackDomain: 'credem.it',
    logoPath: '/logos/credem.ico',
  },
  {
    key: 'bancoposta',
    name: 'BancoPosta',
    kind: 'bank',
    fallbackDomain: 'poste.it',
    logoPath: '/logos/bancoposta.ico',
  },
  {
    key: 'ing',
    name: 'ING Italia',
    kind: 'bank',
    fallbackDomain: 'ing.it',
    logoPath: '/logos/ing.ico',
  },
  {
    key: 'mediolanum',
    name: 'Banca Mediolanum',
    kind: 'bank',
    fallbackDomain: 'bancamediolanum.it',
    logoPath: '/logos/mediolanum.ico',
  },
  {
    key: 'credit-agricole',
    name: 'Credit Agricole Italia',
    kind: 'bank',
    fallbackDomain: 'credit-agricole.it',
    logoPath: '/logos/credit-agricole.ico',
  },
  {
    key: 'trade-republic',
    name: 'Trade Republic',
    kind: 'broker',
    fallbackDomain: 'traderepublic.com',
    logoPath: '/logos/trade-republic.ico',
  },
  {
    key: 'bbva',
    name: 'BBVA',
    kind: 'bank',
    fallbackDomain: 'bbva.com',
    logoPath: '/logos/bbva.ico',
  },
]

export const PRESET_INSTITUTION_BY_KEY = new Map(
  PRESET_INSTITUTIONS.map((institution) => [institution.key, institution]),
)

export function getPresetInstitutionByKey(
  key: string | null | undefined,
): PresetInstitution | undefined {
  if (!key) {
    return undefined
  }

  return PRESET_INSTITUTION_BY_KEY.get(key)
}

export function buildFaviconUrl(domain: string): string {
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`
}
