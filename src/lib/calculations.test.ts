import { describe, expect, it } from 'vitest'
import {
  buildMonthlyCashflowSummary,
  buildTrendSeries,
  computeGoalProgress,
  computeNetWorth,
} from './calculations'
import type {
  Account,
  AccountSnapshot,
  Goal,
  Institution,
  MonthlyCashflowEntry,
} from '../types'

const institutions: Institution[] = [
  {
    id: 'i1',
    user_id: 'u1',
    name: 'Intesa Sanpaolo',
    kind: 'bank',
    icon_mode: 'predefined',
    icon_key: 'intesa-sanpaolo',
    icon_url: null,
    logo_scale: 1,
    logo_offset_x: 0,
    logo_offset_y: 0,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'i2',
    user_id: 'u1',
    name: 'Trade Republic',
    kind: 'broker',
    icon_mode: 'predefined',
    icon_key: 'trade-republic',
    icon_url: null,
    logo_scale: 1,
    logo_offset_x: 0,
    logo_offset_y: 0,
    created_at: '2026-01-01T00:00:00.000Z',
  },
]

const accounts: Account[] = [
  {
    id: 'a-bank',
    user_id: 'u1',
    institution_id: 'i1',
    name: 'Conto principale',
    account_type: 'bank',
    currency: 'EUR',
    is_archived: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'a-invest',
    user_id: 'u1',
    institution_id: 'i2',
    name: 'Broker ETF',
    account_type: 'investment',
    currency: 'EUR',
    is_archived: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
]

const snapshots: AccountSnapshot[] = [
  {
    id: 's1',
    user_id: 'u1',
    account_id: 'a-bank',
    snapshot_date: '2026-01-10',
    value_eur: 1000,
    note: null,
    created_at: '2026-01-10T08:00:00.000Z',
    updated_at: '2026-01-10T08:00:00.000Z',
  },
  {
    id: 's2',
    user_id: 'u1',
    account_id: 'a-invest',
    snapshot_date: '2026-01-11',
    value_eur: 500,
    note: null,
    created_at: '2026-01-11T08:00:00.000Z',
    updated_at: '2026-01-11T08:00:00.000Z',
  },
  {
    id: 's3',
    user_id: 'u1',
    account_id: 'a-bank',
    snapshot_date: '2026-01-12',
    value_eur: 1200,
    note: null,
    created_at: '2026-01-12T08:00:00.000Z',
    updated_at: '2026-01-12T08:00:00.000Z',
  },
]

describe('computeNetWorth', () => {
  it('calcola totale e subtotali usando gli ultimi snapshot', () => {
    const summary = computeNetWorth(accounts, snapshots, institutions)

    expect(summary.total).toBe(1700)
    expect(summary.bank).toBe(1200)
    expect(summary.investment).toBe(500)
    expect(summary.byInstitution).toEqual([
      {
        institutionId: 'i1',
        institutionName: 'Intesa Sanpaolo',
        value: 1200,
      },
      {
        institutionId: 'i2',
        institutionName: 'Trade Republic',
        value: 500,
      },
    ])
  })
})

describe('buildTrendSeries', () => {
  it('ordina e aggrega la serie storica', () => {
    const trend = buildTrendSeries(accounts, snapshots)

    expect(trend).toEqual([
      { date: '2026-01-10', total: 1000, bank: 1000, investment: 0 },
      { date: '2026-01-11', total: 1500, bank: 1000, investment: 500 },
      { date: '2026-01-12', total: 1700, bank: 1200, investment: 500 },
    ])
  })
})

describe('computeGoalProgress', () => {
  it('gestisce target a zero senza divisioni invalide', () => {
    const goals: Goal[] = [
      {
        id: 'g1',
        user_id: 'u1',
        category: 'total',
        target_eur: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]

    const result = computeGoalProgress(goals, {
      total: 1500,
      bank: 1000,
      investment: 500,
    })

    expect(result[0].progress).toBe(0)
    expect(result[0].remaining).toBe(0)
  })
})

describe('buildMonthlyCashflowSummary', () => {
  it('calcola guadagnato/investito/speso/risparmiato ignorando variazioni investimento', () => {
    const monthlySnapshots: AccountSnapshot[] = [
      {
        id: 'm0',
        user_id: 'u1',
        account_id: 'a-bank',
        snapshot_date: '2025-12-31',
        value_eur: 0,
        note: null,
        created_at: '2025-12-31T08:00:00.000Z',
        updated_at: '2025-12-31T08:00:00.000Z',
      },
      {
        id: 'm1',
        user_id: 'u1',
        account_id: 'a-bank',
        snapshot_date: '2026-01-31',
        value_eur: 1000,
        note: null,
        created_at: '2026-01-31T08:00:00.000Z',
        updated_at: '2026-01-31T08:00:00.000Z',
      },
      {
        id: 'm2',
        user_id: 'u1',
        account_id: 'a-bank',
        snapshot_date: '2026-02-28',
        value_eur: 900,
        note: null,
        created_at: '2026-02-28T08:00:00.000Z',
        updated_at: '2026-02-28T08:00:00.000Z',
      },
      {
        id: 'm3',
        user_id: 'u1',
        account_id: 'a-invest',
        snapshot_date: '2026-01-31',
        value_eur: 500,
        note: null,
        created_at: '2026-01-31T08:00:00.000Z',
        updated_at: '2026-01-31T08:00:00.000Z',
      },
      {
        id: 'm4',
        user_id: 'u1',
        account_id: 'a-invest',
        snapshot_date: '2026-02-28',
        value_eur: 900,
        note: null,
        created_at: '2026-02-28T08:00:00.000Z',
        updated_at: '2026-02-28T08:00:00.000Z',
      },
    ]
    const entries: MonthlyCashflowEntry[] = [
      {
        id: 'c1',
        user_id: 'u1',
        entry_date: '2026-01-05',
        entry_type: 'income',
        amount_eur: 1500,
        note: null,
        created_at: '2026-01-05T08:00:00.000Z',
        updated_at: '2026-01-05T08:00:00.000Z',
      },
      {
        id: 'c2',
        user_id: 'u1',
        entry_date: '2026-01-07',
        entry_type: 'invested',
        amount_eur: 400,
        note: null,
        created_at: '2026-01-07T08:00:00.000Z',
        updated_at: '2026-01-07T08:00:00.000Z',
      },
      {
        id: 'c3',
        user_id: 'u1',
        entry_date: '2026-02-05',
        entry_type: 'income',
        amount_eur: 1200,
        note: null,
        created_at: '2026-02-05T08:00:00.000Z',
        updated_at: '2026-02-05T08:00:00.000Z',
      },
      {
        id: 'c4',
        user_id: 'u1',
        entry_date: '2026-02-06',
        entry_type: 'invested',
        amount_eur: 300,
        note: null,
        created_at: '2026-02-06T08:00:00.000Z',
        updated_at: '2026-02-06T08:00:00.000Z',
      },
    ]

    const currentDate = '2026-03-28'

    expect(
      buildMonthlyCashflowSummary(accounts, monthlySnapshots, entries, { currentDate }),
    ).toEqual([
      {
        month: '2025-12',
        earned: 0,
        invested: 0,
        spent: 0,
        saved: 0,
      },
      {
        month: '2026-01',
        earned: 1500,
        invested: 400,
        spent: 100,
        saved: 1000,
      },
      {
        month: '2026-02',
        earned: 1200,
        invested: 300,
        spent: 1000,
        saved: -100,
      },
    ])
  })

  it('usa la data più vicina a fine mese e la riusa come inizio del mese successivo', () => {
    const sparseSnapshots: AccountSnapshot[] = [
      {
        id: 'ss1',
        user_id: 'u1',
        account_id: 'a-bank',
        snapshot_date: '2026-01-15',
        value_eur: 1000,
        note: null,
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z',
      },
      {
        id: 'ss2',
        user_id: 'u1',
        account_id: 'a-bank',
        snapshot_date: '2026-03-20',
        value_eur: 800,
        note: null,
        created_at: '2026-03-20T08:00:00.000Z',
        updated_at: '2026-03-20T08:00:00.000Z',
      },
    ]
    const sparseEntries: MonthlyCashflowEntry[] = [
      {
        id: 'sc1',
        user_id: 'u1',
        entry_date: '2026-03-03',
        entry_type: 'income',
        amount_eur: 300,
        note: null,
        created_at: '2026-03-03T08:00:00.000Z',
        updated_at: '2026-03-03T08:00:00.000Z',
      },
      {
        id: 'sc2',
        user_id: 'u1',
        entry_date: '2026-03-05',
        entry_type: 'invested',
        amount_eur: 100,
        note: null,
        created_at: '2026-03-05T08:00:00.000Z',
        updated_at: '2026-03-05T08:00:00.000Z',
      },
    ]

    expect(
      buildMonthlyCashflowSummary(accounts, sparseSnapshots, sparseEntries, {
        currentDate: '2026-03-28',
      }),
    ).toEqual([
      {
        month: '2026-01',
        earned: 0,
        invested: 0,
        spent: 0,
        saved: 0,
      },
      {
        month: '2026-02',
        earned: 0,
        invested: 0,
        spent: 200,
        saved: -200,
      },
      {
        month: '2026-03',
        earned: 300,
        invested: 100,
        spent: 200,
        saved: 0,
      },
    ])
  })

  it('se manca fine mese precedente usa il giorno più vicino e non parte da zero', () => {
    const marchSnapshotsOnly: AccountSnapshot[] = [
      {
        id: 'ms1',
        user_id: 'u1',
        account_id: 'a-bank',
        snapshot_date: '2026-03-01',
        value_eur: 9272.33,
        note: null,
        created_at: '2026-03-19T08:00:00.000Z',
        updated_at: '2026-03-19T08:00:00.000Z',
      },
      {
        id: 'ms2',
        user_id: 'u1',
        account_id: 'a-bank',
        snapshot_date: '2026-03-28',
        value_eur: 11788.12,
        note: null,
        created_at: '2026-03-28T17:38:00.000Z',
        updated_at: '2026-03-28T17:38:00.000Z',
      },
    ]
    const marchEntriesOnly: MonthlyCashflowEntry[] = [
      {
        id: 'me1',
        user_id: 'u1',
        entry_date: '2026-03-15',
        entry_type: 'income',
        amount_eur: 9730.72,
        note: null,
        created_at: '2026-03-15T08:00:00.000Z',
        updated_at: '2026-03-15T08:00:00.000Z',
      },
      {
        id: 'me2',
        user_id: 'u1',
        entry_date: '2026-03-16',
        entry_type: 'invested',
        amount_eur: 1001.27,
        note: null,
        created_at: '2026-03-16T08:00:00.000Z',
        updated_at: '2026-03-16T08:00:00.000Z',
      },
    ]

    const summary = buildMonthlyCashflowSummary(
      accounts,
      marchSnapshotsOnly,
      marchEntriesOnly,
      {
        currentDate: '2026-03-28',
      },
    )

    expect(summary).toEqual([
      {
        month: '2026-03',
        earned: 9730.72,
        invested: 1001.27,
        spent: 6213.66,
        saved: 2515.79,
      },
    ])
  })

  it('nel mese corrente usa l’ultimo saldo disponibile del mese corrente', () => {
    const currentMonthSnapshots: AccountSnapshot[] = [
      {
        id: 'cm1',
        user_id: 'u1',
        account_id: 'a-bank',
        snapshot_date: '2026-02-28',
        value_eur: 900,
        note: null,
        created_at: '2026-02-28T08:00:00.000Z',
        updated_at: '2026-02-28T08:00:00.000Z',
      },
      {
        id: 'cm2',
        user_id: 'u1',
        account_id: 'a-bank',
        snapshot_date: '2026-03-28',
        value_eur: 1200,
        note: null,
        created_at: '2026-03-28T08:00:00.000Z',
        updated_at: '2026-03-28T08:00:00.000Z',
      },
      {
        id: 'cm3',
        user_id: 'u1',
        account_id: 'a-bank',
        snapshot_date: '2026-04-01',
        value_eur: 1250,
        note: null,
        created_at: '2026-04-01T08:00:00.000Z',
        updated_at: '2026-04-01T08:00:00.000Z',
      },
    ]
    const currentMonthEntries: MonthlyCashflowEntry[] = [
      {
        id: 'cme1',
        user_id: 'u1',
        entry_date: '2026-03-05',
        entry_type: 'income',
        amount_eur: 500,
        note: null,
        created_at: '2026-03-05T08:00:00.000Z',
        updated_at: '2026-03-05T08:00:00.000Z',
      },
      {
        id: 'cme2',
        user_id: 'u1',
        entry_date: '2026-03-06',
        entry_type: 'invested',
        amount_eur: 100,
        note: null,
        created_at: '2026-03-06T08:00:00.000Z',
        updated_at: '2026-03-06T08:00:00.000Z',
      },
    ]

    const summary = buildMonthlyCashflowSummary(
      accounts,
      currentMonthSnapshots,
      currentMonthEntries,
      {
        currentDate: '2026-03-28',
      },
    )

    const march = summary.find((row) => row.month === '2026-03')

    expect(march).toEqual({
      month: '2026-03',
      earned: 500,
      invested: 100,
      spent: 100,
      saved: 300,
    })
  })

  it('restituisce N/D (null) quando la spesa mensile risulta negativa', () => {
    const negativeSnapshots: AccountSnapshot[] = [
      {
        id: 'ns1',
        user_id: 'u1',
        account_id: 'a-bank',
        snapshot_date: '2026-01-31',
        value_eur: 1000,
        note: null,
        created_at: '2026-01-31T08:00:00.000Z',
        updated_at: '2026-01-31T08:00:00.000Z',
      },
    ]
    const negativeEntries: MonthlyCashflowEntry[] = [
      {
        id: 'ne1',
        user_id: 'u1',
        entry_date: '2026-01-10',
        entry_type: 'invested',
        amount_eur: 100,
        note: null,
        created_at: '2026-01-10T08:00:00.000Z',
        updated_at: '2026-01-10T08:00:00.000Z',
      },
    ]

    expect(
      buildMonthlyCashflowSummary(accounts, negativeSnapshots, negativeEntries, {
        currentDate: '2026-03-28',
      }),
    ).toEqual([
      {
        month: '2026-01',
        earned: 0,
        invested: 100,
        spent: null,
        saved: null,
      },
    ])
  })

  it('non marca N/D quando la spesa reale è zero ma il float produce micro-negativo', () => {
    const precisionSnapshots: AccountSnapshot[] = [
      {
        id: 'ps1',
        user_id: 'u1',
        account_id: 'a-bank',
        snapshot_date: '2026-01-31',
        value_eur: 0.01,
        note: null,
        created_at: '2026-01-31T08:00:00.000Z',
        updated_at: '2026-01-31T08:00:00.000Z',
      },
      {
        id: 'ps2',
        user_id: 'u1',
        account_id: 'a-bank',
        snapshot_date: '2026-02-28',
        value_eur: 0,
        note: null,
        created_at: '2026-02-28T08:00:00.000Z',
        updated_at: '2026-02-28T08:00:00.000Z',
      },
    ]
    const precisionEntries: MonthlyCashflowEntry[] = [
      {
        id: 'pe1',
        user_id: 'u1',
        entry_date: '2026-02-10',
        entry_type: 'income',
        amount_eur: 0.06,
        note: null,
        created_at: '2026-02-10T08:00:00.000Z',
        updated_at: '2026-02-10T08:00:00.000Z',
      },
      {
        id: 'pe2',
        user_id: 'u1',
        entry_date: '2026-02-11',
        entry_type: 'invested',
        amount_eur: 0.07,
        note: null,
        created_at: '2026-02-11T08:00:00.000Z',
        updated_at: '2026-02-11T08:00:00.000Z',
      },
    ]

    const summary = buildMonthlyCashflowSummary(
      accounts,
      precisionSnapshots,
      precisionEntries,
      {
        currentDate: '2026-03-28',
      },
    )

    const february = summary.find((row) => row.month === '2026-02')

    expect(february).toEqual({
      month: '2026-02',
      earned: 0.06,
      invested: 0.07,
      spent: 0,
      saved: -0.01,
    })
  })
})
