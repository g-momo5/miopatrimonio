import {
  buildFaviconUrl,
  getPresetInstitutionByKey,
} from '../constants/presetInstitutions'
import type { Institution } from '../types'

const CLEARBIT_PREFIX = 'https://logo.clearbit.com/'

export function resolveInstitutionLogoCandidates(
  institution: Pick<Institution, 'icon_key' | 'icon_mode' | 'icon_url'>,
): string[] {
  const candidates: string[] = []

  const preset = getPresetInstitutionByKey(institution.icon_key)

  if (institution.icon_mode === 'custom') {
    if (institution.icon_url) {
      candidates.push(institution.icon_url)

      const customDomain = extractDomainFromUrl(institution.icon_url)
      if (customDomain) {
        candidates.push(buildFaviconUrl(customDomain))
      }
    }

    if (preset?.logoPath) {
      candidates.push(preset.logoPath)
    }

    if (preset?.fallbackDomain) {
      candidates.push(buildFaviconUrl(preset.fallbackDomain))
    }

    return dedupe(candidates)
  }

  if (preset?.logoPath) {
    candidates.push(preset.logoPath)
  }

  if (preset?.fallbackDomain) {
    candidates.push(buildFaviconUrl(preset.fallbackDomain))
  }

  if (institution.icon_url) {
    if (institution.icon_url.startsWith(CLEARBIT_PREFIX)) {
      const legacyDomain = extractLegacyClearbitDomain(institution.icon_url)
      if (legacyDomain) {
        candidates.push(buildFaviconUrl(legacyDomain))
      }
    } else {
      candidates.push(institution.icon_url)
    }
  }

  return dedupe(candidates)
}

function extractLegacyClearbitDomain(url: string): string | null {
  if (!url.startsWith(CLEARBIT_PREFIX)) {
    return null
  }

  const domain = url.slice(CLEARBIT_PREFIX.length).trim()

  return domain || null
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function extractDomainFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.hostname || null
  } catch {
    return null
  }
}
