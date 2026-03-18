import { describe, expect, it } from 'vitest'
import { buildBackupPayload, parseBackupPayload, toSnapshotsCsv } from './backup'
import type { PortfolioDataState } from '../types'

const state: PortfolioDataState = {
  institutions: [
    {
      id: 'i1',
      user_id: 'u1',
      name: 'BBVA',
      kind: 'bank',
      icon_mode: 'predefined',
      icon_key: 'bbva',
      icon_url: 'https://logo.clearbit.com/bbva.com',
      logo_scale: 1,
      logo_offset_x: 0,
      logo_offset_y: 0,
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ],
  accounts: [
    {
      id: 'a1',
      user_id: 'u1',
      institution_id: 'i1',
      name: 'Conto BBVA',
      account_type: 'bank',
      currency: 'EUR',
      is_archived: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ],
  snapshots: [
    {
      id: 's1',
      user_id: 'u1',
      account_id: 'a1',
      snapshot_date: '2026-01-20',
      value_eur: 2400,
      note: 'stipendio',
      created_at: '2026-01-20T00:00:00.000Z',
      updated_at: '2026-01-20T00:00:00.000Z',
    },
  ],
  positions: [],
  goals: [],
}

describe('backup helpers', () => {
  it('genera payload JSON valido e parseabile', () => {
    const payload = buildBackupPayload(state)
    const parsed = parseBackupPayload(payload)

    expect(parsed.version).toBe(1)
    expect(parsed.accounts[0].institutionName).toBe('BBVA')
    expect(parsed.snapshots[0].valueEur).toBe(2400)
  })

  it('genera CSV con intestazione e righe snapshot', () => {
    const csv = toSnapshotsCsv(state)

    expect(csv).toContain('data,conto,tipo_conto,istituto,valore_eur,nota')
    expect(csv).toContain('2026-01-20,Conto BBVA,bank,BBVA,2400.00,stipendio')
  })
})
