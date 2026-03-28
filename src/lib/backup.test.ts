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
  cashflowEntries: [
    {
      id: 'c1',
      user_id: 'u1',
      entry_date: '2026-01-10',
      entry_type: 'income',
      amount_eur: 1800,
      note: 'stipendio',
      created_at: '2026-01-10T00:00:00.000Z',
      updated_at: '2026-01-10T00:00:00.000Z',
    },
  ],
  recurringTemplates: [
    {
      id: 'rt1',
      user_id: 'u1',
      name: 'Stipendio',
      entry_type: 'income',
      amount_eur: 1800,
      day_of_month: 27,
      note: 'Ricorrente',
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ],
  recurringOccurrences: [
    {
      id: 'ro1',
      user_id: 'u1',
      template_id: 'rt1',
      month_date: '2026-01-01',
      due_date: '2026-01-27',
      status: 'confirmed',
      confirmed_entry_id: 'c1',
      created_at: '2026-01-27T00:00:00.000Z',
      updated_at: '2026-01-27T00:00:00.000Z',
    },
  ],
}

describe('backup helpers', () => {
  it('genera payload JSON valido e parseabile', () => {
    const payload = buildBackupPayload(state)
    const parsed = parseBackupPayload(payload)

    expect(parsed.version).toBe(3)
    expect(parsed.accounts[0].institutionName).toBe('BBVA')
    expect(parsed.snapshots[0].valueEur).toBe(2400)
    expect(parsed.cashflowEntries[0].entryType).toBe('income')
    expect(parsed.recurringTemplates[0].name).toBe('Stipendio')
    expect(parsed.recurringOccurrences[0].status).toBe('confirmed')
  })

  it('genera CSV con intestazione e righe snapshot', () => {
    const csv = toSnapshotsCsv(state)

    expect(csv).toContain('data,conto,tipo_conto,istituto,valore_eur,nota')
    expect(csv).toContain('2026-01-20,Conto BBVA,bank,BBVA,2400.00,stipendio')
  })

  it('supporta import backup legacy v1 senza cashflowEntries', () => {
    const parsed = parseBackupPayload({
      version: 1,
      exportedAt: '2026-01-20T00:00:00.000Z',
      institutions: [],
      accounts: [],
      snapshots: [],
      positions: [],
      goals: [],
    })

    expect(parsed.cashflowEntries).toEqual([])
    expect(parsed.recurringTemplates).toEqual([])
    expect(parsed.recurringOccurrences).toEqual([])
  })
})
