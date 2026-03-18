import type { InstitutionKind } from '../types'

export interface PresetInstitution {
  key: string
  name: string
  kind: InstitutionKind
  fallbackDomain: string
  logoPath: string
  primaryColor: string
}

export const PRESET_INSTITUTIONS: PresetInstitution[] = [
  {
    key: 'intesa-sanpaolo',
    name: 'Intesa Sanpaolo',
    kind: 'bank',
    fallbackDomain: 'intesasanpaolo.com',
    logoPath: '/logos/intesa-sanpaolo.ico',
    primaryColor: '#008752',
  },
  {
    key: 'unicredit',
    name: 'UniCredit',
    kind: 'bank',
    fallbackDomain: 'unicredit.it',
    logoPath: '/logos/unicredit.ico',
    primaryColor: '#e30613',
  },
  {
    key: 'banco-bpm',
    name: 'Banco BPM',
    kind: 'bank',
    fallbackDomain: 'bancobpm.it',
    logoPath: '/logos/banco-bpm.ico',
    primaryColor: '#0094d9',
  },
  {
    key: 'bper',
    name: 'BPER Banca',
    kind: 'bank',
    fallbackDomain: 'bper.it',
    logoPath: '/logos/bper.ico',
    primaryColor: '#00a66f',
  },
  {
    key: 'mps',
    name: 'Monte dei Paschi di Siena',
    kind: 'bank',
    fallbackDomain: 'mps.it',
    logoPath: '/logos/mps.ico',
    primaryColor: '#8a1538',
  },
  {
    key: 'fineco',
    name: 'Fineco',
    kind: 'bank',
    fallbackDomain: 'finecobank.com',
    logoPath: '/logos/fineco.ico',
    primaryColor: '#ffd100',
  },
  {
    key: 'credem',
    name: 'Credem',
    kind: 'bank',
    fallbackDomain: 'credem.it',
    logoPath: '/logos/credem.ico',
    primaryColor: '#f4c400',
  },
  {
    key: 'bancoposta',
    name: 'BancoPosta',
    kind: 'bank',
    fallbackDomain: 'poste.it',
    logoPath: '/logos/bancoposta.ico',
    primaryColor: '#f5c400',
  },
  {
    key: 'ing',
    name: 'ING Italia',
    kind: 'bank',
    fallbackDomain: 'ing.it',
    logoPath: '/logos/ing.ico',
    primaryColor: '#ff6200',
  },
  {
    key: 'mediolanum',
    name: 'Banca Mediolanum',
    kind: 'bank',
    fallbackDomain: 'bancamediolanum.it',
    logoPath: '/logos/mediolanum.ico',
    primaryColor: '#0033a1',
  },
  {
    key: 'credit-agricole',
    name: 'Credit Agricole Italia',
    kind: 'bank',
    fallbackDomain: 'credit-agricole.it',
    logoPath: '/logos/credit-agricole.ico',
    primaryColor: '#009b77',
  },
  {
    key: 'trade-republic',
    name: 'Trade Republic',
    kind: 'broker',
    fallbackDomain: 'traderepublic.com',
    logoPath: '/logos/trade-republic.ico',
    primaryColor: '#111827',
  },
  {
    key: 'bbva',
    name: 'BBVA',
    kind: 'bank',
    fallbackDomain: 'bbva.com',
    logoPath: '/logos/bbva.ico',
    primaryColor: '#072146',
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
