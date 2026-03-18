import { describe, expect, it } from 'vitest'
import { resolveInstitutionLogoCandidates } from './institutionLogos'

describe('resolveInstitutionLogoCandidates', () => {
  it('usa logo locale preset e fallback favicon', () => {
    const candidates = resolveInstitutionLogoCandidates({
      icon_key: 'bbva',
      icon_mode: 'predefined',
      icon_url: null,
    })

    expect(candidates[0]).toBe('/logos/bbva.ico')
    expect(candidates).toContain('https://icons.duckduckgo.com/ip3/bbva.com.ico')
  })

  it('converte URL clearbit legacy in fallback favicon', () => {
    const candidates = resolveInstitutionLogoCandidates({
      icon_key: null,
      icon_mode: 'predefined',
      icon_url: 'https://logo.clearbit.com/unicredit.it',
    })

    expect(candidates).toContain('https://icons.duckduckgo.com/ip3/unicredit.it.ico')
    expect(candidates).not.toContain('https://logo.clearbit.com/unicredit.it')
  })

  it('per custom usa solo URL configurato', () => {
    const candidates = resolveInstitutionLogoCandidates({
      icon_key: null,
      icon_mode: 'custom',
      icon_url: 'https://example.com/logo.png',
    })

    expect(candidates).toEqual(['https://example.com/logo.png'])
  })
})
